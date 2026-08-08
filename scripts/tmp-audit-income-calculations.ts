import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AccountingService } from '../api/_services/accounting.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const prisma = new PrismaClient();

async function auditIncomeCalculations() {
  console.log('=== AUDITING ALL INCOME / REVENUE CALCULATIONS ===\n');

  const startDate = '2026-01-01';
  const endDate = '2026-12-31';

  // 1. Financial Summary (Dashboard Backend)
  const summary2026 = await AccountingService.getFinancialSummary(startDate, endDate);
  const summaryAllTime = await AccountingService.getFinancialSummary(undefined, undefined);

  // 2. Income Statement
  const incStmt2026 = await AccountingService.getIncomeStatement(startDate, endDate);
  const incStmtAllTime = await AccountingService.getIncomeStatement(undefined, undefined);

  // 3. Trial Balance
  const tb2026 = await AccountingService.getTrialBalance(startDate, endDate);
  const tbAllTime = await AccountingService.getTrialBalance(undefined, undefined);

  console.log('--- 1. DASHBOARD FINANCIAL SUMMARY ---');
  console.log(`FY 2026 Revenue: PKR ${summary2026.totalRevenue.toLocaleString()}`);
  console.log(`All-Time Revenue: PKR ${summaryAllTime.totalRevenue.toLocaleString()}`);

  console.log('\n--- 2. INCOME STATEMENT ---');
  console.log(`FY 2026 Total Revenue: PKR ${incStmt2026.totalRevenue.toLocaleString()}`);
  console.log(`All-Time Total Revenue: PKR ${incStmtAllTime.totalRevenue.toLocaleString()}`);

  console.log('\n--- 3. TRIAL BALANCE REVENUE ACCOUNTS ---');
  const tbRev2026 = tb2026.accounts
    .filter((a: any) => ['REVENUE', 'INCOME'].includes((a.accountType || '').toUpperCase()))
    .reduce((sum: number, a: any) => sum + (a.credit - a.debit), 0);
  const tbRevAllTime = tbAllTime.accounts
    .filter((a: any) => ['REVENUE', 'INCOME'].includes((a.accountType || '').toUpperCase()))
    .reduce((sum: number, a: any) => sum + (a.credit - a.debit), 0);

  console.log(`FY 2026 TB Revenue Sum: PKR ${tbRev2026.toLocaleString()}`);
  console.log(`All-Time TB Revenue Sum: PKR ${tbRevAllTime.toLocaleString()}`);

  console.log('\n--- 4. DIRECT DATABASE JOURNAL LINE REVENUE AUDIT ---');
  // Posted lines where accountType is REVENUE in 2026 vs All-Time
  const lines2026 = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: 'Posted',
        isDeleted: false,
        postingDate: {
          gte: new Date('2026-01-01T00:00:00Z'),
          lte: new Date('2026-12-31T23:59:59Z')
        }
      },
      account: {
        accountType: {
          name: { in: ['REVENUE', 'INCOME', 'Revenue', 'Income'] }
        }
      }
    },
    include: { account: true, journalEntry: true }
  });

  let dr2026 = 0, cr2026 = 0;
  for (const l of lines2026) {
    dr2026 += Number(l.debit);
    cr2026 += Number(l.credit);
  }
  console.log(`Direct DB 2026 Revenue Credit: PKR ${cr2026.toLocaleString()}, Debit: PKR ${dr2026.toLocaleString()}, Net: PKR ${(cr2026 - dr2026).toLocaleString()}`);

  const linesAllTime = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: 'Posted',
        isDeleted: false
      },
      account: {
        accountType: {
          name: { in: ['REVENUE', 'INCOME', 'Revenue', 'Income'] }
        }
      }
    },
    include: { account: true, journalEntry: true }
  });

  let drAll = 0, crAll = 0;
  for (const l of linesAllTime) {
    drAll += Number(l.debit);
    crAll += Number(l.credit);
  }
  console.log(`Direct DB All-Time Revenue Credit: PKR ${crAll.toLocaleString()}, Debit: PKR ${drAll.toLocaleString()}, Net: PKR ${(crAll - drAll).toLocaleString()}`);

  console.log('\n--- 5. CHECK FOR ANY RETAINED EARNINGS OR EQUITY IN REVENUE ---');
  const equityAccountsInRev = await prisma.account.findMany({
    where: {
      isDeleted: false,
      OR: [
        { accountName: { contains: 'Retained', mode: 'insensitive' } },
        { accountName: { contains: 'Equity', mode: 'insensitive' } }
      ]
    },
    include: { accountType: true }
  });
  console.log('Equity/Retained Earnings Accounts:', equityAccountsInRev.map(a => ({ id: a.id, glCode: a.glCode, name: a.accountName, type: a.accountType?.name, initial: a.initialBalance, current: a.currentBalance })));

  await prisma.$disconnect();
}

auditIncomeCalculations().catch(console.error);
