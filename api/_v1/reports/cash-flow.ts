import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    // Enforce VIEW_REPORTS permission
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
    const isSuperAdmin = user?.role.name === 'Super Admin';

    if (!isSuperAdmin && !userPerms.includes('VIEW_REPORTS')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    // 1. Fetch cash and bank accounts dynamically
    const cashBankAccounts = await prisma.account.findMany({
      where: {
        accountType: { name: { in: ['Asset', 'ASSET'], mode: 'insensitive' } },
        OR: [
          { accountName: { contains: 'bank', mode: 'insensitive' } },
          { accountName: { contains: 'cash', mode: 'insensitive' } },
          { detailType: { in: ['Cash', 'Bank'], mode: 'insensitive' } }
        ]
      },
      include: {
        accountType: true
      }
    });

    const cashBankCodes = new Set(cashBankAccounts.map(a => a.glCode));
    const endingCash = cashBankAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance || 0), 0);

    // Optional date range filter — support ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
    const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // 2. Fetch all posted journal entries and analyze transactions
    const postedJournals = await prisma.journalEntry.findMany({
      where: {
        status: 'Posted',
        ...(Object.keys(dateFilter).length > 0 ? { postingDate: dateFilter } : {}),
      },
      include: {
        lines: {
          include: {
            account: {
              include: { accountType: true }
            }
          }
        }
      },
      orderBy: { postingDate: 'asc' },
    });

    const inflowsMap: Record<string, number> = {};
    const outflowsMap: Record<string, number> = {};

    postedJournals.forEach((je) => {
      // Find cash lines in this journal entry
      const cashLines = je.lines.filter(l => cashBankCodes.has(l.account.glCode));
      const nonCashLines = je.lines.filter(l => !cashBankCodes.has(l.account.glCode));

      if (cashLines.length === 0 || nonCashLines.length === 0) return;

      // Net impact on cash/bank in this entry
      const debitSum = cashLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const creditSum = cashLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
      const netCashChange = debitSum - creditSum;

      if (netCashChange > 0) {
        // Cash Inflow: associate with the credit offset accounts
        const totalNonCashCredit = nonCashLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
        nonCashLines.forEach((l) => {
          if (l.credit > 0) {
            const ratio = totalNonCashCredit > 0 ? Number(l.credit) / totalNonCashCredit : 1;
            const amount = Math.round(netCashChange * ratio * 100) / 100;
            const name = l.account.accountName;
            inflowsMap[name] = (inflowsMap[name] || 0) + amount;
          }
        });
      } else if (netCashChange < 0) {
        // Cash Outflow: associate with the debit offset accounts
        const absChange = Math.abs(netCashChange);
        const totalNonCashDebit = nonCashLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
        nonCashLines.forEach((l) => {
          if (l.debit > 0) {
            const ratio = totalNonCashDebit > 0 ? Number(l.debit) / totalNonCashDebit : 1;
            const amount = Math.round(absChange * ratio * 100) / 100;
            const name = l.account.accountName;
            outflowsMap[name] = (outflowsMap[name] || 0) + amount;
          }
        });
      }
    });

    const inflows = Object.entries(inflowsMap).map(([name, amount]) => ({
      accountName: name,
      amount
    }));

    const outflows = Object.entries(outflowsMap).map(([name, amount]) => ({
      accountName: name,
      amount
    }));

    const totalInflow = Math.round(inflows.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
    const totalOutflow = Math.round(outflows.reduce((sum, o) => sum + o.amount, 0) * 100) / 100;
    const netChange = Math.round((totalInflow - totalOutflow) * 100) / 100;
    const beginningCash = Math.round((endingCash - netChange) * 100) / 100;

    return res.status(200).json({
      status: 200,
      data: {
        inflows,
        outflows,
        summary: {
          beginningCash,
          totalInflow,
          totalOutflow,
          netChange,
          endingCash
        }
      }
    });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
