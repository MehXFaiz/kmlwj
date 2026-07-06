import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    const incomes = await prisma.simpleIncome.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        revenueHead: true,
        createdBy: { select: { fullName: true } }
      }
    });

    return res.status(200).json({ status: 200, data: incomes });
  }

  if (req.method === 'POST') {
    const { date, revenueHeadId, description, amount, paymentMethod, bankAccountId, reference } = req.body;

    if (!revenueHeadId || !amount) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    // Begin transaction to create SimpleIncome and corresponding JournalEntry
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get Revenue Head account code
      const revenueHead = await tx.revenueHead.findUnique({
        where: { id: revenueHeadId },
        include: { subsidiaryAccount: true }
      });

      if (!revenueHead || !revenueHead.subsidiaryAccount) {
        throw new Error('Revenue head or associated account not found');
      }

      // 2. Determine Debit Account (Cash or Bank)
      let debitAccountCode;
      if (paymentMethod === 'BANK' && bankAccountId) {
        const bankAcc = await tx.account.findUnique({ where: { id: bankAccountId } });
        if (!bankAcc) throw new Error('Bank account not found');
        debitAccountCode = bankAcc.code;
      } else {
        // Find default cash account (Assuming 1000000 series, find one named Cash)
        const cashAcc = await tx.account.findFirst({
          where: { name: { contains: 'Cash', mode: 'insensitive' }, type: 'Asset' }
        });
        if (!cashAcc) throw new Error('Cash account not found. Please create a Cash account first.');
        debitAccountCode = cashAcc.code;
      }

      // 3. Create Journal Entry
      // Income Journal: Debit Asset (Cash/Bank), Credit Revenue
      const journalEntry = await tx.journalEntry.create({
        data: {
          date: new Date(date),
          reference: reference || 'Income Receipt',
          description: description || `Income from ${revenueHead.name}`,
          status: 'POSTED', // Auto-post simple incomes for operators
          createdById: req.user!.id,
          lines: {
            create: [
              { accountCode: debitAccountCode, debit: amount, credit: 0, description },
              { accountCode: revenueHead.subsidiaryAccount.code, debit: 0, credit: amount, description }
            ]
          }
        }
      });

      // 4. Create SimpleIncome record
      const income = await tx.simpleIncome.create({
        data: {
          date: new Date(date),
          revenueHeadId,
          description,
          amount,
          paymentMethod,
          bankAccountId,
          reference,
          journalEntryId: journalEntry.id,
          createdById: req.user!.id
        },
        include: { revenueHead: true }
      });

      // 5. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'Create Simple Income',
          module: 'Income',
          details: `Added income of ${amount} for ${revenueHead.name}`
        }
      });

      return income;
    });

    return res.status(201).json({ status: 201, data: result });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
