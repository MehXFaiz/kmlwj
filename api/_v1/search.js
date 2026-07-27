import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
var search_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const q = (req.query.q || "").trim();
  if (method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  if (!q) {
    return res.status(200).json({ status: 200, data: { accounts: [], beneficiaries: [], donations: [], journalEntries: [] } });
  }
  const accounts = await prisma.account.findMany({
    where: {
      isDeleted: false,
      OR: [
        { glCode: { contains: q, mode: "insensitive" } },
        { accountName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
      ]
    },
    take: 10
  });
  const beneficiaries = await prisma.beneficiary.findMany({
    where: {
      isDeleted: false,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { cnic: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } }
      ]
    },
    take: 10
  });
  const donations = await prisma.donation.findMany({
    where: {
      isDeleted: false,
      OR: [
        { remarks: { contains: q, mode: "insensitive" } },
        { donorBankName: { contains: q, mode: "insensitive" } },
        { chequeNumber: { contains: q, mode: "insensitive" } },
        { beneficiary: { name: { contains: q, mode: "insensitive" } } }
      ]
    },
    include: {
      beneficiary: true,
      bankAccount: true
    },
    take: 10
  });
  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      isDeleted: false,
      OR: [
        { voucherNo: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
      ]
    },
    take: 10
  });
  const customers = await prisma.customer.findMany({
    where: {
      isDeleted: false,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } }
      ]
    },
    take: 10
  });
  const invoices = await prisma.invoice.findMany({
    where: {
      isDeleted: false,
      OR: [
        { invoiceNo: { contains: q, mode: "insensitive" } },
        { remarks: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } }
      ]
    },
    include: {
      customer: true
    },
    take: 10
  });
  return res.status(200).json({
    status: 200,
    data: {
      accounts,
      beneficiaries,
      donations,
      journalEntries,
      customers,
      invoices
    }
  });
});
export {
  search_default as default
};
