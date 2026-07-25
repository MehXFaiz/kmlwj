import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';
import { AccountingService } from '../../_services/accounting.service.js';

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
        children: { none: {} },
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

    // SQA fix: this report previously only bucketed movements into generic
    // inflows/outflows with no operating/investing/financing categorization,
    // so it functioned as a cash summary rather than a true statement of cash
    // flows. Classification is by account type/name, mirroring the standard
    // categorization: PP&E/investment accounts → Investing, loan/equity
    // accounts → Financing, everything else (day-to-day revenue/expense) →
    // Operating.
    type CashFlowCategory = 'Operating' | 'Investing' | 'Financing';
    function classifyCashFlowCategory(accountName: string, accountTypeName: string | undefined): CashFlowCategory {
      const name = accountName.toLowerCase();
      const type = (accountTypeName || '').toUpperCase();
      const investingKeywords = ['fixed asset', 'investment', 'property', 'equipment', 'vehicle', 'furniture', 'building', 'long-term'];
      const financingKeywords = ['loan', 'equity', 'capital', 'owner', 'borrowing', 'share'];
      if (investingKeywords.some(k => name.includes(k))) return 'Investing';
      if (financingKeywords.some(k => name.includes(k)) || type === 'EQUITY') return 'Financing';
      if (type === 'LIABILITY' && financingKeywords.some(k => name.includes(k))) return 'Financing';
      return 'Operating';
    }

    // Optional date range filter — support ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
    const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // Single source of truth: posted journal entry lines (same source as every
    // other financial report — see AccountingService.getPostedAggregates)
    const computeCashBalance = async (upto?: Date) => {
      const aggregates = await AccountingService.getPostedAggregates({
        to: upto,
        accountIds: cashBankAccounts.map(a => a.id)
      });

      const total = cashBankAccounts.reduce(
        (sum, acc) => sum + AccountingService.naturalBalance('ASSET', acc.initialBalance, aggregates.get(acc.id)),
        0
      );

      return Math.round(total * 100) / 100;
    };

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
    const inflowCategoryByAccount: Record<string, CashFlowCategory> = {};
    const outflowCategoryByAccount: Record<string, CashFlowCategory> = {};

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
            inflowCategoryByAccount[name] = classifyCashFlowCategory(name, l.account.accountType?.name);
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
            outflowCategoryByAccount[name] = classifyCashFlowCategory(name, l.account.accountType?.name);
          }
        });
      }
    });

    const inflows = Object.entries(inflowsMap).map(([name, amount]) => ({
      accountName: name,
      amount,
      category: inflowCategoryByAccount[name] || 'Operating',
    }));

    const outflows = Object.entries(outflowsMap).map(([name, amount]) => ({
      accountName: name,
      amount,
      category: outflowCategoryByAccount[name] || 'Operating',
    }));

    const sumByCategory = (rows: { amount: number; category: CashFlowCategory }[], cat: CashFlowCategory) =>
      Math.round(rows.filter(r => r.category === cat).reduce((sum, r) => sum + r.amount, 0) * 100) / 100;

    const categories: CashFlowCategory[] = ['Operating', 'Investing', 'Financing'];
    const categorySummary = Object.fromEntries(categories.map(cat => [
      cat,
      {
        inflow: sumByCategory(inflows, cat),
        outflow: sumByCategory(outflows, cat),
        net: Math.round((sumByCategory(inflows, cat) - sumByCategory(outflows, cat)) * 100) / 100,
      },
    ]));

    const totalInflow = Math.round(inflows.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
    const totalOutflow = Math.round(outflows.reduce((sum, o) => sum + o.amount, 0) * 100) / 100;
    const netChange = Math.round((totalInflow - totalOutflow) * 100) / 100;
    const endingCash = endDate
      ? await computeCashBalance(new Date(dateFilter.lte))
      : await computeCashBalance();
    const beginningCash = startDate
      ? await computeCashBalance(new Date(new Date(startDate).getTime() - 1))
      : Math.round((endingCash - netChange) * 100) / 100;

    return res.status(200).json({
      status: 200,
      data: {
        inflows,
        outflows,
        categorySummary,
        summary: {
          beginningCash,
          totalInflow,
          totalOutflow,
          netChange,
          endingCash,
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
