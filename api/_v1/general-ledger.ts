import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    const { startDate, endDate, accountId, glCode, page = '1', limit = '100' } = req.query as any;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    // Resolve Account
    let targetAccount = null;
    if (accountId) {
      targetAccount = await prisma.account.findUnique({ where: { id: accountId }, include: { accountType: true } });
    } else if (glCode) {
      targetAccount = await prisma.account.findUnique({ where: { glCode }, include: { accountType: true } });
    }

    if (!targetAccount && (accountId || glCode)) {
      return res.status(404).json({ error: { message: 'Account not found', status: 404 } });
    }

    // Build Where Clause for Entries within Date Range
    const entryWhere: any = {};
    if (targetAccount) {
      entryWhere.accountId = targetAccount.id;
    }
    
    if (startDate || endDate) {
      entryWhere.postingDate = {};
      if (startDate) entryWhere.postingDate.gte = new Date(startDate);
      if (endDate) entryWhere.postingDate.lte = new Date(endDate);
    }

    // Fetch entries
    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: entryWhere,
        include: { account: { select: { glCode: true, accountName: true, initialBalance: true } } },
        orderBy: { postingDate: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.ledgerEntry.count({ where: entryWhere })
    ]);

    // Calculate Opening Balance
    let openingBalance = 0;
    
    if (targetAccount) {
      openingBalance = targetAccount.initialBalance || 0;
      
      // Calculate net activity before startDate
      if (startDate) {
        const priorEntries = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: targetAccount.id,
            postingDate: { lt: new Date(startDate) }
          },
          _sum: { debit: true, credit: true }
        });
        
        const priorDebit = priorEntries._sum.debit || 0;
        const priorCredit = priorEntries._sum.credit || 0;
        
        const typeName = targetAccount.accountType?.name?.toUpperCase() || 'ASSET';
        
        // Debit normal accounts
        if (['ASSET', 'EXPENSE'].includes(typeName)) {
          openingBalance += (priorDebit - priorCredit);
        } else {
          // Credit normal accounts (LIABILITY, EQUITY, REVENUE)
          openingBalance += (priorCredit - priorDebit);
        }
      }
    } else if (entries.length > 0) {
        // If no specific account is filtered, we might just return 0 for opening balance
        // or we would need to calculate it for all accounts. We will return 0 to keep it simple
        // since an aggregated opening balance across all accounts should technically be 0 in a balanced ledger.
        openingBalance = 0;
    }

    // Calculate Debit and Credit totals within range
    let totalDebit = 0;
    let totalCredit = 0;

    const formattedEntries = entries.map(entry => {
      totalDebit += entry.debit;
      totalCredit += entry.credit;
      
      return {
        id: entry.id,
        date: entry.postingDate.toISOString().split('T')[0],
        glCode: entry.account.glCode,
        accountName: entry.account.accountName,
        reference: entry.reference,
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit
      };
    });

    let closingBalance = 0;
    if (targetAccount) {
        const typeName = targetAccount.accountType?.name?.toUpperCase() || 'ASSET';
        if (['ASSET', 'EXPENSE'].includes(typeName)) {
            closingBalance = openingBalance + totalDebit - totalCredit;
        } else {
            closingBalance = openingBalance + totalCredit - totalDebit;
        }
    }

    return res.status(200).json({
      status: 200,
      data: {
        account: targetAccount ? {
            glCode: targetAccount.glCode,
            name: targetAccount.accountName,
            type: targetAccount.accountType?.name || 'Unknown'
        } : null,
        summary: {
          openingBalance,
          totalDebit,
          totalCredit,
          closingBalance: targetAccount ? closingBalance : null
        },
        entries: formattedEntries
      },
      meta: { total, page: pageNum, limit: limitNum }
    });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
