import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { enforceRestrictedRolePolicy } from "../_middlewares/rbac.middleware.js";
import { checkPermission } from "../_services/permission.service.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { FundValidationService } from "../_services/fund-validation.service.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
const accountingTxOptions = { maxWait: 1e4, timeout: 3e4 };
var journal_entries_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await enforceRestrictedRolePolicy(req, res)) return;
  const { method } = req;
  const action = req.query.action || req.body?.action;
  if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
    const hasMutatePerm = await isSuperAdmin(req) || await checkPermission(req, PERMS.POST_JOURNAL) || await checkPermission(req, PERMS.RECORD_EXPENSE) || await checkPermission(req, PERMS.RECORD_INCOME);
    if (!hasMutatePerm) {
      return res.status(403).json({ error: { message: "Forbidden: Permission required to create or modify journal entries", status: 403 } });
    }
  }
  if (method === "GET") {
    const hasViewPerm = await isSuperAdmin(req) || await checkPermission(req, PERMS.VIEW_JOURNALS) || await checkPermission(req, PERMS.POST_JOURNAL) || await checkPermission(req, PERMS.RECORD_EXPENSE) || await checkPermission(req, PERMS.RECORD_INCOME) || await checkPermission(req, PERMS.VIEW_REPORTS);
    if (!hasViewPerm) {
      return res.status(403).json({ error: { message: "Forbidden: Permission required to view journal entries", status: 403 } });
    }
  }
  if (method === "GET") {
    const { subsidiary, limit = "100", page = "1", type } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = { ...getDeletedFilter(req.query) };
    if (subsidiary && subsidiary !== "Global") {
      whereClause.subsidiary = subsidiary;
    }
    if (type) {
      // Support comma-separated types (e.g. "BP,CP")
      const types = String(type).split(',').map((t) => t.trim()).filter(Boolean);
      whereClause.voucherType = types.length === 1 ? types[0] : { in: types };
    }
    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where: whereClause,
        include: {
          lines: {
            include: { account: true }
          },
          donationReceived: {
            include: { donor: true }
          },
          zakatCard: {
            include: { member: true, beneficiary: true }
          },
          revenueCollection: true,
          addIncomeRecord: {
            include: { category: true }
          },
          pettyCashTransaction: {
            include: { pettyCashAccount: true, expenseHead: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.journalEntry.count({ where: whereClause })
    ]);
    const formatted = entries.map((je) => ({
      id: je.voucherNo,
      dbId: je.id,
      voucherNo: je.voucherNo,
      postingDate: je.postingDate.toISOString().split("T")[0],
      subsidiary: je.subsidiary,
      reference: je.reference,
      description: je.description,
      postedBy: je.postedBy,
      status: je.status,
      voucherType: je.voucherType,
      donationReceived: je.donationReceived,
      zakatCard: je.zakatCard,
      revenueCollection: je.revenueCollection,
      addIncomeRecord: je.addIncomeRecord,
      pettyCashTransaction: je.pettyCashTransaction,
      lines: je.lines.map((line) => ({
        id: line.id,
        accountCode: line.account.glCode,
        accountName: line.account.accountName,
        description: line.description,
        debit: line.debit,
        credit: line.credit
      }))
    }));
    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "POST") {
    const { voucherNo, postingDate, subsidiary, reference, description, status = "Draft", lines, voucherType = "JV" } = req.body;
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: { message: "Lines are required", status: 400 } });
    }
    const isAdjustment = voucherType === "ADJUSTMENT" || reference && reference.toUpperCase().includes("ADJUSTMENT");
    if (isAdjustment && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin may perform manual balance adjustment entries", status: 403 } });
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const payloadLines = lines.map((l) => ({
          accountCode: l.accountCode,
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || description || reference
        }));
        return await AccountingService.postTransaction(tx, {
          voucherNo: voucherNo || void 0,
          postingDate: postingDate ? new Date(postingDate) : /* @__PURE__ */ new Date(),
          subsidiary: subsidiary || "Global",
          reference: reference || "Journal Entry",
          description: description || "Journal Entry",
          module: "Journal Entries",
          voucherType,
          postedBy: req.user?.id || "system",
          status,
          lines: payloadLines,
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"]
        });
      }, accountingTxOptions);
      return res.status(201).json({ status: 201, data: result.journalEntry });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }
  if (method === "PATCH" || method === "PUT") {
    const { id, status, reference, description, postingDate, amount, lines } = req.body;
    const targetId = id || req.query.id;
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      if (!targetId) {
        return res.status(400).json({ error: { message: "Missing journal entry id", status: 400 } });
      }
      const existing = await prisma.journalEntry.findUnique({ where: { id: targetId }, include: { lines: true } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Journal entry not found", status: 404 } });
      }
      const restored = await prisma.$transaction(async (tx) => {
        if (existing.status === "Posted") {
          const creditByAccount = /* @__PURE__ */ new Map();
          for (const l of existing.lines) {
            const credit = new Prisma.Decimal(l.credit ?? 0);
            if (credit.greaterThan(0)) {
              creditByAccount.set(l.accountId, (creditByAccount.get(l.accountId) ?? new Prisma.Decimal(0)).plus(credit));
            }
          }
          for (const [accountId, requiredAmount] of creditByAccount) {
            await FundValidationService.validateAndLockFunds(tx, {
              accountId,
              requiredAmount: requiredAmount.toNumber(),
              module: "Journal Entries (Restore)",
              userId: req.user.id,
              ipAddress: req.headers["x-forwarded-for"],
              userAgent: req.headers["user-agent"]
            });
          }
        }
        const je = await tx.journalEntry.update({
          where: { id: targetId },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        });
        await AccountingService.recalculateBalancesForJournalEntry(tx, targetId);
        return je;
      }, accountingTxOptions);
      await logAudit(req.user.id, "Restore Journal Entry", "Journal Entries", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Journal entry restored successfully", data: restored });
    }
    if (!targetId) {
      return res.status(400).json({ error: { message: "Missing journal entry id", status: 400 } });
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const je = await tx.journalEntry.findUnique({
          where: { id },
          include: { lines: true }
        });
        if (!je) throw new Error("Journal entry not found");
        const accountsBefore = je.lines.map((l) => l.accountId);
        const isStatusChangeOnly = status && status !== je.status && reference === void 0 && description === void 0 && postingDate === void 0 && amount === void 0 && !lines;
        if (isStatusChangeOnly) {
          if (je.status === status) return je;
          if (je.status === "Draft" && status === "Posted") {
            return await AccountingService.postDraft(tx, id, req.user.id);
          }
          if (je.status === "Posted" && status === "Cancelled") {
            return await AccountingService.reverseJournalEntry(tx, id, req.user.id, req.body.reason);
          }
          if (je.status === "Cancelled") {
            return await AccountingService.restoreCancelledJournalEntry(tx, id, status, req.user.id);
          }
          const updatedJe = await tx.journalEntry.update({
            where: { id },
            data: { status }
          });
          await AccountingService.recalculateBalancesForJournalEntry(tx, id);
          return updatedJe;
        }
        const newDate = postingDate ? new Date(postingDate) : je.postingDate;
        const newRef = reference !== void 0 ? reference : je.reference;
        const newDesc = description !== void 0 ? description : je.description;
        const newStatus = status || je.status;
        let plannedLines = null;
        let mode = null;
        if (amount !== void 0 && !lines && je.lines.length > 0) {
          mode = "amount";
          const numAmount = Number(amount);
          if (!Number.isFinite(numAmount) || numAmount <= 0) {
            throw new Error("Accounting Engine Error: Amount must be a positive number.");
          }
          plannedLines = je.lines.map((l) => ({
            id: l.id,
            accountId: l.accountId,
            // l.debit/l.credit are Prisma Decimals; compare with Decimal ops
            // rather than JS `>` so the check is exact.
            debit: new Prisma.Decimal(l.debit).gt(0) ? numAmount : Number(l.debit),
            credit: new Prisma.Decimal(l.credit).gt(0) ? numAmount : Number(l.credit),
            description: newDesc !== void 0 ? newDesc : l.description
          }));
          const plannedDebit = plannedLines.reduce((sum, l) => sum.plus(new Prisma.Decimal(l.debit)), new Prisma.Decimal(0));
          const plannedCredit = plannedLines.reduce((sum, l) => sum.plus(new Prisma.Decimal(l.credit)), new Prisma.Decimal(0));
          if (!plannedDebit.equals(plannedCredit)) {
            throw new Error(`Accounting Engine Error: Transaction must follow Double Entry Accounting. Total Debit (${plannedDebit.toFixed(2)}) does not equal Total Credit (${plannedCredit.toFixed(2)}).`);
          }
        } else if (lines && Array.isArray(lines) && lines.length > 0) {
          mode = "lines";
          if (lines.length < 2) {
            throw new Error("Accounting Engine Error: Transaction must contain at least two accounting lines for double-entry posting.");
          }
          let totalDebit = new Prisma.Decimal(0);
          let totalCredit = new Prisma.Decimal(0);
          for (const l of lines) {
            const debitVal = new Prisma.Decimal(l.debit ?? 0);
            const creditVal = new Prisma.Decimal(l.credit ?? 0);
            if (debitVal.isNegative() || creditVal.isNegative()) {
              throw new Error("Accounting Engine Error: Debit and Credit amounts cannot be negative.");
            }
            if (!l.accountId) {
              throw new Error("Accounting Engine Error: Every line must reference an account.");
            }
            totalDebit = totalDebit.plus(debitVal);
            totalCredit = totalCredit.plus(creditVal);
          }
          if (!totalDebit.equals(totalCredit)) {
            throw new Error(`Accounting Engine Error: Transaction must follow Double Entry Accounting. Total Debit (${totalDebit.toFixed(2)}) does not equal Total Credit (${totalCredit.toFixed(2)}).`);
          }
          if (totalDebit.lte(0)) {
            throw new Error("Accounting Engine Error: Transaction amount must be greater than zero.");
          }
          plannedLines = lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || newDesc || newRef || je.description
          }));
        }
        if (plannedLines && newStatus === "Posted") {
          const oldCreditByAccount = /* @__PURE__ */ new Map();
          if (je.status === "Posted") {
            for (const l of je.lines) {
              const credit = new Prisma.Decimal(l.credit ?? 0);
              if (credit.greaterThan(0)) {
                oldCreditByAccount.set(l.accountId, (oldCreditByAccount.get(l.accountId) ?? new Prisma.Decimal(0)).plus(credit));
              }
            }
          }
          const newCreditByAccount = /* @__PURE__ */ new Map();
          for (const l of plannedLines) {
            const credit = new Prisma.Decimal(l.credit ?? 0);
            if (credit.greaterThan(0)) {
              newCreditByAccount.set(l.accountId, (newCreditByAccount.get(l.accountId) ?? new Prisma.Decimal(0)).plus(credit));
            }
          }
          for (const [accountId, newCredit] of newCreditByAccount) {
            const delta = newCredit.minus(oldCreditByAccount.get(accountId) ?? new Prisma.Decimal(0));
            if (delta.greaterThan(0)) {
              await FundValidationService.validateAndLockFunds(tx, {
                accountId,
                requiredAmount: delta.toNumber(),
                module: "Journal Entries",
                userId: req.user.id,
                ipAddress: req.headers["x-forwarded-for"],
                userAgent: req.headers["user-agent"]
              });
            }
          }
        }
        await tx.journalEntry.update({
          where: { id },
          data: {
            postingDate: newDate,
            reference: newRef,
            description: newDesc !== void 0 ? newDesc || null : void 0,
            status: newStatus
          }
        });
        if (mode === "amount" && plannedLines) {
          for (const l of plannedLines) {
            await tx.journalEntryLine.update({
              where: { id: l.id },
              data: { debit: l.debit, credit: l.credit, description: l.description }
            });
          }
        } else if (mode === "lines" && plannedLines) {
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: je.id }
          });
          for (const l of plannedLines) {
            await tx.journalEntryLine.create({
              data: {
                journalEntryId: je.id,
                accountId: l.accountId,
                description: l.description,
                debit: l.debit,
                credit: l.credit
              }
            });
          }
        }
        for (const accountId of /* @__PURE__ */ new Set([...accountsBefore, ...(await tx.journalEntryLine.findMany({
          where: { journalEntryId: je.id },
          select: { accountId: true }
        })).map((l) => l.accountId)])) {
          await AccountingService.recalculateAccountBalance(tx, accountId);
        }
        return await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
      }, accountingTxOptions);
      await logAudit(req.user.id, "Update Journal Entry", "Journal Entries", null, { id, status, reference, amount }, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
    }
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Journal Entry ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid ID provided", status: 400 } });
    }
    try {
      const deletedEntries = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const id of ids) {
          if (isPermanent) {
            const resJe = await AccountingService.deleteJournalEntry(tx, id, req.user.id, "Admin Permanently Deleted");
            if (resJe) results.push(resJe);
          } else {
            const resJe = await tx.journalEntry.update({
              where: { id },
              data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
            });
            await AccountingService.recalculateBalancesForJournalEntry(tx, id);
            if (resJe) results.push(resJe);
          }
        }
        return results;
      }, accountingTxOptions);
      await logAudit(
        req.user.id,
        "Delete Journal Entry",
        "Journal Entries",
        null,
        { count: deletedEntries.length, ids: deletedEntries.map((e) => e.id) },
        req.headers["x-forwarded-for"],
        req.headers["user-agent"]
      );
      return res.status(200).json({
        status: 200,
        message: `${deletedEntries.length} journal entry(s) deleted successfully`,
        data: deletedEntries
      });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  journal_entries_default as default
};
