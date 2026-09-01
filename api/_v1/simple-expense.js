import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { enforceRestrictedRolePolicy } from "../_middlewares/rbac.middleware.js";
import { prisma } from "../_prisma.js";
import { AccountingService } from "../_services/accounting.service.js";
import { PERMS } from "../_constants/permissions.js";
import { validateAmount } from "../_utils/amount.js";
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from "../_utils/soft-delete.js";
import { simpleExpenseSchema } from "../_schemas/financial.schema.js";
const accountingTxOptions = { maxWait: 1e4, timeout: 3e4 };
var simple_expense_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await enforceRestrictedRolePolicy(req, res)) return;
  const action = req.query.action || req.body?.action;
  const idParam = req.query.id || req.body?.id;
  if (req.method === "GET") {
    const expenses = await prisma.simpleExpense.findMany({
      where: getDeletedFilter(req.query),
      orderBy: { createdAt: "desc" },
      include: {
        expenseHead: true,
        createdBy: { select: { fullName: true } }
      }
    });
    return res.status(200).json({ status: 200, data: expenses });
  }
  if (req.method === "PUT" || req.method === "POST" || req.method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      if (!idParam) {
        return res.status(400).json({ error: { message: "Expense ID is required", status: 400 } });
      }
      const existing = await prisma.simpleExpense.findUnique({ where: { id: idParam } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Expense not found", status: 404 } });
      }
      const restored = await prisma.simpleExpense.update({
        where: { id: idParam },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      if (existing.journalEntryId) {
        await prisma.journalEntry.update({
          where: { id: existing.journalEntryId },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        }).catch(() => {
        });
        await AccountingService.recalculateBalancesForJournalEntry(prisma, existing.journalEntryId);
      }
      return res.status(200).json({ status: 200, message: "Expense restored successfully", data: restored });
    }
  }
  if (!await verifyPermission(req, res, PERMS.RECORD_EXPENSE)) return;
  if (req.method === "POST") {
    const validated = simpleExpenseSchema.parse(req.body);
    const { date, expenseHeadId, paidTo, description, amount, paymentMethod, bankAccountId, reference } = validated;
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;
    const result = await prisma.$transaction(async (tx) => {
      const expenseHead = await tx.expenseHead.findUnique({
        where: { id: expenseHeadId },
        include: { account: true }
      });
      if (!expenseHead) {
        throw new Error("Expense head not found");
      }
      const expense = await tx.simpleExpense.create({
        data: {
          date: date ? new Date(date) : /* @__PURE__ */ new Date(),
          expenseHeadId,
          paidTo,
          description,
          amount: numAmount,
          paymentMethod: paymentMethod || "CASH",
          bankAccountId: paymentMethod === "BANK" ? bankAccountId : null,
          reference,
          status: "PENDING_POST",
          journalEntryId: null,
          createdById: req.user.id
        },
        include: { expenseHead: true }
      });
      try {
        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: "Create Simple Expense (Pending Post)",
            module: "Expense",
            newValues: { amount: numAmount, expenseHead: expenseHead.name, paidTo, description }
          }
        });
      } catch (e) {
      }
      return expense;
    }, accountingTxOptions);
    return res.status(201).json({ status: 201, data: result });
  }
  if (req.method === "PUT" || req.method === "PATCH") {
    const { id, date, expenseHeadId, paidTo, description, amount, paymentMethod, bankAccountId, reference } = req.body;
    if (!id || !expenseHeadId || !amount) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleExpense.findUnique({ where: { id }, include: { expenseHead: true } });
      if (!existing) throw new Error("Expense not found");
      if (existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Simple Expense Updated");
        } catch (e) {
        }
      }
      const expenseHead = await tx.expenseHead.findUnique({
        where: { id: expenseHeadId },
        include: { account: true }
      });
      if (!expenseHead) {
        throw new Error("Expense head not found");
      }
      const expenseAccountId = expenseHead.accountId || expenseHead.account?.id;
      const cashAccount = paymentMethod !== "BANK" ? await AccountingService.ensureCashInHandAccount(tx) : null;
      const postingResult = await AccountingService.postPayment(tx, {
        amount: numAmount,
        cashOrBankAccountId: paymentMethod === "BANK" && bankAccountId ? bankAccountId : cashAccount?.id,
        expenseAccountId: expenseAccountId || void 0,
        expenseAccountKeyword: !expenseAccountId ? expenseHead.name || "Expense" : void 0,
        description: description || `Expense for ${expenseHead.name}`,
        reference: reference || "Expense Payment",
        module: "Simple Expense",
        postedBy: req.user.id,
        postingDate: date ? new Date(date) : /* @__PURE__ */ new Date(),
        ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"]
      });
      const updated = await tx.simpleExpense.update({
        where: { id },
        data: {
          date: date ? new Date(date) : /* @__PURE__ */ new Date(),
          expenseHeadId,
          paidTo,
          description,
          amount: numAmount,
          paymentMethod: paymentMethod || "CASH",
          bankAccountId: paymentMethod === "BANK" ? bankAccountId : null,
          reference,
          journalEntryId: postingResult.journalEntry.id
        },
        include: { expenseHead: true, createdBy: { select: { fullName: true } } }
      });
      try {
        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: "Update Simple Expense",
            module: "Expense",
            oldValues: { amount: existing.amount, expenseHeadId: existing.expenseHeadId },
            newValues: { amount: numAmount, expenseHead: expenseHead.name, paidTo, description }
          }
        });
      } catch (e) {
      }
      return updated;
    }, accountingTxOptions);
    return res.status(200).json({ status: 200, data: result });
  }
  if (req.method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Admin or Super Admin can permanently delete records", status: 403 } });
    }
    const targetId = String(req.query.id || req.body?.id || "");
    if (!targetId) return res.status(400).json({ error: { message: "Expense ID required", status: 400 } });
    await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleExpense.findUnique({ where: { id: targetId } });
      if (existing && existing.journalEntryId) {
        try {
          if (isPermanent) {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Simple Expense Permanently Deleted");
          } else {
            await tx.journalEntry.update({
              where: { id: existing.journalEntryId },
              data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
            });
            await AccountingService.recalculateBalancesForJournalEntry(tx, existing.journalEntryId);
          }
        } catch (e) {
        }
      }
      if (existing) {
        if (isPermanent) {
          await tx.simpleExpense.delete({ where: { id: targetId } });
        } else {
          await tx.simpleExpense.update({
            where: { id: targetId },
            data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
          });
        }
      }
    }, accountingTxOptions);
    return res.status(200).json({ status: 200, message: "Expense deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  simple_expense_default as default
};
