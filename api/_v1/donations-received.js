import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { validateAmount } from "../_utils/amount.js";
import { isWithinMaxLength, maxLengthError } from "../_utils/text-length.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
function donationTitleFragment(donationType, customType) {
  const map = {
    ZAKAT: "Zakat",
    FITRA: "Fitra",
    SADQA: "Sadqa",
    QURBANI: "Qurbani",
    GENERAL_DONATION: "General Donation",
    HALL_DONATION: "Hall Donation",
    MARRIAGE_DONATION: "Marriage Donation",
    BUILDING_FUND: "Building Fund",
    MEDICAL_DONATION: "Medical Donation",
    EDUCATION_DONATION: "Education Donation",
    MONTHLY: "Monthly Donation",
    MARRIAGE: "Marriage",
    MEDICAL: "Medical",
    EMERGENCY: "Emergency",
    EDUCATION: "Education",
    CUSTOM: customType || "Custom"
  };
  return map[donationType] || "Donation";
}
function isUniqueViolation(err) {
  return err?.code === "P2002";
}
var donations_received_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    if (!await verifyPermission(req, res, PERMS.MANAGE_DONATIONS)) return;
    const search = req.query.search || "";
    const status = req.query.status;
    const donationType = req.query.donationType;
    const paymentMethod = req.query.paymentMethod;
    const donorId = req.query.donorId;
    const whereClause = { ...getDeletedFilter(req.query) };
    if (status) whereClause.status = status;
    if (donationType) whereClause.donationType = donationType;
    if (paymentMethod) whereClause.paymentMethod = paymentMethod;
    if (donorId) whereClause.donorId = donorId;
    if (search) {
      whereClause.OR = [
        { receiptNo: { contains: search, mode: "insensitive" } },
        { referenceNo: { contains: search, mode: "insensitive" } },
        { chequeNo: { contains: search, mode: "insensitive" } },
        { narration: { contains: search, mode: "insensitive" } },
        { customDonationType: { contains: search, mode: "insensitive" } },
        { donor: { fullName: { contains: search, mode: "insensitive" } } }
      ];
    }
    const { limit = "100", page = "1" } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const [donations, total] = await Promise.all([
      prisma.donationReceived.findMany({
        where: whereClause,
        include: {
          donor: true,
          cashAccount: true,
          bankAccount: true,
          journalEntry: true,
          createdBy: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { receiptDate: "desc" },
        skip,
        take: limitNum
      }),
      prisma.donationReceived.count({ where: whereClause })
    ]);
    const [totalAgg, cashAgg] = await Promise.all([
      prisma.donationReceived.aggregate({
        where: { ...whereClause, status: "POSTED" },
        _sum: { amount: true }
      }),
      prisma.donationReceived.aggregate({
        where: { ...whereClause, status: "POSTED", paymentMethod: "CASH" },
        _sum: { amount: true }
      })
    ]);
    const totalAmount = totalAgg._sum.amount || 0;
    const cashAmount = cashAgg._sum.amount || 0;
    const bankAmount = totalAmount - cashAmount;
    return res.status(200).json({
      status: 200,
      data: donations,
      meta: { total, page: pageNum, limit: limitNum },
      stats: {
        totalAmount,
        cashAmount,
        bankAmount,
        totalReceipts: total
      }
    });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: "Receipt ID is required", status: 400 } });
      }
      const existing = await prisma.donationReceived.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Donation receipt not found", status: 404 } });
      }
      const restored = await prisma.donationReceived.update({
        where: { id: targetId },
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
      await logAudit(req.user.id, "Restore Donation Received", "DONATION_RECEIVED", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Donation receipt restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    if (!await verifyPermission(req, res, PERMS.RECORD_INCOME)) return;
    const {
      receiptDate,
      donorId,
      donationType,
      customDonationType,
      amount,
      paymentMethod,
      cashAccountId,
      bankAccountId,
      chequeNo,
      chequeDate,
      referenceNo,
      narration,
      status
    } = req.body;
    if (!donorId || !donationType || amount === void 0 || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields (donorId, donationType, amount, paymentMethod)", status: 400 } });
    }
    if (donationType === "CUSTOM" && (!customDonationType || !customDonationType.trim())) {
      return res.status(400).json({ error: { message: "Custom Donation Type is required when CUSTOM is selected", status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    if (!isWithinMaxLength(narration, 1e3)) return res.status(400).json({ error: maxLengthError("Narration", 1e3) });
    if (!isWithinMaxLength(referenceNo, 100)) return res.status(400).json({ error: maxLengthError("Reference number", 100) });
    if (!isWithinMaxLength(chequeNo, 30)) return res.status(400).json({ error: maxLengthError("Cheque number", 30) });
    const parsedAmount = amountCheck.amount;
    const donor = await prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      return res.status(404).json({ error: { message: "Selected donor not found", status: 404 } });
    }
    let debitAccountId = null;
    if (paymentMethod === "CASH") {
      const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
      debitAccountId = cashAccount.id;
    } else {
      if (!bankAccountId) {
        const defaultBank = await prisma.account.findFirst({
          where: {
            accountName: { contains: "Bank", mode: "insensitive" },
            children: { none: {} },
            isLocked: false
          },
          orderBy: { glCode: "asc" }
        });
        if (!defaultBank) return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque/Online payments", status: 400 } });
        debitAccountId = defaultBank.id;
      } else {
        debitAccountId = bankAccountId;
      }
    }
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const receiptPrefix = `REC-${year}-`;
    async function nextReceiptNo(tx) {
      const existing = await tx.donationReceived.findMany({
        where: { receiptNo: { startsWith: receiptPrefix } },
        select: { receiptNo: true }
      });
      const maxNum = existing.reduce((max, r) => {
        const n = parseInt(r.receiptNo.slice(receiptPrefix.length), 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
      return `${receiptPrefix}${String(maxNum + 1).padStart(4, "0")}`;
    }
    const txStatus = status === "POSTED" ? "POSTED" : "DRAFT";
    let result;
    for (let attempt = 1; ; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const receiptNo = await nextReceiptNo(tx);
          let journalEntryId = null;
          if (txStatus === "POSTED") {
            const isGeneralDonation = donationType === "CUSTOM" || donationType === "GENERAL_DONATION";
            const generalDonationAccount = isGeneralDonation ? await AccountingService.ensureGeneralDonationAccount(tx) : null;
            const postingResult = await AccountingService.postReceipt(tx, {
              amount: parsedAmount,
              cashOrBankAccountId: debitAccountId,
              incomeAccountId: generalDonationAccount ? generalDonationAccount.id : void 0,
              incomeAccountKeyword: generalDonationAccount ? void 0 : donationType,
              reference: receiptNo,
              description: narration || `Received ${donationType === "CUSTOM" ? customDonationType : donationType} from ${donor.fullName} (${donor.donorCode})`,
              module: "Donations Received",
              postedBy: req.user.id,
              postingDate: receiptDate || /* @__PURE__ */ new Date(),
              ipAddress: req.headers["x-forwarded-for"],
              userAgent: req.headers["user-agent"],
              voucherType: "BR"
            });
            if (postingResult && postingResult.journalEntry) {
              journalEntryId = postingResult.journalEntry.id;
            }
          }
          const newReceipt = await tx.donationReceived.create({
            data: {
              receiptNo,
              receiptDate: receiptDate ? new Date(receiptDate) : /* @__PURE__ */ new Date(),
              donorId,
              donationType,
              customDonationType: donationType === "CUSTOM" ? customDonationType : null,
              amount: parsedAmount,
              paymentMethod,
              cashAccountId: paymentMethod === "CASH" ? debitAccountId : null,
              bankAccountId: paymentMethod !== "CASH" ? debitAccountId : null,
              chequeNo: chequeNo || null,
              chequeDate: chequeDate ? new Date(chequeDate) : null,
              referenceNo: referenceNo || null,
              narration: narration || null,
              journalEntryId,
              status: txStatus,
              createdById: req.user.id
            },
            include: {
              donor: true,
              cashAccount: true,
              bankAccount: true,
              journalEntry: true
            }
          });
          return newReceipt;
        });
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 5 && err.meta?.target?.includes("receiptNo")) {
          continue;
        }
        throw err;
      }
    }
    await logAudit(req.user.id, "Create Donation Received", "DONATION_RECEIVED", null, result, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: result });
  }
  if (method === "PUT" || method === "PATCH") {
    if (!await verifyPermission(req, res, PERMS.RECORD_INCOME)) return;
    if (!id) return res.status(400).json({ error: { message: "Receipt ID is required", status: 400 } });
    const existing = await prisma.donationReceived.findUnique({
      where: { id },
      include: { donor: true }
    });
    if (!existing) return res.status(404).json({ error: { message: "Donation receipt not found", status: 404 } });
    const { status, narration, referenceNo, chequeNo, chequeDate, amount, donorId, donationType, customDonationType, paymentMethod, receiptDate, cashAccountId, bankAccountId } = req.body;
    const finalDonationType = donationType !== void 0 ? donationType : existing.donationType;
    const finalCustomType = customDonationType !== void 0 ? customDonationType : existing.customDonationType;
    if (finalDonationType === "CUSTOM" && (!finalCustomType || !finalCustomType.trim())) {
      return res.status(400).json({ error: { message: "Custom Donation Type is required when CUSTOM is selected", status: 400 } });
    }
    if (!isWithinMaxLength(narration, 1e3)) return res.status(400).json({ error: maxLengthError("Narration", 1e3) });
    if (!isWithinMaxLength(referenceNo, 100)) return res.status(400).json({ error: maxLengthError("Reference number", 100) });
    if (!isWithinMaxLength(chequeNo, 30)) return res.status(400).json({ error: maxLengthError("Cheque number", 30) });
    let parsedAmount;
    if (amount !== void 0) {
      const amountCheck = validateAmount(amount);
      if (!amountCheck.valid) {
        return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
      }
      parsedAmount = amountCheck.amount;
    }
    const result = await prisma.$transaction(async (tx) => {
      let journalEntryId = existing.journalEntryId;
      let newStatus = status !== void 0 ? status : existing.status;
      if (newStatus === "POSTED") {
        if (existing.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Donation Receipt Updated");
          } catch (e) {
          }
        }
        let debitAccountId = null;
        const currentMethod = paymentMethod !== void 0 ? paymentMethod : existing.paymentMethod;
        if (currentMethod === "CASH") {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          debitAccountId = cashAccount.id;
        } else {
          debitAccountId = bankAccountId !== void 0 ? bankAccountId : existing.bankAccountId || existing.cashAccountId;
        }
        if (debitAccountId) {
          const updatedAmount = parsedAmount !== void 0 ? parsedAmount : existing.amount;
          const updatedType = donationType !== void 0 ? donationType : existing.donationType;
          const updatedCustomType = customDonationType !== void 0 ? customDonationType : existing.customDonationType;
          const updatedNarration = narration !== void 0 ? narration : existing.narration;
          const updatedDate = receiptDate !== void 0 ? new Date(receiptDate) : existing.receiptDate;
          const isGeneralDonation = updatedType === "CUSTOM" || updatedType === "GENERAL_DONATION";
          const generalDonationAccount = isGeneralDonation ? await AccountingService.ensureGeneralDonationAccount(tx) : null;
          const postingResult = await AccountingService.postReceipt(tx, {
            amount: updatedAmount,
            cashOrBankAccountId: debitAccountId,
            incomeAccountId: generalDonationAccount ? generalDonationAccount.id : void 0,
            incomeAccountKeyword: generalDonationAccount ? void 0 : updatedType,
            reference: existing.receiptNo,
            description: updatedNarration || `Received ${updatedType === "CUSTOM" ? updatedCustomType : updatedType} from ${existing.donor.fullName}`,
            module: "Donations Received",
            postedBy: req.user.id,
            postingDate: updatedDate,
            ipAddress: req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"],
            voucherType: "BR"
          });
          if (postingResult && postingResult.journalEntry) {
            journalEntryId = postingResult.journalEntry.id;
          }
        }
      } else if (existing.status === "POSTED" && newStatus !== "POSTED") {
        if (existing.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, `Donation Receipt status changed to ${newStatus}`);
            journalEntryId = null;
          } catch (e) {
          }
        }
      }
      const updated = await tx.donationReceived.update({
        where: { id },
        data: {
          status: newStatus,
          journalEntryId,
          narration: narration !== void 0 ? narration || null : void 0,
          referenceNo: referenceNo !== void 0 ? referenceNo || null : void 0,
          chequeNo: chequeNo !== void 0 ? chequeNo || null : void 0,
          chequeDate: chequeDate !== void 0 ? chequeDate ? new Date(chequeDate) : null : void 0,
          amount: parsedAmount !== void 0 ? parsedAmount : void 0,
          donorId: donorId !== void 0 ? donorId : void 0,
          donationType: donationType !== void 0 ? donationType : void 0,
          customDonationType: donationType !== void 0 ? donationType === "CUSTOM" ? customDonationType : null : customDonationType !== void 0 ? existing.donationType === "CUSTOM" ? customDonationType : null : void 0,
          paymentMethod: paymentMethod !== void 0 ? paymentMethod : void 0,
          receiptDate: receiptDate !== void 0 ? receiptDate ? new Date(receiptDate) : void 0 : void 0,
          cashAccountId: cashAccountId !== void 0 ? cashAccountId || null : void 0,
          bankAccountId: bankAccountId !== void 0 ? bankAccountId || null : void 0
        },
        include: {
          donor: true,
          cashAccount: true,
          bankAccount: true,
          journalEntry: true
        }
      });
      return updated;
    });
    await logAudit(req.user.id, "Update Donation Received", "DONATION_RECEIVED", existing, result, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: result });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
    }
    if (!await verifyPermission(req, res, PERMS.RECORD_INCOME)) return;
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Receipt ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid ID provided", status: 400 } });
    }
    const existingItems = await prisma.donationReceived.findMany({ where: { id: { in: ids } } });
    if (existingItems.length === 0) {
      return res.status(404).json({ error: { message: "Donation receipt(s) not found", status: 404 } });
    }
    await prisma.$transaction(async (tx) => {
      for (const item of existingItems) {
        if (item.journalEntryId) {
          try {
            if (isPermanent) {
              await AccountingService.deleteJournalEntry(tx, item.journalEntryId, req.user.id, "Donation Receipt Permanently Deleted");
            } else {
              await tx.journalEntry.update({
                where: { id: item.journalEntryId },
                data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
              });
              await AccountingService.recalculateBalancesForJournalEntry(tx, item.journalEntryId);
            }
          } catch (e) {
          }
        }
        if (isPermanent) {
          await tx.donationReceived.delete({ where: { id: item.id } });
        } else {
          await tx.donationReceived.update({
            where: { id: item.id },
            data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
          });
        }
      }
    });
    for (const item of existingItems) {
      await logAudit(req.user.id, "Delete Donation Received", "DONATION_RECEIVED", item, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    }
    return res.status(200).json({ status: 200, message: `${existingItems.length} donation receipt(s) deleted successfully` });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  donations_received_default as default
};
