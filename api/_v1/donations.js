import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
function generateVoucherNumber() {
  const date = /* @__PURE__ */ new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JV-${year}${month}-${randomStr}`;
}
var donations_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const action = req.query.action;
  if (method === "GET") {
    const donations = await prisma.donation.findMany({
      include: {
        beneficiary: true,
        bankAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.status(200).json({ status: 200, data: donations });
  }
  if (method === "POST") {
    if (action === "approve") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: "Donation ID is required", status: 400 } });
      const donation = await prisma.donation.findUnique({ where: { id }, include: { beneficiary: true } });
      if (!donation) return res.status(404).json({ error: { message: "Donation not found", status: 404 } });
      if (donation.status === "APPROVED") return res.status(400).json({ error: { message: "Donation is already approved", status: 400 } });
      const expenseAccount = await prisma.account.findFirst({
        where: { accountName: { contains: "Donation", mode: "insensitive" } }
      });
      if (!expenseAccount) return res.status(400).json({ error: { message: "Donation Expense account not found in Chart of Accounts", status: 400 } });
      let creditAccountId = null;
      if (donation.paymentMethod === "CASH") {
        const cashAccount = await prisma.account.findFirst({
          where: { accountName: { contains: "Cash", mode: "insensitive" } }
        });
        if (!cashAccount) return res.status(400).json({ error: { message: "Cash account not found in Chart of Accounts", status: 400 } });
        creditAccountId = cashAccount.id;
      } else {
        if (!donation.bankAccountId) return res.status(400).json({ error: { message: "Bank account is required for BANK/CHEQUE payments", status: 400 } });
        creditAccountId = donation.bankAccountId;
      }
      const result = await prisma.$transaction(async (tx) => {
        const approvedDonation = await tx.donation.update({
          where: { id },
          data: { status: "APPROVED" }
        });
        const voucherNo = generateVoucherNumber();
        const description = `Donation to ${donation.beneficiary.name} - ${donation.donationType}`;
        const postingDate = /* @__PURE__ */ new Date();
        const journalEntry = await tx.journalEntry.create({
          data: {
            voucherNo,
            postingDate,
            subsidiary: "Global",
            reference: `DON-${donation.id.substring(0, 8)}`,
            description,
            postedBy: req.user.id,
            status: "Posted",
            lines: {
              create: [
                { accountId: expenseAccount.id, debit: donation.amount, credit: 0, description: "Donation Expense" },
                { accountId: creditAccountId, debit: 0, credit: donation.amount, description: "Donation Payment" }
              ]
            }
          }
        });
        await tx.account.update({ where: { id: expenseAccount.id }, data: { currentBalance: { increment: donation.amount } } });
        await tx.account.update({ where: { id: creditAccountId }, data: { currentBalance: { decrement: donation.amount } } });
        await tx.ledgerEntry.createMany({
          data: [
            { accountId: expenseAccount.id, debit: donation.amount, credit: 0, reference: voucherNo, description, postingDate },
            { accountId: creditAccountId, debit: 0, credit: donation.amount, reference: voucherNo, description, postingDate }
          ]
        });
        return { approvedDonation, journalEntry };
      });
      await logAudit(req.user.id, "Approve Donation", "DONATION", donation, result.approvedDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result.approvedDonation, message: "Donation approved and journal entries created successfully" });
    }
    const { beneficiaryId, donationType, amount, paymentMethod, bankAccountId, chequeNumber, remarks } = req.body;
    if (!beneficiaryId || !donationType || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: { message: "Amount must be greater than 0", status: 400 } });
    }
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payment methods", status: 400 } });
    }
    if (paymentMethod === "CHEQUE" && !chequeNumber) {
      return res.status(400).json({ error: { message: "Cheque number is required for Cheque payment method", status: 400 } });
    }
    const newDonation = await prisma.donation.create({
      data: {
        beneficiaryId,
        donationType,
        amount: parseFloat(amount),
        paymentMethod,
        bankAccountId: bankAccountId || null,
        chequeNumber: chequeNumber || null,
        remarks: remarks || null,
        createdById: req.user.id
      }
    });
    await logAudit(req.user.id, "Create Donation", "DONATION", null, newDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newDonation });
  }
  if (method === "PUT") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: { message: "Donation ID is required", status: 400 } });
    const existingDonation = await prisma.donation.findUnique({ where: { id } });
    if (!existingDonation) return res.status(404).json({ error: { message: "Donation not found", status: 404 } });
    if (existingDonation.status !== "PENDING") return res.status(400).json({ error: { message: "Only pending donations can be updated", status: 400 } });
    const { beneficiaryId, donationType, amount, paymentMethod, bankAccountId, chequeNumber, remarks, status } = req.body;
    const updatedDonation = await prisma.donation.update({
      where: { id },
      data: {
        beneficiaryId: beneficiaryId || void 0,
        donationType: donationType || void 0,
        amount: amount !== void 0 ? parseFloat(amount) : void 0,
        paymentMethod: paymentMethod || void 0,
        bankAccountId: bankAccountId !== void 0 ? bankAccountId || null : void 0,
        chequeNumber: chequeNumber !== void 0 ? chequeNumber || null : void 0,
        remarks: remarks !== void 0 ? remarks || null : void 0,
        status: status || void 0
      }
    });
    await logAudit(req.user.id, "Update Donation", "DONATION", existingDonation, updatedDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedDonation });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  donations_default as default
};
