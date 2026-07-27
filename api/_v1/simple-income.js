import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { AccountingService } from "../_services/accounting.service.js";
import { PERMS } from "../_constants/permissions.js";
import { validateAmount } from "../_utils/amount.js";
import { notify } from "../_utils/notify.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
const accountingTxOptions = { maxWait: 1e4, timeout: 3e4 };
var simple_income_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const action = req.query.action || req.body?.action;
  const idParam = req.query.id || req.body?.id;
  if (req.method === "GET") {
    const incomes = await prisma.simpleIncome.findMany({
      where: getDeletedFilter(req.query),
      orderBy: { createdAt: "desc" },
      include: {
        revenueHead: true,
        createdBy: { select: { fullName: true } }
      }
    });
    return res.status(200).json({ status: 200, data: incomes });
  }
  if (req.method === "PUT" || req.method === "POST" || req.method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      if (!idParam) {
        return res.status(400).json({ error: { message: "Income ID is required", status: 400 } });
      }
      const existing = await prisma.simpleIncome.findUnique({ where: { id: idParam } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Income not found", status: 404 } });
      }
      const restored = await prisma.simpleIncome.update({
        where: { id: idParam },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      if (existing.journalEntryId) {
        await prisma.journalEntry.update({
          where: { id: existing.journalEntryId },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        }).catch(() => {
        });
      }
      return res.status(200).json({ status: 200, message: "Income restored successfully", data: restored });
    }
  }
  if (!await verifyPermission(req, res, PERMS.RECORD_INCOME)) return;
  if (req.method === "POST") {
    const { date, revenueHeadId, description, amount, paymentMethod, bankAccountId, reference } = req.body;
    if (!revenueHeadId || !amount) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;
    const result = await prisma.$transaction(async (tx) => {
      const revenueHead = await tx.revenueHead.findUnique({
        where: { id: revenueHeadId },
        include: { account: true }
      });
      if (!revenueHead) {
        throw new Error("Revenue head not found");
      }
      const incomeAccountId = revenueHead.accountId || revenueHead.account?.id;
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: numAmount,
        cashOrBankAccountId: paymentMethod === "BANK" && bankAccountId ? bankAccountId : void 0,
        cashOrBankAccountKeyword: paymentMethod !== "BANK" ? "Cash" : void 0,
        incomeAccountId: incomeAccountId || void 0,
        incomeAccountKeyword: !incomeAccountId ? revenueHead.name || "Income" : void 0,
        description: description || `Income from ${revenueHead.name}`,
        reference: reference || "Income Receipt",
        module: "Simple Income",
        postedBy: req.user.id,
        postingDate: date ? new Date(date) : /* @__PURE__ */ new Date(),
        ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"]
      });
      const income = await tx.simpleIncome.create({
        data: {
          date: date ? new Date(date) : /* @__PURE__ */ new Date(),
          revenueHeadId,
          description,
          amount: numAmount,
          paymentMethod: paymentMethod || "CASH",
          bankAccountId: paymentMethod === "BANK" ? bankAccountId : null,
          reference,
          journalEntryId: postingResult.journalEntry.id,
          createdById: req.user.id
        },
        include: { revenueHead: true }
      });
      try {
        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: "Create Simple Income",
            module: "Income",
            newValues: { amount: numAmount, revenueHead: revenueHead.name, description }
          }
        });
      } catch (e) {
      }
      return income;
    }, accountingTxOptions);
    await notify(req, {
      title: "Income Recorded",
      message: `Income of Rs ${numAmount.toLocaleString()} recorded and posted to the ledger.`,
      module: "Income",
      recordId: result.id,
      actionType: "CREATE"
    });
    return res.status(201).json({ status: 201, data: result });
  }
  if (req.method === "PUT" || req.method === "PATCH") {
    const { id, date, revenueHeadId, description, amount, paymentMethod, bankAccountId, reference } = req.body;
    if (!id || !revenueHeadId || !amount) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleIncome.findUnique({ where: { id }, include: { revenueHead: true } });
      if (!existing) throw new Error("Income not found");
      if (existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Simple Income Updated");
        } catch (e) {
        }
      }
      const revenueHead = await tx.revenueHead.findUnique({
        where: { id: revenueHeadId },
        include: { account: true }
      });
      if (!revenueHead) {
        throw new Error("Revenue head not found");
      }
      const incomeAccountId = revenueHead.accountId || revenueHead.account?.id;
      const cashAccount = paymentMethod !== "BANK" ? await AccountingService.ensureCashInHandAccount(tx) : null;
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: numAmount,
        cashOrBankAccountId: paymentMethod === "BANK" && bankAccountId ? bankAccountId : cashAccount?.id,
        incomeAccountId: incomeAccountId || void 0,
        incomeAccountKeyword: !incomeAccountId ? revenueHead.name || "Income" : void 0,
        description: description || `Income from ${revenueHead.name}`,
        reference: reference || "Income Receipt",
        module: "Simple Income",
        postedBy: req.user.id,
        postingDate: date ? new Date(date) : /* @__PURE__ */ new Date(),
        ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"]
      });
      const updated = await tx.simpleIncome.update({
        where: { id },
        data: {
          date: date ? new Date(date) : /* @__PURE__ */ new Date(),
          revenueHeadId,
          description,
          amount: numAmount,
          paymentMethod: paymentMethod || "CASH",
          bankAccountId: paymentMethod === "BANK" ? bankAccountId : null,
          reference,
          journalEntryId: postingResult.journalEntry.id
        },
        include: { revenueHead: true, createdBy: { select: { fullName: true } } }
      });
      try {
        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: "Update Simple Income",
            module: "Income",
            oldValues: { amount: existing.amount, revenueHeadId: existing.revenueHeadId },
            newValues: { amount: numAmount, revenueHead: revenueHead.name, description }
          }
        });
      } catch (e) {
      }
      return updated;
    }, accountingTxOptions);
    await notify(req, {
      title: "Income Updated",
      message: `Income ${id} updated to Rs ${numAmount.toLocaleString()} and re-posted to the ledger.`,
      module: "Income",
      recordId: id,
      actionType: "UPDATE"
    });
    return res.status(200).json({ status: 200, data: result });
  }
  if (req.method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
    }
    const targetId = String(req.query.id || req.body?.id || "");
    if (!targetId) return res.status(400).json({ error: { message: "Income ID required", status: 400 } });
    await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleIncome.findUnique({ where: { id: targetId } });
      if (existing && existing.journalEntryId) {
        try {
          if (isPermanent) {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Simple Income Permanently Deleted");
          } else {
            await tx.journalEntry.update({
              where: { id: existing.journalEntryId },
              data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
            });
          }
        } catch (e) {
        }
      }
      if (existing) {
        if (isPermanent) {
          await tx.simpleIncome.delete({ where: { id: targetId } });
        } else {
          await tx.simpleIncome.update({
            where: { id: targetId },
            data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
          });
        }
      }
    }, accountingTxOptions);
    await notify(req, {
      title: "Income Deleted",
      message: `Income ${targetId} deleted.`,
      module: "Income",
      recordId: targetId,
      actionType: "DELETE"
    });
    return res.status(200).json({ status: 200, message: "Income deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  simple_income_default as default
};
