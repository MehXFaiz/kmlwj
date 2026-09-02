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

        // SQA fix: the previous inline logic duplicated the isCash/isBank
        // classification from AccountingService but with a subtle operator-
        // precedence bug: `detailLower === 'cash'` short-circuits the ||,
        // so the `&& !nameLower.includes('bank')` guard was never evaluated
        // when detailType was 'cash' — a "Cash at Bank" account (detailType
        // 'cash', name containing 'bank') became both isCash=true AND
        // isBank=true, inflating one of the two summary buckets. Delegating
        // to the canonical helpers guarantees mutual exclusion.
        const isCash = AccountingService.isCashAccount(acc.accountName, acc.detailType);
        const isBank = AccountingService.isBankAccount(acc.accountName, acc.detailType);

        // P&L Accounts: Revenue and Expenses (EXCLUDE initial balance from period P&L)
        if (typeName === 'REVENUE' || typeName === 'INCOME') {
          const pAgg = periodMap.get(acc.id);
          const pDebit = pAgg?.debit ?? new Prisma.Decimal(0);
          const pCredit = pAgg?.credit ?? new Prisma.Decimal(0);
          const netRev = pCredit.minus(pDebit);
          totalRevenue = totalRevenue.plus(netRev);

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

          if (from) {
            const prAgg = priorMap.get(acc.id);
            const prDebit = prAgg?.debit ?? new Prisma.Decimal(0);
            const prCredit = prAgg?.credit ?? new Prisma.Decimal(0);
            priorRetainedEarnings = priorRetainedEarnings.minus(prDebit.minus(prCredit));
          }
        } else if (typeName === 'ASSET' || typeName === 'ASSETS') {
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
          const cAgg = cumulativeMap.get(acc.id);
          const cDebit = cAgg?.debit ?? new Prisma.Decimal(0);
          const cCredit = cAgg?.credit ?? new Prisma.Decimal(0);
          const closingLiab = initBal.plus(cCredit).minus(cDebit);
          totalLiabilities = totalLiabilities.plus(closingLiab);
        } else if (typeName === 'EQUITY') {
          const cAgg = cumulativeMap.get(acc.id);
          const cDebit = cAgg?.debit ?? new Prisma.Decimal(0);
          const cCredit = cAgg?.credit ?? new Prisma.Decimal(0);
          const closingEq = initBal.plus(cCredit).minus(cDebit);
          totalEquity = totalEquity.plus(closingEq);
        }
      }

      const netPeriodIncome = totalRevenue.minus(totalExpense);
      const totalRetainedEarnings = priorRetainedEarnings.plus(netPeriodIncome);
      const totalEquityWithIncome = totalEquity.plus(totalRetainedEarnings);
      const netAssets = totalAssets.minus(totalLiabilities);
      const isEquationBalanced = Math.abs(totalAssets.minus(totalLiabilities.plus(totalEquityWithIncome)).toNumber()) < 0.01;

      return {
        totalAssets: totalAssets.toNumber(),
        totalLiabilities: totalLiabilities.toNumber(),
        totalEquity: totalEquityWithIncome.toNumber(),
        netAssets: netAssets.toNumber(),
        totalRevenue: totalRevenue.toNumber(),
        totalExpense: totalExpense.toNumber(),
        netPeriodIncome: netPeriodIncome.toNumber(),
        cashBalance: cashBalance.toNumber(),
        bankBalance: bankBalance.toNumber(),
        openingCashBalance: openingCashBalance.toNumber(),
        openingBankBalance: openingBankBalance.toNumber(),
        cashReceipts: cashReceipts.toNumber(),
        cashPayments: cashPayments.toNumber(),
        isEquationBalanced
      };
    };

    if (txObj) {
      return runInTx(txObj);
    } else {
      return prisma.$transaction(runInTx, { timeout: 120000, maxWait: 30000 });
    }
  }
}
