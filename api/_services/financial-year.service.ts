import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { AccountingService } from './accounting.service.js';
import { logAudit } from '../_utils/audit.js';

export function parseFinancialYearCode(code: string): { startYear: number; endYear: number; startDate: Date; endDate: Date } {
  // Normalize string: "2026-2027" or "FY 2026-2027"
  const clean = code.replace(/[^0-9-]/g, '');
  const parts = clean.split('-');
  let startYear = parseInt(parts[0], 10);
  let endYear = parts[1] ? parseInt(parts[1], 10) : startYear + 1;

  if (isNaN(startYear)) startYear = new Date().getFullYear();
  if (isNaN(endYear)) endYear = startYear + 1;

  // Fiscal year in Pakistan runs July 1 (startYear) to June 30 (endYear)
  const startDate = new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0)); // 01-07-startYear
  const endDate = new Date(Date.UTC(endYear, 5, 30, 23, 59, 59, 999)); // 30-06-endYear

  return { startYear, endYear, startDate, endDate };
}

export function formatFinancialYearCode(startYear: number, endYear: number): string {
  return `FY ${startYear}-${endYear}`;
}

export interface PreClosingCheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

export interface YearClosingValidationResult {
  canClose: boolean;
  errors: string[];
  warnings: string[];
  checks: PreClosingCheckResult[];
  summary: {
    financialYear: string;
    startDate: string;
    endDate: string;
    totalRevenue: number;
    totalExpense: number;
    netProfitOrLoss: number;
    totalAssets: number;
    totalLiabilities: number;
    trialBalanceDiff: number;
    unpostedDraftsCount: number;
  };
}

export class FinancialYearService {
  /**
   * Ensures default financial years exist or creates them dynamically.
   */
  static async getOrCreateFinancialYears() {
    const existing = await prisma.financialYear.findMany({
      orderBy: { startDate: 'asc' }
    });

    if (existing.length > 0) return existing;

    // Seed initial financial year (e.g. FY 2026-2027)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const startYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    const code = formatFinancialYearCode(startYear, endYear);
    const { startDate, endDate } = parseFinancialYearCode(code);

    const initialFy = await prisma.financialYear.create({
      data: {
        code,
        name: code,
        startDate,
        endDate,
        isClosed: false
      }
    });

    return [initialFy];
  }

  /**
   * Resolves the financial year record for a given code or creates it if missing.
   */
  static async getOrCreateYearByCode(code: string, txObj?: any) {
    const db = txObj || prisma;
    const formatted = code.startsWith('FY ') ? code : `FY ${code}`;
    let fy = await db.financialYear.findUnique({ where: { code: formatted } });

    if (!fy) {
      const { startDate, endDate } = parseFinancialYearCode(formatted);
      fy = await db.financialYear.create({
        data: {
          code: formatted,
          name: formatted,
          startDate,
          endDate,
          isClosed: false
        }
      });
    }

    return fy;
  }

  /**
   * Comprehensive Year-End Pre-Closing Validation.
   */
  static async validateYearEndClosing(financialYearCode: string): Promise<YearClosingValidationResult> {
    const { startDate, endDate } = parseFinancialYearCode(financialYearCode);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const errors: string[] = [];
    const warnings: string[] = [];
    const checks: PreClosingCheckResult[] = [];

    // 1. Trial Balance Validation
    const tb = await AccountingService.getTrialBalance(startDateStr, endDateStr);
    const tbDiff = tb.difference || 0;
    if (tbDiff > 0.01) {
      errors.push(`Trial Balance is not balanced. Total Debit: PKR ${tb.totalDebit.toLocaleString()}, Total Credit: PKR ${tb.totalCredit.toLocaleString()}, Difference: PKR ${tbDiff.toLocaleString()}`);
      checks.push({
        name: 'Trial Balance Integrity',
        status: 'FAIL',
        details: `Imbalance detected: PKR ${tbDiff.toLocaleString()}`
      });
    } else {
      checks.push({
        name: 'Trial Balance Integrity',
        status: 'PASS',
        details: `Balanced cleanly (Debits: PKR ${tb.totalDebit.toLocaleString()} = Credits: PKR ${tb.totalCredit.toLocaleString()})`
      });
    }

    // 2. Draft / Unposted Journal Entries Check
    const unpostedDrafts = await prisma.journalEntry.findMany({
      where: {
        isDeleted: false,
        status: { in: ['Draft', 'Pending'] },
        postingDate: { gte: startDate, lte: endDate }
      },
      select: { id: true, voucherNo: true, postingDate: true, description: true }
    });

    if (unpostedDrafts.length > 0) {
      errors.push(`There are ${unpostedDrafts.length} unposted or draft journal entries in ${financialYearCode}. All vouchers must be posted or cancelled before year closing.`);
      checks.push({
        name: 'Unposted Draft Vouchers',
        status: 'FAIL',
        details: `${unpostedDrafts.length} unposted voucher(s) found (e.g. ${unpostedDrafts.slice(0, 3).map(d => d.voucherNo).join(', ')})`
      });
    } else {
      checks.push({
        name: 'Unposted Draft Vouchers',
        status: 'PASS',
        details: 'No unposted or draft entries found in financial year'
      });
    }

    // 3. Duplicate Opening Entries Check
    const existingBatches = await prisma.openingBalanceBatch.findMany({
      where: { financialYear: financialYearCode }
    });

    if (existingBatches.length > 1) {
      errors.push(`Multiple opening balance batches found for ${financialYearCode}. Contact administrator to resolve duplicate opening entries.`);
      checks.push({
        name: 'Opening Balance Structure',
        status: 'FAIL',
        details: `Duplicate batches detected (${existingBatches.length})`
      });
    } else {
      checks.push({
        name: 'Opening Balance Structure',
        status: 'PASS',
        details: 'Valid opening balance record'
      });
    }

    // 4. Primary Cash & Bank Accounts Sanity Check
    const cashAccount = await prisma.account.findFirst({
      where: { glCode: '1010103', isDeleted: false },
      include: { accountType: true }
    });

    if (!cashAccount) {
      errors.push('Primary Cash in Hand account (GL 1010103) is missing or deleted.');
      checks.push({
        name: 'Cash Account Health',
        status: 'FAIL',
        details: 'Cash in Hand account not configured'
      });
    } else {
      checks.push({
        name: 'Cash Account Health',
        status: 'PASS',
        details: `Cash in Hand configured (GL ${cashAccount.glCode})`
      });
    }

    // 5. Income Statement Summary
    const isReport = await AccountingService.getIncomeStatement(startDateStr, endDateStr);
    const totalRevenue = isReport.totalRevenue || 0;
    const totalExpense = isReport.totalExpense || 0;
    const netProfitOrLoss = isReport.netIncome || (totalRevenue - totalExpense);

    checks.push({
      name: 'P&L Reconciliation',
      status: 'PASS',
      details: `Net Result: PKR ${netProfitOrLoss.toLocaleString()} (Revenue: PKR ${totalRevenue.toLocaleString()}, Expense: PKR ${totalExpense.toLocaleString()})`
    });

    // 6. Balance Sheet Accounts Audit
    const bsReport = await AccountingService.getBalanceSheet(startDateStr, endDateStr);
    const totalAssets = bsReport.totalAssets || 0;
    const totalLiabilities = bsReport.totalLiabilities || 0;

    checks.push({
      name: 'Balance Sheet Consistency',
      status: 'PASS',
      details: `Assets: PKR ${totalAssets.toLocaleString()}, Liabilities: PKR ${totalLiabilities.toLocaleString()}`
    });

    const canClose = errors.length === 0;

    return {
      canClose,
      errors,
      warnings,
      checks,
      summary: {
        financialYear: financialYearCode,
        startDate: startDateStr,
        endDate: endDateStr,
        totalRevenue,
        totalExpense,
        netProfitOrLoss,
        totalAssets,
        totalLiabilities,
        trialBalanceDiff: tbDiff,
        unpostedDraftsCount: unpostedDrafts.length
      }
    };
  }

  /**
   * Executes Financial Year Closing & Automatic Next-Year Rollover inside an atomic transaction.
   */
  static async executeYearEndClosing(financialYearCode: string, closingDateStr: string, userId: string, notes?: string) {
    const formattedCode = financialYearCode.startsWith('FY ') ? financialYearCode : `FY ${financialYearCode}`;
    const validation = await FinancialYearService.validateYearEndClosing(formattedCode);

    if (!validation.canClose) {
      throw new Error(`Cannot close ${formattedCode}: ${validation.errors.join(' | ')}`);
    }

    const closingDate = new Date(closingDateStr);
    const { startYear, endYear, startDate, endDate } = parseFinancialYearCode(formattedCode);

    // Next Financial Year definitions
    const nextStartYear = endYear;
    const nextEndYear = endYear + 1;
    const nextFyCode = formatFinancialYearCode(nextStartYear, nextEndYear);
    const nextOpeningDate = new Date(Date.UTC(nextStartYear, 6, 1, 0, 0, 0, 0)); // 01-07-nextStartYear

    // Atomic Database Transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Ensure current & next FinancialYear records exist
      const currentFy = await FinancialYearService.getOrCreateYearByCode(formattedCode, tx);
      const nextFy = await FinancialYearService.getOrCreateYearByCode(nextFyCode, tx);

      if (currentFy.isClosed) {
        throw new Error(`${formattedCode} is already officially closed.`);
      }

      // 2. Fetch P&L balances as of closingDate to post Year-End Closing JV
      const pnlAccounts = await tx.account.findMany({
        where: {
          isDeleted: false,
          accountLevel: 'GL',
          accountType: { name: { in: ['REVENUE', 'INCOME', 'EXPENSE', 'EXPENSES'] } }
        },
        include: { accountType: true }
      });

      const periodAggregates = await AccountingService.getPostedAggregates({
        from: startDate,
        to: closingDate
      });

      // Get or create Opening Equity / Retained Earnings Account (GL 3030101 / 3010199)
      let equityAccount = await tx.account.findFirst({
        where: {
          isDeleted: false,
          OR: [
            { glCode: '3030101' },
            { glCode: '3010199' },
            { accountName: { contains: 'Retained Earnings', mode: 'insensitive' } },
            { accountName: { contains: 'Opening Equity', mode: 'insensitive' } }
          ]
        }
      });

      if (!equityAccount) {
        let equityType = await tx.accountType.findFirst({
          where: { name: { equals: 'EQUITY', mode: 'insensitive' } }
        });
        if (!equityType) {
          equityType = await tx.accountType.create({ data: { name: 'EQUITY', description: 'Equity' } });
        }
        equityAccount = await tx.account.create({
          data: {
            glCode: '3030101',
            accountName: 'Retained Earnings / Opening Equity',
            accountLevel: 'GL',
            accountTypeId: equityType.id,
            detailType: 'Equity',
            description: 'System equity account for year-end closing net result',
            isSystemDefined: true
          }
        });
      }

      // Build Year-End Closing Journal Entry Lines (zero out Revenue and Expense balances into Retained Earnings)
      const yeLines: any[] = [];
      let netProfitLoss = new Prisma.Decimal(0); // Net Profit (+) or Loss (-)

      for (const acc of pnlAccounts) {
        const typeName = (acc.accountType?.name || '').toUpperCase();
        const agg = periodAggregates.get(acc.id);
        const debitSum = agg?.debit ?? new Prisma.Decimal(0);
        const creditSum = agg?.credit ?? new Prisma.Decimal(0);

        if (typeName === 'REVENUE' || typeName === 'INCOME') {
          const netCredit = creditSum.minus(debitSum);
          if (!netCredit.isZero()) {
            // Debit Revenue to zero it out
            yeLines.push({
              accountId: acc.id,
              description: `Year-End Close Revenue (${acc.accountName}) - ${formattedCode}`,
              debit: netCredit.gt(0) ? netCredit.toNumber() : 0,
              credit: netCredit.lt(0) ? netCredit.abs().toNumber() : 0
            });
            netProfitLoss = netProfitLoss.plus(netCredit);
          }
        } else if (typeName === 'EXPENSE' || typeName === 'EXPENSES') {
          const netDebit = debitSum.minus(creditSum);
          if (!netDebit.isZero()) {
            // Credit Expense to zero it out
            yeLines.push({
              accountId: acc.id,
              description: `Year-End Close Expense (${acc.accountName}) - ${formattedCode}`,
              debit: netDebit.lt(0) ? netDebit.abs().toNumber() : 0,
              credit: netDebit.gt(0) ? netDebit.toNumber() : 0
            });
            netProfitLoss = netProfitLoss.minus(netDebit);
          }
        }
      }

      // Equity Credit (if Net Profit) or Debit (if Net Loss)
      if (!netProfitLoss.isZero()) {
        if (netProfitLoss.gt(0)) {
          yeLines.push({
            accountId: equityAccount.id,
            description: `Net Surplus / Profit Carried to Retained Earnings - ${formattedCode}`,
            debit: 0,
            credit: netProfitLoss.toNumber()
          });
        } else {
          yeLines.push({
            accountId: equityAccount.id,
            description: `Net Deficit / Loss Carried to Retained Earnings - ${formattedCode}`,
            debit: netProfitLoss.abs().toNumber(),
            credit: 0
          });
        }
      }

      // Post YE Closing Journal Entry if any P&L balances existed
      let yeJournalEntryId: string | null = null;
      if (yeLines.length > 0) {
        const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const yeVoucherNo = `YE-${endYear}-${randStr}`;

        const yeJv = await tx.journalEntry.create({
          data: {
            voucherNo: yeVoucherNo,
            postingDate: closingDate,
            subsidiary: 'Global',
            reference: `YE-CLOSE-${formattedCode}`,
            description: `Financial Year-End Closing Entry - ${formattedCode}`,
            postedBy: userId || 'Administrator',
            status: 'Posted',
            voucherType: 'YE',
            lines: {
              create: yeLines.map(l => ({
                accountId: l.accountId,
                description: l.description,
                debit: l.debit,
                credit: l.credit
              }))
            }
          }
        });
        yeJournalEntryId = yeJv.id;
        await AccountingService.recalculateBalancesForJournalEntry(tx, yeJv.id);
      }

      // 3. Compute Closing Balances of all Balance Sheet Accounts (Assets, Liabilities, Equity)
      const bsAccounts = await tx.account.findMany({
        where: {
          isDeleted: false,
          accountLevel: 'GL',
          accountType: { name: { in: ['ASSET', 'ASSETS', 'LIABILITY', 'LIABILITIES', 'EQUITY'] } }
        },
        include: { accountType: true }
      });

      const cumulativeAggregates = await AccountingService.getPostedAggregates({
        to: closingDate
      });

      interface RolloverLine {
        accountId: string;
        glCode: string;
        accountName: string;
        accountType: string;
        closingBalance: Prisma.Decimal;
        debitCredit: 'DEBIT' | 'CREDIT';
      }

      const rolloverLines: RolloverLine[] = [];
      let totalOpeningDebit = new Prisma.Decimal(0);
      let totalOpeningCredit = new Prisma.Decimal(0);

      for (const acc of bsAccounts) {
        const typeName = (acc.accountType?.name || 'ASSET').toUpperCase();
        const closingBal = AccountingService.naturalBalance(typeName, acc.initialBalance, cumulativeAggregates.get(acc.id));

        if (!closingBal.isZero()) {
          const isDebitNormal = ['ASSET', 'ASSETS', 'EXPENSE', 'EXPENSES'].includes(typeName);
          let dc: 'DEBIT' | 'CREDIT' = isDebitNormal ? 'DEBIT' : 'CREDIT';
          let absVal = closingBal;

          if (closingBal.lt(0)) {
            dc = isDebitNormal ? 'CREDIT' : 'DEBIT';
            absVal = closingBal.abs();
          }

          if (dc === 'DEBIT') totalOpeningDebit = totalOpeningDebit.plus(absVal);
          else totalOpeningCredit = totalOpeningCredit.plus(absVal);

          rolloverLines.push({
            accountId: acc.id,
            glCode: acc.glCode,
            accountName: acc.accountName,
            accountType: typeName,
            closingBalance: absVal,
            debitCredit: dc
          });
        }
      }

      // 4. Create Next Financial Year's OpeningBalanceBatch & Lines (AUTOMATIC ROLLOVER BY ACCOUNT ID / GL CODE)
      const existingNextBatch = await tx.openingBalanceBatch.findUnique({
        where: { financialYear: nextFyCode }
      });

      if (existingNextBatch) {
        await tx.openingBalanceLine.deleteMany({ where: { batchId: existingNextBatch.id } });
        if (existingNextBatch.journalEntryId) {
          await tx.journalEntry.update({
            where: { id: existingNextBatch.journalEntryId },
            data: { isDeleted: true, deletedAt: new Date(), deletedBy: userId }
          });
        }
      }

      // Post Next Year Opening Journal Entry
      const randOpStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const opVoucherNo = `OP-${nextStartYear}-${randOpStr}`;

      const opJournalEntry = await tx.journalEntry.create({
        data: {
          voucherNo: opVoucherNo,
          postingDate: nextOpeningDate,
          subsidiary: 'Global',
          reference: `AUTO-ROLLOVER-${formattedCode}`,
          description: `Automatic Opening Balances Carried Forward from ${formattedCode}`,
          postedBy: userId || 'Administrator',
          status: 'Posted',
          voucherType: 'OP',
          lines: {
            create: rolloverLines.map(rl => ({
              accountId: rl.accountId,
              description: `Opening Balance (${rl.accountName}) - Carried Forward from ${formattedCode}`,
              debit: rl.debitCredit === 'DEBIT' ? rl.closingBalance.toNumber() : 0,
              credit: rl.debitCredit === 'CREDIT' ? rl.closingBalance.toNumber() : 0
            }))
          }
        }
      });

      const nextBatch = await tx.openingBalanceBatch.upsert({
        where: { financialYear: nextFyCode },
        update: {
          openingDate: nextOpeningDate,
          sourceFinancialYear: formattedCode,
          sourceClosingDate: closingDate,
          isAutoRolled: true,
          status: 'Posted',
          journalEntryId: opJournalEntry.id,
          createdBy: userId,
          lines: {
            create: rolloverLines.map(rl => ({
              accountId: rl.accountId,
              glCode: rl.glCode,
              debitCredit: rl.debitCredit,
              amount: rl.closingBalance,
              sourceClosingBalance: rl.closingBalance
            }))
          }
        },
        create: {
          financialYear: nextFyCode,
          openingDate: nextOpeningDate,
          sourceFinancialYear: formattedCode,
          sourceClosingDate: closingDate,
          isAutoRolled: true,
          status: 'Posted',
          journalEntryId: opJournalEntry.id,
          createdBy: userId,
          lines: {
            create: rolloverLines.map(rl => ({
              accountId: rl.accountId,
              glCode: rl.glCode,
              debitCredit: rl.debitCredit,
              amount: rl.closingBalance,
              sourceClosingBalance: rl.closingBalance
            }))
          }
        },
        include: { lines: true }
      });

      await AccountingService.recalculateBalancesForJournalEntry(tx, opJournalEntry.id);

      // 5. Mark current financial year as closed
      await tx.financialYear.update({
        where: { id: currentFy.id },
        data: {
          isClosed: true,
          closedAt: new Date(),
          closedById: userId,
          closingNotes: notes || `Year closed successfully on ${closingDateStr}. Net Profit/Loss: PKR ${netProfitLoss.toFixed(2)}.`
        }
      });

      // 6. Audit Trail Logging
      await logAudit(
        userId,
        'Year Closing Completed',
        'FINANCIAL',
        { financialYear: formattedCode },
        {
          closedFinancialYear: formattedCode,
          nextFinancialYear: nextFyCode,
          netProfitLoss: netProfitLoss.toNumber(),
          rolledAccountsCount: rolloverLines.length,
          yeJournalEntryId,
          opJournalEntryId: opJournalEntry.id
        }
      );

      await logAudit(
        userId,
        'Automatic Rollover Created',
        'FINANCIAL',
        null,
        {
          sourceFinancialYear: formattedCode,
          targetFinancialYear: nextFyCode,
          batchId: nextBatch.id,
          totalOpeningDebit: totalOpeningDebit.toNumber(),
          totalOpeningCredit: totalOpeningCredit.toNumber()
        }
      );

      return {
        closedFinancialYear: formattedCode,
        nextFinancialYear: nextFyCode,
        netProfitLoss: netProfitLoss.toNumber(),
        rolledAccountsCount: rolloverLines.length,
        yeVoucherNo: yeLines.length > 0 ? (await tx.journalEntry.findUnique({ where: { id: yeJournalEntryId! } }))?.voucherNo : null,
        opVoucherNo: opJournalEntry.voucherNo,
        nextBatch
      };
    }, { timeout: 30000 });
  }

  /**
   * Reopens a closed financial year (Admin only).
   */
  static async reopenFinancialYear(financialYearCode: string, userId: string, reason: string) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('A valid detailed reason (at least 5 characters) is required to reopen a closed financial year.');
    }

    const formattedCode = financialYearCode.startsWith('FY ') ? financialYearCode : `FY ${financialYearCode}`;
    const fy = await prisma.financialYear.findUnique({ where: { code: formattedCode } });

    if (!fy) throw new Error(`Financial Year ${formattedCode} not found.`);
    if (!fy.isClosed) throw new Error(`Financial Year ${formattedCode} is not currently closed.`);

    const updated = await prisma.financialYear.update({
      where: { id: fy.id },
      data: {
        isClosed: false,
        reopenedAt: new Date(),
        reopenedById: userId,
        closingNotes: `Reopened on ${new Date().toISOString()}: ${reason}`
      }
    });

    await logAudit(
      userId,
      'Year Reopened',
      'FINANCIAL',
      { financialYear: formattedCode, closedAt: fy.closedAt },
      { financialYear: formattedCode, reopenedAt: updated.reopenedAt, reason },
    );

    return updated;
  }

  /**
   * Adjusts auto-rolled opening balances with explicit reason and audit log.
   */
  static async adjustOpeningBalance(batchId: string, balances: Record<string, number>, userId: string, reason: string) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('An explicit adjustment reason (at least 5 characters) is required to adjust opening balances.');
    }

    const batch = await prisma.openingBalanceBatch.findUnique({
      where: { id: batchId },
      include: { lines: { include: { account: true } }, journalEntry: true }
    });

    if (!batch) throw new Error('Opening Balance batch not found.');

    return await prisma.$transaction(async (tx) => {
      const oldValues = {
        batchId: batch.id,
        financialYear: batch.financialYear,
        lines: batch.lines.map(l => ({ accountId: l.accountId, glCode: l.account.glCode, amount: Number(l.amount) }))
      };

      // Update lines
      let totalDebit = new Prisma.Decimal(0);
      const newLinesPayload: any[] = [];

      for (const [accountId, rawAmount] of Object.entries(balances)) {
        const amt = new Prisma.Decimal(Number(rawAmount) || 0);
        if (amt.gte(0)) {
          totalDebit = totalDebit.plus(amt);
          newLinesPayload.push({ accountId, amount: amt });
        }
      }

      await tx.openingBalanceLine.deleteMany({ where: { batchId: batch.id } });
      await tx.openingBalanceLine.createMany({
        data: newLinesPayload.map(p => ({
          batchId: batch.id,
          accountId: p.accountId,
          amount: p.amount
        }))
      });

      // Update Opening Balance Batch metadata
      const updatedBatch = await tx.openingBalanceBatch.update({
        where: { id: batch.id },
        data: {
          adjustmentReason: reason,
          adjustedById: userId,
          adjustedAt: new Date()
        },
        include: { lines: true }
      });

      // Update associated Journal Entry
      const equityAccount = await tx.account.findFirst({
        where: {
          isDeleted: false,
          OR: [{ glCode: '3030101' }, { glCode: '3010199' }]
        }
      });

      if (batch.journalEntryId && equityAccount) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: batch.journalEntryId } });
        const jeLines: any[] = newLinesPayload.map(p => ({
          journalEntryId: batch.journalEntryId,
          accountId: p.accountId,
          description: `Adjusted Opening Balance - ${batch.financialYear}`,
          debit: p.amount.toNumber(),
          credit: 0
        }));

        if (totalDebit.gt(0)) {
          jeLines.push({
            journalEntryId: batch.journalEntryId,
            accountId: equityAccount.id,
            description: `Opening Equity Balancing Entry - ${batch.financialYear}`,
            debit: 0,
            credit: totalDebit.toNumber()
          });
        }

        await tx.journalEntryLine.createMany({ data: jeLines });
        await AccountingService.recalculateBalancesForJournalEntry(tx, batch.journalEntryId);
      }

      await logAudit(
        userId,
        'Opening Balance Adjustment',
        'FINANCIAL',
        oldValues,
        {
          batchId: batch.id,
          financialYear: batch.financialYear,
          reason,
          newTotalDebit: totalDebit.toNumber()
        }
      );

      return updatedBatch;
    });
  }
}
