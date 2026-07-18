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

    // Optional date range filter
    const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

    // Fetch all accounts (including those with zero balance to avoid missing accounts)
    const allAccounts = await prisma.account.findMany({
      include: {
        accountType: true
      },
      orderBy: { glCode: 'asc' }
    });

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    
    let totalRevenue = 0;
    let totalExpense = 0;
    let openingRetainedEarnings = 0;

    for (const acc of allAccounts) {
      const type = acc.accountType?.name;
      let balance = acc.currentBalance;

      // If date range provided, compute balance from ledger entries in range
      // NOTE: For Balance Sheet (Balance/Asset/Liability/Equity accounts), we use cumulative
      // all-time balance up to endDate (not just the period). Revenue/Expense use period totals.
      if (type === 'REVENUE' || type === 'EXPENSE') {
        if (startDate || endDate) {
          const dateFilter: any = {};
          if (startDate) dateFilter.gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.lte = end;
          }
          const agg = await prisma.ledgerEntry.aggregate({
            where: { accountId: acc.id, postingDate: dateFilter },
            _sum: { debit: true, credit: true }
          });
          const d = Number(agg._sum.debit) || 0;
          const c = Number(agg._sum.credit) || 0;
          balance = type === 'REVENUE' ? (c - d) : (d - c);
        }
      } else {
        // For balance sheet items, use cumulative balance up to endDate
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const agg = await prisma.ledgerEntry.aggregate({
            where: { accountId: acc.id, postingDate: { lte: end } },
            _sum: { debit: true, credit: true }
          });
          const d = Number(agg._sum.debit) || 0;
          const c = Number(agg._sum.credit) || 0;
          const initialBal = Number(acc.initialBalance) || 0;
          const typeName = (type || '').toUpperCase();
          const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);
          balance = isDebitNormal ? initialBal + d - c : initialBal + c - d;
        }
      }

      // Skip accounts with no activity
      if (balance === 0) continue;
      
      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance
      };

      if (type === 'ASSET') {
        assets.push(formatted);
        totalAssets += balance;
      } else if (type === 'LIABILITY') {
        liabilities.push(formatted);
        totalLiabilities += balance;
      } else if (type === 'EQUITY') {
        equity.push(formatted);
        totalEquity += balance;
      } else if (type === 'REVENUE') {
        totalRevenue += balance;
      } else if (type === 'EXPENSE') {
        totalExpense += balance;
      }
    }

    if (startDate) {
      const start = new Date(startDate);

      for (const acc of allAccounts) {
        const typeName = (acc.accountType?.name || '').toUpperCase();
        if (!['REVENUE', 'EXPENSE'].includes(typeName)) continue;

        const priorAgg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: { lt: start }
          },
          _sum: { debit: true, credit: true }
        });

        const d = Number(priorAgg._sum.debit) || 0;
        const c = Number(priorAgg._sum.credit) || 0;
        openingRetainedEarnings += typeName === 'REVENUE' ? (c - d) : (d - c) * -1;
      }
    }

    // Net income is the P&L result for the period, added to equity section
    const netIncome = totalRevenue - totalExpense;
    totalEquity += openingRetainedEarnings;
    totalEquity += netIncome; // Add retained earnings to total equity

    if (openingRetainedEarnings !== 0) {
      equity.push({
        id: 'virtual-opening-retained-earnings',
        glCode: '-',
        accountName: startDate
          ? `Opening Retained Earnings (before ${startDate})`
          : 'Opening Retained Earnings',
        balance: Math.abs(openingRetainedEarnings),
        isRetainedEarnings: true,
        sign: openingRetainedEarnings >= 0 ? 1 : -1
      });
    }

    // Create a virtual line item for Net Income in the Equity section
    if (netIncome !== 0) {
      equity.push({
        id: 'virtual-net-income',
        glCode: '-',
        accountName: startDate || endDate
          ? `Net Income (${startDate || ''}${startDate && endDate ? ' to ' : ''}${endDate || ''})`
          : 'Current Period Net Income',
        balance: Math.abs(netIncome),
        isNetIncome: true,
        sign: netIncome >= 0 ? 1 : -1
      });
    }

    return res.status(200).json({
      status: 200,
      data: {
        assets,
        liabilities,
        equity,
        summary: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
          isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.001,
          periodLabel: startDate && endDate
            ? `${startDate} to ${endDate}`
            : startDate
            ? `From ${startDate}`
            : endDate
            ? `Up to ${endDate}`
            : 'All Time'
        }
      }
    });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
