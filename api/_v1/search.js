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
      OR: [
        { voucherNo: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } }
      ]
    },
    take: 10
  });
  return res.status(200).json({
    status: 200,
    data: {
      accounts,
      beneficiaries,
      donations,
      journalEntries
    }
  });
});
export {
  search_default as default
};
