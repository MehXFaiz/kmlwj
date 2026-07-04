import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
var donations_received_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    const search = req.query.search || "";
    const status = req.query.status;
    const donationType = req.query.donationType;
    const paymentMethod = req.query.paymentMethod;
    const donorId = req.query.donorId;
    const whereClause = {};
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
        { donor: { fullName: { contains: search, mode: "insensitive" } } }
      ];
    }
    const donations = await prisma.donationReceived.findMany({
      where: whereClause,
      include: {
        donor: true,
        cashAccount: true,
        bankAccount: true,
        journalEntry: true,
        createdBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { receiptDate: "desc" }
    });
    const totalAmount = donations.filter((d) => d.status === "POSTED").reduce((sum, d) => sum + (d.amount || 0), 0);
    const cashAmount = donations.filter((d) => d.status === "POSTED" && d.paymentMethod === "CASH").reduce((sum, d) => sum + (d.amount || 0), 0);
    const bankAmount = donations.filter((d) => d.status === "POSTED" && d.paymentMethod !== "CASH").reduce((sum, d) => sum + (d.amount || 0), 0);
    return res.status(200).json({
      status: 200,
      data: donations,
      stats: {
        totalAmount,
        cashAmount,
        bankAmount,
        totalReceipts: donations.length
      }
    });
  }
  if (method === "POST") {
    const {
      receiptDate,
      donorId,
      donationType,
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
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: "Amount must be a positive number", status: 400 } });
    }
    const donor = await prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      return res.status(404).json({ error: { message: "Selected donor not found", status: 404 } });
    }
    let debitAccountId = null;
    if (paymentMethod === "CASH") {
      if (cashAccountId) {
        debitAccountId = cashAccountId;
      } else {
        const defaultCash = await prisma.account.findFirst({
          where: { accountName: { contains: "Cash", mode: "insensitive" } }
        });
        if (!defaultCash) return res.status(400).json({ error: { message: "No Cash account specified or found in Chart of Accounts", status: 400 } });
        debitAccountId = defaultCash.id;
      }
    } else {
      if (!bankAccountId) {
        const defaultBank = await prisma.account.findFirst({
          where: { accountName: { contains: "Bank", mode: "insensitive" } }
        });
        if (!defaultBank) return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque/Online payments", status: 400 } });
        debitAccountId = defaultBank.id;
      } else {
        debitAccountId = bankAccountId;
      }
    }
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const count = await prisma.donationReceived.count();
    const nextNum = (count + 1).toString().padStart(4, "0");
    const receiptNo = `REC-${year}-${nextNum}`;
    const txStatus = status === "DRAFT" ? "DRAFT" : "POSTED";
    const result = await prisma.$transaction(async (tx) => {
      let journalEntryId = null;
      if (txStatus === "POSTED") {
        const postingResult = await AccountingService.postReceipt(tx, {
          amount: parsedAmount,
          cashOrBankAccountId: debitAccountId,
          incomeAccountKeyword: donationType,
          reference: receiptNo,
          description: narration || `Received ${donationType} from ${donor.fullName} (${donor.donorCode})`,
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
    await logAudit(req.user.id, "Create Donation Received", "DONATION_RECEIVED", null, result, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: result });
  }
  if (method === "PUT" || method === "PATCH") {
    if (!id) return res.status(400).json({ error: { message: "Receipt ID is required", status: 400 } });
    const existing = await prisma.donationReceived.findUnique({
      where: { id },
      include: { donor: true }
    });
    if (!existing) return res.status(404).json({ error: { message: "Donation receipt not found", status: 404 } });
    const { status, narration, referenceNo, chequeNo, chequeDate } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      let journalEntryId = existing.journalEntryId;
      let newStatus = status !== void 0 ? status : existing.status;
      if (existing.status === "DRAFT" && newStatus === "POSTED") {
        const debitAccountId = existing.cashAccountId || existing.bankAccountId;
        if (!debitAccountId) throw new Error("No Cash/Bank account linked to this receipt");
        const postingResult = await AccountingService.postReceipt(tx, {
          amount: existing.amount,
          cashOrBankAccountId: debitAccountId,
          incomeAccountKeyword: existing.donationType,
          reference: existing.receiptNo,
          description: narration || existing.narration || `Received ${existing.donationType} from ${existing.donor.fullName}`,
          module: "Donations Received",
          postedBy: req.user.id,
          postingDate: existing.receiptDate,
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"],
          voucherType: "BR"
        });
        if (postingResult && postingResult.journalEntry) {
          journalEntryId = postingResult.journalEntry.id;
        }
      } else if (existing.status === "POSTED" && newStatus === "CANCELLED") {
        if (existing.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Donation Receipt Cancelled");
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
          chequeDate: chequeDate !== void 0 ? chequeDate ? new Date(chequeDate) : null : void 0
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
    if (!id) return res.status(400).json({ error: { message: "Receipt ID is required", status: 400 } });
    const existing = await prisma.donationReceived.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: { message: "Donation receipt not found", status: 404 } });
    await prisma.$transaction(async (tx) => {
      if (existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, "Donation Receipt Deleted");
        } catch (e) {
        }
      }
      await tx.donationReceived.delete({ where: { id } });
    });
    await logAudit(req.user.id, "Delete Donation Received", "DONATION_RECEIVED", existing, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Donation receipt deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  donations_received_default as default
};
