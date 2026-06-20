import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const q = (req.query.q as string || '').trim();

  if (method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  if (!q) {
    return res.status(200).json({ status: 200, data: { accounts: [], beneficiaries: [], donations: [], journalEntries: [] } });
  }

  // 1. Search Accounts
  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { glCode: { contains: q, mode: 'insensitive' } },
        { accountName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 10,
  });

  // 2. Search Beneficiaries
  const beneficiaries = await prisma.beneficiary.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { cnic: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 10,
  });

  // 3. Search Donations
  const donations = await prisma.donation.findMany({
    where: {
      OR: [
        { remarks: { contains: q, mode: 'insensitive' } },
        { donorBankName: { contains: q, mode: 'insensitive' } },
        { chequeNumber: { contains: q, mode: 'insensitive' } },
        { beneficiary: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    include: {
      beneficiary: true,
      bankAccount: true
    },
    take: 10,
  });

  // 4. Search Journal Entries
  const journalEntries = await prisma.journalEntry.findMany({
    where: {
      OR: [
        { voucherNo: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 10,
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
