import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';
import { AccountingService } from '../../_services/accounting.service.js';
import { PERMS } from '../../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;

    // 1. Fetch cash and bank accounts dynamically — kept separate from the start
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

    // Split into cash-in-hand accounts vs bank accounts using the same
    // isCashAccount / isBankAccount logic as the rest of the accounting engine.
    const cashAccounts = cashBankAccounts.filter(a => AccountingService.isCashAccount(a.accountName, a.detailType));
    const bankAccounts = cashBankAccounts.filter(a => AccountingService.isBankAccount(a.accountName, a.detailType));

    const cashCodes = new Set(cashAccounts.map(a => a.glCode));
    const bankCodes = new Set(bankAccounts.map(a => a.glCode));
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

    // Single source of truth: posted journal entry lines (same as every other report)
    const computeBalance = async (accounts: typeof cashBankAccounts, upto?: Date) => {
      if (accounts.length === 0) return 0;
      const aggregates = await AccountingService.getPostedAggregates({
        to: upto,
        accountIds: accounts.map(a => a.id)
      });
      const total = accounts.reduce(
        (sum, acc) => sum + AccountingService.naturalBalance('ASSET', acc.initialBalance, aggregates.get(acc.id)),
        0
      );
      return Math.round(total * 100) / 100;
    };

    const computeCashBalance  = (upto?: Date) => computeBalance(cashBankAccounts, upto);
    const computeCashOnlyBalance = (upto?: Date) => computeBalance(cashAccounts, upto);
    const computeBankOnlyBalance = (upto?: Date) => computeBalance(bankAccounts, upto);

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

    // Separate cash-only and bank-only inflow/outflow maps
    const cashInflowsMap: Record<string, number> = {};
    const cashOutflowsMap: Record<string, number> = {};
    const bankInflowsMap: Record<string, number> = {};
    const bankOutflowsMap: Record<string, number> = {};

    const processMovements = (
      movementLines: typeof postedJournals[0]['lines'],
      nonCashLines: typeof postedJournals[0]['lines'],
      netChange: number,
      globalInflows: Record<string, number>,
      globalOutflows: Record<string, number>
    ) => {
      if (netChange > 0) {
        const totalNonCashCredit = nonCashLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
        nonCashLines.forEach((l) => {
          if (l.credit > 0) {
            const ratio = totalNonCashCredit > 0 ? Number(l.credit) / totalNonCashCredit : 1;
            const amount = Math.round(netChange * ratio * 100) / 100;
            const name = l.account.accountName;
            globalInflows[name] = (globalInflows[name] || 0) + amount;
            inflowCategoryByAccount[name] = classifyCashFlowCategory(name, l.account.accountType?.name);
          }
        });
      } else if (netChange < 0) {
        const absChange = Math.abs(netChange);
        const totalNonCashDebit = nonCashLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
        nonCashLines.forEach((l) => {
          if (l.debit > 0) {
            const ratio = totalNonCashDebit > 0 ? Number(l.debit) / totalNonCashDebit : 1;
            const amount = Math.round(absChange * ratio * 100) / 100;
            const name = l.account.accountName;
            globalOutflows[name] = (globalOutflows[name] || 0) + amount;
            outflowCategoryByAccount[name] = classifyCashFlowCategory(name, l.account.accountType?.name);
          }
        });
      }
    };

    postedJournals.forEach((je) => {
      const allCashBankLines = je.lines.filter(l => cashBankCodes.has(l.account.glCode));
      const nonCashBankLines = je.lines.filter(l => !cashBankCodes.has(l.account.glCode));

      if (allCashBankLines.length === 0 || nonCashBankLines.length === 0) return;

      // Combined (legacy / summary) inflows/outflows
      const netCashChange = allCashBankLines.reduce((sum, l) => sum + Number(l.debit || 0) - Number(l.credit || 0), 0);
      processMovements(allCashBankLines, nonCashBankLines, netCashChange, inflowsMap, outflowsMap);

      // Cash-in-hand section
      const cashLines = je.lines.filter(l => cashCodes.has(l.account.glCode));
      if (cashLines.length > 0) {
        const netCash = cashLines.reduce((sum, l) => sum + Number(l.debit || 0) - Number(l.credit || 0), 0);
        processMovements(cashLines, nonCashBankLines, netCash, cashInflowsMap, cashOutflowsMap);
      }

      // Bank section
      const bankLines = je.lines.filter(l => bankCodes.has(l.account.glCode));
      if (bankLines.length > 0) {
        const netBank = bankLines.reduce((sum, l) => sum + Number(l.debit || 0) - Number(l.credit || 0), 0);
        processMovements(bankLines, nonCashBankLines, netBank, bankInflowsMap, bankOutflowsMap);
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

    // Cash-in-hand section
    const cashTotalReceipts = Math.round(Object.values(cashInflowsMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const cashTotalPayments = Math.round(Object.values(cashOutflowsMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const closingCash = endDate
      ? await computeCashOnlyBalance(new Date(dateFilter.lte))
      : await computeCashOnlyBalance();
    const openingCash = startDate
      ? await computeCashOnlyBalance(new Date(new Date(startDate).getTime() - 1))
      : Math.round((closingCash - (cashTotalReceipts - cashTotalPayments)) * 100) / 100;

    // Bank section
    const bankTotalReceipts = Math.round(Object.values(bankInflowsMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const bankTotalPayments = Math.round(Object.values(bankOutflowsMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const closingBank = endDate
      ? await computeBankOnlyBalance(new Date(dateFilter.lte))
      : await computeBankOnlyBalance();
    const openingBank = startDate
      ? await computeBankOnlyBalance(new Date(new Date(startDate).getTime() - 1))
      : Math.round((closingBank - (bankTotalReceipts - bankTotalPayments)) * 100) / 100;

    const periodLabel = startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate
      ? `From ${startDate}`
      : endDate
      ? `Up to ${endDate}`
      : 'All Time';

    return res.status(200).json({
      status: 200,
      data: {
        inflows,
        outflows,
        categorySummary,
        // Split Cash in Hand and Bank sections (single source of truth: posted GL entries)
        cashSection: {
          receipts: Object.entries(cashInflowsMap).map(([accountName, amount]) => ({ accountName, amount })),
          payments: Object.entries(cashOutflowsMap).map(([accountName, amount]) => ({ accountName, amount })),
          openingBalance: openingCash,
          totalReceipts: cashTotalReceipts,
          totalPayments: cashTotalPayments,
          closingBalance: closingCash,
        },
        bankSection: {
          receipts: Object.entries(bankInflowsMap).map(([accountName, amount]) => ({ accountName, amount })),
          payments: Object.entries(bankOutflowsMap).map(([accountName, amount]) => ({ accountName, amount })),
          openingBalance: openingBank,
          totalReceipts: bankTotalReceipts,
          totalPayments: bankTotalPayments,
          closingBalance: closingBank,
        },
        summary: {
          beginningCash,
          totalInflow,
          totalOutflow,
          netChange,
          endingCash,
          periodLabel
        }
      }
    });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
