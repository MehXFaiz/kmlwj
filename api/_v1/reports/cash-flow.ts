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

    // 1. Fetch cash and bank subsidiary accounts
    const cashBankAccounts = await prisma.account.findMany({
      where: {
        type: 'ASSET',
        detailType: 'Subsidiary',
        OR: [
          { accountName: { contains: 'bank', mode: 'insensitive' } },
          { accountName: { contains: 'cash', mode: 'insensitive' } },
        ]
      },
      include: {
        accountType: true
      }
    });

    const cashBankCodes = new Set(cashBankAccounts.map(a => a.glCode));
    const beginningCash = cashBankAccounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);

    // 2. Fetch all posted journal entries and analyze transactions
    const postedJournals = await prisma.journalEntry.findMany({
      where: {
        status: 'Posted',
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
      const debitSum = cashLines.reduce((sum, l) => sum + l.debit, 0);
      const creditSum = cashLines.reduce((sum, l) => sum + l.credit, 0);
      const netCashChange = debitSum - creditSum;

      if (netCashChange > 0) {
        // Cash Inflow: associate with the credit offset accounts
        nonCashLines.forEach((l) => {
          if (l.credit > 0) {
            const name = l.account.accountName;
            inflowsMap[name] = (inflowsMap[name] || 0) + l.credit;
          }
        });
      } else if (netCashChange < 0) {
        // Cash Outflow: associate with the debit offset accounts
        nonCashLines.forEach((l) => {
          if (l.debit > 0) {
            const name = l.account.accountName;
            outflowsMap[name] = (outflowsMap[name] || 0) + l.debit;
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

    const totalInflow = inflows.reduce((sum, item) => sum + item.amount, 0);
    const totalOutflow = outflows.reduce((sum, item) => sum + item.amount, 0);
    const netChange = totalInflow - totalOutflow;
    const endingCash = beginningCash + netChange;

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
