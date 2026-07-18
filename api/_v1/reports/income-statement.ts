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

    // Optional date range filter — if provided, calculate balances from ledger entries in range
    // If not provided, use account.currentBalance (all-time cumulative)
    const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

    // Fetch Revenue and Expense accounts (always show all, even zero balance)
    const pnlAccounts = await prisma.account.findMany({
      where: {
        accountType: {
          name: { in: ['REVENUE', 'EXPENSE'] }
        }
      },
      include: {
        accountType: true
      },
      orderBy: { glCode: 'asc' }
    });

    const revenues: any[] = [];
    const expenses: any[] = [];
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const acc of pnlAccounts) {
      const type = acc.accountType?.name;

      let balance = acc.currentBalance;

      // If date filter is provided, calculate balance from ledger entries in that date range
      if (startDate || endDate) {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) {
          // Include the entire end date by going to end of day
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.lte = end;
        }

        const agg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: dateFilter
          },
          _sum: { debit: true, credit: true }
        });

        const totalDebit = Number(agg._sum.debit) || 0;
        const totalCredit = Number(agg._sum.credit) || 0;

        // Revenue accounts: credit-normal (credit increases balance)
        // Expense accounts: debit-normal (debit increases balance)
        if (type === 'REVENUE') {
          balance = totalCredit - totalDebit;
        } else if (type === 'EXPENSE') {
          balance = totalDebit - totalCredit;
        }
      }

      // Skip accounts with zero activity (after date filtering)
      if (balance === 0) continue;

      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance
      };

      if (type === 'REVENUE') {
        revenues.push(formatted);
        totalRevenue += balance;
      } else if (type === 'EXPENSE') {
        expenses.push(formatted);
        totalExpense += balance;
      }
    }

    const netIncome = totalRevenue - totalExpense;

    return res.status(200).json({
      status: 200,
      data: {
        revenues,
        expenses,
        summary: {
          totalRevenue,
          totalExpense,
          netIncome,
          // Include filter metadata so UI can label the report correctly
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
