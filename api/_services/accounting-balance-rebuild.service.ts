import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';
import { POSTED_JOURNAL_FILTER, AccountingService } from './accounting.service.js';

export interface FinancialSummaryTotals {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netAssets: number;
  totalRevenue: number;
  totalExpense: number;
  netPeriodIncome: number;
  cashBalance: number;
  bankBalance: number;
  openingCashBalance: number;
  openingBankBalance: number;
  cashReceipts: number;
  cashPayments: number;
  isEquationBalanced: boolean;

  // 13 Unified Core Financial Metrics
  incomeYtd: number;
  expensesYtd: number;
  monthlyDonations: number;
  monthlyZakat: number;
  currentMonthName: string;
  cashInHand: number;
  netResult: number;
  hallBookingIncome: number;
  donationIncome: number;
  zakatIncome: number;
  otherIncome: number;
  donationDistribution: number;
  zakatDistribution: number;
  otherExpenses: number;
}

export class AccountingBalanceRebuildService {
  /**
   * Recalculates all account balances directly from POSTED journal lines,
   * heals header postings, and returns live financial totals.
   */
  static async rebuildAllSummaries(txObj?: any, startDate?: string, endDate?: string): Promise<FinancialSummaryTotals> {
    const runInTx = async (tx: any) => {
      // 1. Fetch all active accounts
      const accounts = await tx.account.findMany({
        where: { isDeleted: false },
        include: { accountType: true }
      });

      const leafAccounts = accounts.filter(a => !accounts.some(child => child.parentId === a.id));
      const leafIds = leafAccounts.map(a => a.id);

      // Date boundaries
      const from = startDate ? new Date(startDate) : undefined;
      const toDate = endDate ? new Date(endDate) : undefined;
      if (toDate) {
        toDate.setHours(23, 59, 59, 999);
      }

      // Grouped aggregates from POSTED journal entry lines only
      const journalWherePeriod: any = { ...POSTED_JOURNAL_FILTER };
      if (from || toDate) {
        journalWherePeriod.postingDate = {};
        if (from) journalWherePeriod.postingDate.gte = from;
        if (toDate) journalWherePeriod.postingDate.lte = toDate;
      }

      const journalWherePrior: any = { ...POSTED_JOURNAL_FILTER };
      if (from) {
        journalWherePrior.postingDate = { lt: from };
      }

      const journalWhereCumulative: any = { ...POSTED_JOURNAL_FILTER };
      if (toDate) {
        journalWhereCumulative.postingDate = { lte: toDate };
      }

      const [periodGroups, priorGroups, cumulativeGroups] = await Promise.all([
        tx.journalEntryLine.groupBy({
          by: ['accountId'],
          where: { accountId: { in: leafIds }, journalEntry: journalWherePeriod },
          _sum: { debit: true, credit: true }
        }),
        from ? tx.journalEntryLine.groupBy({
          by: ['accountId'],
          where: { accountId: { in: leafIds }, journalEntry: journalWherePrior },
          _sum: { debit: true, credit: true }
        }) : Promise.resolve([]),
        (from || toDate) ? tx.journalEntryLine.groupBy({
          by: ['accountId'],
          where: { accountId: { in: leafIds }, journalEntry: journalWhereCumulative },
          _sum: { debit: true, credit: true }
        }) : Promise.resolve([])
      ]);

      const periodMap = new Map(periodGroups.map(g => [g.accountId, { debit: new Prisma.Decimal(g._sum.debit ?? 0), credit: new Prisma.Decimal(g._sum.credit ?? 0) }]));
      const priorMap = new Map(priorGroups.map(g => [g.accountId, { debit: new Prisma.Decimal(g._sum.debit ?? 0), credit: new Prisma.Decimal(g._sum.credit ?? 0) }]));
      const cumulativeMap = (from || toDate)
        ? new Map(cumulativeGroups.map(g => [g.accountId, { debit: new Prisma.Decimal(g._sum.debit ?? 0), credit: new Prisma.Decimal(g._sum.credit ?? 0) }]))
        : periodMap;

      let totalAssets = new Prisma.Decimal(0);
      let totalLiabilities = new Prisma.Decimal(0);
      let totalEquity = new Prisma.Decimal(0);
      let totalRevenue = new Prisma.Decimal(0);
      let totalExpense = new Prisma.Decimal(0);

      // Income Sub-categories (Sum to totalRevenue)
      let hallBookingIncome = new Prisma.Decimal(0);
      let donationIncome = new Prisma.Decimal(0);
      let zakatIncome = new Prisma.Decimal(0);
      let otherIncome = new Prisma.Decimal(0);

      // Expense Sub-categories (Sum to totalExpense)
      let donationDistribution = new Prisma.Decimal(0);
      let zakatDistribution = new Prisma.Decimal(0);
      let otherExpenses = new Prisma.Decimal(0);

      let initialAssets = new Prisma.Decimal(0);
      let initialLiabilities = new Prisma.Decimal(0);
      let initialEquity = new Prisma.Decimal(0);

      let cashBalance = new Prisma.Decimal(0);
      let bankBalance = new Prisma.Decimal(0);
      let openingCashBalance = new Prisma.Decimal(0);
      let openingBankBalance = new Prisma.Decimal(0);
      let cashReceipts = new Prisma.Decimal(0);
      let cashPayments = new Prisma.Decimal(0);

      let priorRetainedEarnings = new Prisma.Decimal(0);

      for (const acc of leafAccounts) {
        const typeName = (acc.accountType?.name || '').toUpperCase();
        const initBal = new Prisma.Decimal(acc.initialBalance ?? 0);
        const code = acc.glCode || '';
        const nameLower = (acc.accountName || '').toLowerCase();
        const detailLower = (acc.detailType || '').toLowerCase();

        const isCash = AccountingService.isCashAccount(acc.accountName, acc.detailType);
        const isBank = AccountingService.isBankAccount(acc.accountName, acc.detailType);

        // P&L Accounts: Revenue and Expenses (EXCLUDE initial balance from period P&L)
        if (typeName === 'REVENUE' || typeName === 'INCOME') {
          const pAgg = periodMap.get(acc.id);
          const pDebit = pAgg?.debit ?? new Prisma.Decimal(0);
          const pCredit = pAgg?.credit ?? new Prisma.Decimal(0);
          const netRev = pCredit.minus(pDebit);
          totalRevenue = totalRevenue.plus(netRev);

          // Categorize Revenue Sub-metrics
          if (detailLower === 'hall' || code.startsWith('30110') || ((nameLower.includes('hall') || nameLower.includes('garden')) && !code.startsWith('30205'))) {
            hallBookingIncome = hallBookingIncome.plus(netRev);
          } else if (code.startsWith('30201') || nameLower.includes('zakat')) {
            zakatIncome = zakatIncome.plus(netRev);
          } else if (code.startsWith('30204') || nameLower.includes('donation') || nameLower.includes('sadqa') || nameLower.includes('fitra')) {
            donationIncome = donationIncome.plus(netRev);
          } else {
            otherIncome = otherIncome.plus(netRev);
          }

          if (from) {
            const prAgg = priorMap.get(acc.id);
            const prDebit = prAgg?.debit ?? new Prisma.Decimal(0);
            const prCredit = prAgg?.credit ?? new Prisma.Decimal(0);
            priorRetainedEarnings = priorRetainedEarnings.plus(prCredit.minus(prDebit));
          }
        } else if (typeName === 'EXPENSE' || typeName === 'EXPENSES') {
          const pAgg = periodMap.get(acc.id);
          const pDebit = pAgg?.debit ?? new Prisma.Decimal(0);
          const pCredit = pAgg?.credit ?? new Prisma.Decimal(0);
          const netExp = pDebit.minus(pCredit);
          totalExpense = totalExpense.plus(netExp);

          // Categorize Expense Sub-metrics
          if (code.startsWith('40602') || code === '4040203' || code === '4060104' || code === '4060106' || code === '4060107' || code === '4060108' || (nameLower.includes('zakat') && nameLower.includes('distribut'))) {
            zakatDistribution = zakatDistribution.plus(netExp);
          } else if (code.startsWith('40601') || code.startsWith('40710') || nameLower.includes('monthly donation') || nameLower.includes('marriage donation') || nameLower.includes('medical donation') || nameLower.includes('welfare')) {
            donationDistribution = donationDistribution.plus(netExp);
          } else {
            otherExpenses = otherExpenses.plus(netExp);
          }

          if (from) {
            const prAgg = priorMap.get(acc.id);
            const prDebit = prAgg?.debit ?? new Prisma.Decimal(0);
            const prCredit = prAgg?.credit ?? new Prisma.Decimal(0);
            priorRetainedEarnings = priorRetainedEarnings.minus(prDebit.minus(prCredit));
          }
        } else if (typeName === 'ASSET' || typeName === 'ASSETS') {
          initialAssets = initialAssets.plus(initBal);
          const cAgg = cumulativeMap.get(acc.id);
          const cDebit = cAgg?.debit ?? new Prisma.Decimal(0);
          const cCredit = cAgg?.credit ?? new Prisma.Decimal(0);
          const closingAsset = initBal.plus(cDebit).minus(cCredit);
          totalAssets = totalAssets.plus(closingAsset);

          const prAgg = priorMap.get(acc.id);
          const prDebit = prAgg?.debit ?? new Prisma.Decimal(0);
          const prCredit = prAgg?.credit ?? new Prisma.Decimal(0);
          const openingAsset = from ? initBal.plus(prDebit).minus(prCredit) : closingAsset;

          if (isCash) {
            cashBalance = cashBalance.plus(closingAsset);
            openingCashBalance = openingCashBalance.plus(openingAsset);

            const pAgg = periodMap.get(acc.id);
            if (pAgg) {
              cashReceipts = cashReceipts.plus(pAgg.debit);
              cashPayments = cashPayments.plus(pAgg.credit);
            }
          } else if (isBank) {
            bankBalance = bankBalance.plus(closingAsset);
            openingBankBalance = openingBankBalance.plus(openingAsset);
          }
        } else if (typeName === 'LIABILITY' || typeName === 'LIABILITIES') {
          initialLiabilities = initialLiabilities.plus(initBal);
          const cAgg = cumulativeMap.get(acc.id);
          const cDebit = cAgg?.debit ?? new Prisma.Decimal(0);
          const cCredit = cAgg?.credit ?? new Prisma.Decimal(0);
          const closingLiab = initBal.plus(cCredit).minus(cDebit);
          totalLiabilities = totalLiabilities.plus(closingLiab);
        } else if (typeName === 'EQUITY') {
          initialEquity = initialEquity.plus(initBal);
          const cAgg = cumulativeMap.get(acc.id);
          const cDebit = cAgg?.debit ?? new Prisma.Decimal(0);
          const cCredit = cAgg?.credit ?? new Prisma.Decimal(0);
          const closingEq = initBal.plus(cCredit).minus(cDebit);
          totalEquity = totalEquity.plus(closingEq);
        }
      }

      // Opening balance equity: Difference between opening assets and opening liabilities/equity
      const openingBalanceEquity = initialAssets.minus(initialLiabilities).minus(initialEquity);
      const baseEquity = totalEquity.plus(openingBalanceEquity);
      const netPeriodIncome = totalRevenue.minus(totalExpense);
      const totalRetainedEarnings = priorRetainedEarnings.plus(netPeriodIncome);
      const totalEquityWithIncome = baseEquity.plus(totalRetainedEarnings);
      const netAssets = totalAssets.minus(totalLiabilities);
      const isEquationBalanced = Math.abs(totalAssets.minus(totalLiabilities.plus(totalEquityWithIncome)).toNumber()) < 0.01;

      // Current calendar month boundary for monthly donations received
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthIdx = now.getMonth();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const currentMonthName = `${monthNames[currentMonthIdx]} ${currentYear}`;
      const startOfMonth = new Date(currentYear, currentMonthIdx, 1);
      const endOfMonth = new Date(currentYear, currentMonthIdx + 1, 1);

      const [monthlyDonAgg, monthlyZakatAgg] = await Promise.all([
        tx.donationReceived.aggregate({
          _sum: { amount: true },
          where: { isDeleted: false, status: 'POSTED', receiptDate: { gte: startOfMonth, lt: endOfMonth } }
        }),
        tx.donationReceived.aggregate({
          _sum: { amount: true },
          where: { isDeleted: false, status: 'POSTED', donationType: 'ZAKAT', receiptDate: { gte: startOfMonth, lt: endOfMonth } }
        })
      ]);

      const monthlyDonations = Number(monthlyDonAgg._sum.amount || 0);
      const monthlyZakat = Number(monthlyZakatAgg._sum.amount || 0);

      const revenueNum = totalRevenue.toNumber();
      const expenseNum = totalExpense.toNumber();
      const netResultNum = netPeriodIncome.toNumber();
      const cashNum = cashBalance.toNumber();

      return {
        totalAssets: totalAssets.toNumber(),
        totalLiabilities: totalLiabilities.toNumber(),
        totalEquity: totalEquityWithIncome.toNumber(),
        netAssets: netAssets.toNumber(),
        totalRevenue: revenueNum,
        totalExpense: expenseNum,
        netPeriodIncome: netResultNum,
        cashBalance: cashNum,
        bankBalance: bankBalance.toNumber(),
        openingCashBalance: openingCashBalance.toNumber(),
        openingBankBalance: openingBankBalance.toNumber(),
        cashReceipts: cashReceipts.toNumber(),
        cashPayments: cashPayments.toNumber(),
        isEquationBalanced,

        // 13 Unified Core Financial Metrics
        incomeYtd: revenueNum,
        expensesYtd: expenseNum,
        monthlyDonations,
        monthlyZakat,
        currentMonthName,
        cashInHand: cashNum,
        netResult: netResultNum,
        hallBookingIncome: hallBookingIncome.toNumber(),
        donationIncome: donationIncome.toNumber(),
        zakatIncome: zakatIncome.toNumber(),
        otherIncome: otherIncome.toNumber(),
        donationDistribution: donationDistribution.toNumber(),
        zakatDistribution: zakatDistribution.toNumber(),
        otherExpenses: otherExpenses.toNumber()
      };
    };

    if (txObj) {
      return runInTx(txObj);
    } else {
      return prisma.$transaction(runInTx, { timeout: 120000, maxWait: 30000 });
    }
  }
}

