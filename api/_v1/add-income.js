import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { AccountingService } from "../_services/accounting.service.js";
import { validateAmount } from "../_utils/amount.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
import { logAudit } from "../_utils/audit.js";
const accountingTxOptions = { maxWait: 1e4, timeout: 3e4 };
var add_income_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const idParam = req.query.id || req.body?.id;
  const action = req.query.action || req.body?.action;
  const isAdminOrSuperAdmin = req.user.role === "Admin" || req.user.role === "Super Admin" || await isSuperAdmin(req);
  if (method === "GET") {
    const { categoryId, paymentMethod, startDate, endDate, search, page, limit } = req.query;
    const whereClause = getDeletedFilter(req.query);
    if (categoryId && categoryId !== "all") {
      whereClause.categoryId = categoryId;
    }
    if (paymentMethod && paymentMethod !== "all") {
      whereClause.paymentMethod = paymentMethod.toUpperCase();
    }
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }
    if (search && search.trim()) {
      const queryStr = search.trim();
      whereClause.OR = [
        { referenceNumber: { contains: queryStr, mode: "insensitive" } },
        { remarks: { contains: queryStr, mode: "insensitive" } },
        { category: { name: { contains: queryStr, mode: "insensitive" } } },
        { bankAccount: { accountName: { contains: queryStr, mode: "insensitive" } } }
      ];
      const numVal = parseFloat(queryStr);
      if (!isNaN(numVal)) {
        whereClause.OR.push({ amount: numVal });
      }
    }
    const pageNum = parseInt(page || "1", 10);
    const limitNum = parseInt(limit || "50", 10);
    const skip = (pageNum - 1) * limitNum;
    const [total, records] = await Promise.all([
      prisma.addIncomeRecord.count({ where: whereClause }),
      prisma.addIncomeRecord.findMany({
        where: whereClause,
        orderBy: { date: "desc" },
        skip: isNaN(skip) ? void 0 : skip,
        take: isNaN(limitNum) ? void 0 : limitNum,
        include: {
          category: true,
          bankAccount: { select: { id: true, glCode: true, accountName: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          journalEntry: { select: { id: true, voucherNo: true, status: true } }
        }
      })
    ]);
    return res.status(200).json({
      status: 200,
      data: records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      if (!idParam) {
        return res.status(400).json({ error: { message: "Record ID is required", status: 400 } });
      }
      const existing = await prisma.addIncomeRecord.findUnique({ where: { id: idParam } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Income record not found", status: 404 } });
      }
      const restored = await prisma.addIncomeRecord.update({
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
      await logAudit(req.user.id, "Restore Income Record", "Add Income", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Income record restored successfully", data: restored });
    }
  }
  if (!isAdminOrSuperAdmin) {
    return res.status(403).json({ error: { message: "Forbidden: Only Admin and Super Admin can Add/Edit/Delete Income records", status: 403 } });
  }
  if (method === "POST") {
    const { categoryId, amount, date, paymentMethod, bankAccountId, referenceNumber, remarks, attachmentUrl } = req.body;
    if (!categoryId || amount === void 0 || amount === null) {
      return res.status(400).json({ error: { message: "Income Category and Amount are required fields", status: 400 } });
    }
    const normalizedPaymentMethod = (paymentMethod || "CASH").toUpperCase();
    if (normalizedPaymentMethod === "BANK" && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank Account is required when Payment Method is Bank", status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;
    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.incomeCategory.findUnique({
        where: { id: categoryId },
        include: { account: true }
      });
      if (!category) {
        throw new Error("Income Category not found");
      }
      const creditAccountId = category.accountId || category.account?.id;
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: numAmount,
        cashOrBankAccountId: (normalizedPaymentMethod === "BANK" || normalizedPaymentMethod === "ONLINE" || normalizedPaymentMethod === "CHEQUE") && bankAccountId ? bankAccountId : void 0,
        cashOrBankAccountKeyword: !(normalizedPaymentMethod === "BANK" && bankAccountId) ? "Cash" : void 0,
        incomeAccountId: creditAccountId || void 0,
        incomeAccountKeyword: !creditAccountId ? category.name || "Income" : void 0,
        description: remarks || `Income received for ${category.name}`,
        reference: referenceNumber || `Income Ref #${Date.now().toString().slice(-6)}`,
        module: "Add Income",
        postedBy: req.user.id,
        postingDate: date ? new Date(date) : /* @__PURE__ */ new Date(),
        ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"]
      });
      const incomeRecord = await tx.addIncomeRecord.create({
        data: {
          categoryId,
          amount: numAmount,
          date: date ? new Date(date) : /* @__PURE__ */ new Date(),
          paymentMethod: normalizedPaymentMethod,
          bankAccountId: bankAccountId || null,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          remarks: remarks ? remarks.trim() : null,
          attachmentUrl: attachmentUrl || null,
          journalEntryId: postingResult.journalEntry.id,
          createdById: req.user.id
        },
        include: {
          category: true,
          bankAccount: { select: { id: true, glCode: true, accountName: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          journalEntry: { select: { id: true, voucherNo: true, status: true } }
        }
      });
      await logAudit(req.user.id, "Create Income Record", "Add Income", null, incomeRecord, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return incomeRecord;
    }, accountingTxOptions);
    return res.status(201).json({ status: 201, message: "Income record created successfully", data: result });
  }
  if (method === "PUT") {
    const { id, categoryId, amount, date, paymentMethod, bankAccountId, referenceNumber, remarks, attachmentUrl } = req.body;
    const targetId = id || idParam;
    if (!targetId || !categoryId || amount === void 0) {
      return res.status(400).json({ error: { message: "Record ID, Income Category, and Amount are required", status: 400 } });
    }
    const normalizedPaymentMethod = (paymentMethod || "CASH").toUpperCase();
    if (normalizedPaymentMethod === "BANK" && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank Account is required when Payment Method is Bank", status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.addIncomeRecord.findUnique({
        where: { id: targetId },
        include: { category: true }
      });
      if (!existing) {
        throw new Error("Income record not found");
      }
      if (existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Income Record Updated");
        } catch (e) {
        }
      }
      const category = await tx.incomeCategory.findUnique({
        where: { id: categoryId },
        include: { account: true }
      });
      if (!category) {
        throw new Error("Income Category not found");
      }
      const creditAccountId = category.accountId || category.account?.id;
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: numAmount,
        cashOrBankAccountId: (normalizedPaymentMethod === "BANK" || normalizedPaymentMethod === "ONLINE" || normalizedPaymentMethod === "CHEQUE") && bankAccountId ? bankAccountId : void 0,
        cashOrBankAccountKeyword: !(normalizedPaymentMethod === "BANK" && bankAccountId) ? "Cash" : void 0,
        incomeAccountId: creditAccountId || void 0,
        incomeAccountKeyword: !creditAccountId ? category.name || "Income" : void 0,
        description: remarks || `Income received for ${category.name}`,
        reference: referenceNumber || `Income Ref #${Date.now().toString().slice(-6)}`,
        module: "Add Income",
        postedBy: req.user.id,
        postingDate: date ? new Date(date) : /* @__PURE__ */ new Date(),
        ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"]
      });
      const updatedRecord = await tx.addIncomeRecord.update({
        where: { id: targetId },
        data: {
          categoryId,
          amount: numAmount,
          date: date ? new Date(date) : /* @__PURE__ */ new Date(),
          paymentMethod: normalizedPaymentMethod,
          bankAccountId: bankAccountId || null,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          remarks: remarks ? remarks.trim() : null,
          attachmentUrl: attachmentUrl !== void 0 ? attachmentUrl : existing.attachmentUrl,
          journalEntryId: postingResult.journalEntry.id
        },
        include: {
          category: true,
          bankAccount: { select: { id: true, glCode: true, accountName: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          journalEntry: { select: { id: true, voucherNo: true, status: true } }
        }
      });
      await logAudit(req.user.id, "Update Income Record", "Add Income", existing, updatedRecord, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return updatedRecord;
    }, accountingTxOptions);
    return res.status(200).json({ status: 200, message: "Income record updated successfully", data: result });
  }
  if (method === "DELETE") {
    const targetId = String(req.query.id || req.body?.id || "");
    if (!targetId) {
      return res.status(400).json({ error: { message: "Income Record ID required", status: 400 } });
    }
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
    }
    await prisma.$transaction(async (tx) => {
      const existing = await tx.addIncomeRecord.findUnique({ where: { id: targetId } });
      if (!existing) return;
      if (existing.journalEntryId) {
        try {
          if (isPermanent) {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Income Record Permanently Deleted");
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
      if (isPermanent) {
        await tx.addIncomeRecord.delete({ where: { id: targetId } });
        await logAudit(req.user.id, "Permanent Delete Income Record", "Add Income", existing, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      } else {
        const updated = await tx.addIncomeRecord.update({
          where: { id: targetId },
          data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
        });
        await logAudit(req.user.id, "Delete Income Record", "Add Income", existing, updated, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      }
    }, accountingTxOptions);
    return res.status(200).json({ status: 200, message: "Income record deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  add_income_default as default
};
