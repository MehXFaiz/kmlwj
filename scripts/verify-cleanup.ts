import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AccountingService } from '../api/_services/accounting.service.js';
import {
  QA_INVOICE_ITEM_IDS,
  QA_INVOICE_IDS,
  QA_ADD_INCOME_IDS,
  QA_SIMPLE_EXPENSE_IDS,
  QA_ZAKAT_CARD_IDS,
  QA_DONATION_GIVEN_IDS,
  QA_DONATION_REC_IDS,
  QA_HALL_BOOKING_IDS,
  QA_REVENUE_COLL_IDS,
  QA_CUSTOMER_IDS,
  QA_DONOR_IDS,
  QA_MEMBER_IDS,
  QA_BENEFICIARY_IDS,
  QA_JOURNAL_ENTRY_IDS,
} from './purge-qa-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require') || connectionString?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function verify() {
  console.log('====================================================');
  console.log('🔍 VERIFYING DATABASE & ACCOUNTING INTEGRITY POST-CLEANUP');
  console.log('====================================================\n');

  let allChecksPassed = true;
  function assertCheck(name: string, condition: boolean, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${name} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`❌ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
      allChecksPassed = false;
    }
  }

  // 1. Confirm identified QA records are completely gone
  const remInvoiceItems = await prisma.invoiceItem.count({ where: { id: { in: QA_INVOICE_ITEM_IDS } } });
  assertCheck('QA InvoiceItems purged', remInvoiceItems === 0, `remaining: ${remInvoiceItems}`);

  const remInvoices = await prisma.invoice.count({ where: { id: { in: QA_INVOICE_IDS } } });
  assertCheck('QA Invoices purged', remInvoices === 0, `remaining: ${remInvoices}`);

  const remAddIncome = await prisma.addIncomeRecord.count({ where: { id: { in: QA_ADD_INCOME_IDS } } });
  assertCheck('QA AddIncome purged', remAddIncome === 0, `remaining: ${remAddIncome}`);

  const remSimpleExp = await prisma.simpleExpense.count({ where: { id: { in: QA_SIMPLE_EXPENSE_IDS } } });
  assertCheck('QA SimpleExpenses purged', remSimpleExp === 0, `remaining: ${remSimpleExp}`);

  const remZakatCard = await prisma.zakatCard.count({ where: { id: { in: QA_ZAKAT_CARD_IDS } } });
  assertCheck('QA ZakatCards purged', remZakatCard === 0, `remaining: ${remZakatCard}`);

  const remDonGiven = await prisma.donation.count({ where: { id: { in: QA_DONATION_GIVEN_IDS } } });
  assertCheck('QA Donations Given purged', remDonGiven === 0, `remaining: ${remDonGiven}`);

  const remDonRec = await prisma.donationReceived.count({ where: { id: { in: QA_DONATION_REC_IDS } } });
  assertCheck('QA Donations Received purged', remDonRec === 0, `remaining: ${remDonRec}`);

  const remHallBook = await prisma.hallBooking.count({ where: { id: { in: QA_HALL_BOOKING_IDS } } });
  assertCheck('QA HallBookings purged', remHallBook === 0, `remaining: ${remHallBook}`);

  const remRevColl = await prisma.revenueCollection.count({ where: { id: { in: QA_REVENUE_COLL_IDS } } });
  assertCheck('QA RevenueCollections purged', remRevColl === 0, `remaining: ${remRevColl}`);

  const remCust = await prisma.customer.count({ where: { id: { in: QA_CUSTOMER_IDS } } });
  assertCheck('QA Customer purged', remCust === 0, `remaining: ${remCust}`);

  const remDonor = await prisma.donor.count({ where: { id: { in: QA_DONOR_IDS } } });
  assertCheck('QA Donor purged', remDonor === 0, `remaining: ${remDonor}`);

  const remMember = await prisma.member.count({ where: { id: { in: QA_MEMBER_IDS } } });
  assertCheck('QA Member purged', remMember === 0, `remaining: ${remMember}`);

  const remBen = await prisma.beneficiary.count({ where: { id: { in: QA_BENEFICIARY_IDS } } });
  assertCheck('QA Beneficiary purged', remBen === 0, `remaining: ${remBen}`);

  const remJE = await prisma.journalEntry.count({ where: { id: { in: QA_JOURNAL_ENTRY_IDS } } });
  assertCheck('QA JournalEntries purged', remJE === 0, `remaining: ${remJE}`);

  // 2. Pattern check for any residual "QA TEST DATA" or "drift-test" in operational tables
  const patternDon = await prisma.donation.count({ where: { remarks: { contains: 'QA TEST DATA' } } });
  assertCheck('No residual QA Donations', patternDon === 0);

  const patternDonRec = await prisma.donationReceived.count({ where: { narration: { contains: 'QA TEST DATA' } } });
  assertCheck('No residual QA DonationsReceived', patternDonRec === 0);

  const patternHB = await prisma.hallBooking.count({ where: { bookerName: { startsWith: 'QA Booker' } } });
  assertCheck('No residual QA HallBookings', patternHB === 0);

  const patternRev = await prisma.revenueCollection.count({ where: { remarks: { contains: 'QA TEST DATA' } } });
  assertCheck('No residual QA RevenueCollections', patternRev === 0);

  const patternExp = await prisma.simpleExpense.count({ where: { description: { contains: 'QA TEST DATA' } } });
  assertCheck('No residual QA SimpleExpenses', patternExp === 0);

  const patternJE = await prisma.journalEntry.count({
    where: {
      OR: [
        { description: { contains: 'QA TEST DATA' } },
        { description: { contains: 'drift-test' } },
      ]
    }
  });
  assertCheck('No residual QA JournalEntries', patternJE === 0);

  // 3. Orphan and Foreign Key Integrity Checks
  const orphanLines = await prisma.$queryRaw<any[]>`
    SELECT l."id", l."journalEntryId"
    FROM "JournalEntryLine" l
    LEFT JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
    WHERE j."id" IS NULL
  `;
  assertCheck('No orphan JournalEntryLines', orphanLines.length === 0, `count: ${orphanLines.length}`);

  const orphanHB = await prisma.$queryRaw<any[]>`
    SELECT hb."id", hb."receiptNo", hb."journalEntryId"
    FROM "HallBooking" hb
    LEFT JOIN "JournalEntry" j ON j."id" = hb."journalEntryId"
    WHERE hb."journalEntryId" IS NOT NULL AND j."id" IS NULL
  `;
  assertCheck('No orphan HallBooking JournalEntries', orphanHB.length === 0, `count: ${orphanHB.length}`);

  const orphanInvoice = await prisma.$queryRaw<any[]>`
    SELECT i."id"
    FROM "Invoice" i
    LEFT JOIN "Customer" c ON c."id" = i."customerId"
    WHERE c."id" IS NULL
  `;
  assertCheck('No orphan Invoices (missing Customer)', orphanInvoice.length === 0, `count: ${orphanInvoice.length}`);

  const orphanInvoiceItems = await prisma.$queryRaw<any[]>`
    SELECT ii."id"
    FROM "InvoiceItem" ii
    LEFT JOIN "Invoice" i ON i."id" = ii."invoiceId"
    WHERE i."id" IS NULL
  `;
  assertCheck('No orphan InvoiceItems', orphanInvoiceItems.length === 0, `count: ${orphanInvoiceItems.length}`);

  // 4. Preserved Legitimate Business Data Verification
  const totalRemainingHB = await prisma.hallBooking.count();
  assertCheck('Exact legitimate HallBookings preserved', totalRemainingHB === 14, `count: ${totalRemainingHB}`);

  const totalRemainingJEs = await prisma.journalEntry.count();
  assertCheck('Exact legitimate JournalEntries preserved', totalRemainingJEs === 14, `count: ${totalRemainingJEs}`);

  const totalRemainingLines = await prisma.journalEntryLine.count();
  assertCheck('Exact legitimate JournalEntryLines preserved', totalRemainingLines === 28, `count: ${totalRemainingLines}`);

  // 5. Accounting Verification
  const linesAgg = await prisma.$queryRaw<any[]>`
    SELECT
      COALESCE(SUM("debit"), 0) AS total_debit,
      COALESCE(SUM("credit"), 0) AS total_credit
    FROM "JournalEntryLine" l
    JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
    WHERE j."status" = 'Posted' AND j."isDeleted" = false
  `;
  const totalDebit = Number(linesAgg[0].total_debit);
  const totalCredit = Number(linesAgg[0].total_credit);
  assertCheck('Total Debit == Total Credit', totalDebit === totalCredit, `Debit: ${totalDebit}, Credit: ${totalCredit}`);
  assertCheck('Legitimate total equals 363,000', totalDebit === 363000, `Total: ${totalDebit}`);

  // Check specific account balances
  const accounts = await prisma.account.findMany({
    where: { currentBalance: { not: 0 } },
    select: { glCode: true, accountName: true, currentBalance: true }
  });
  console.log('\n--- Remaining Non-Zero GL Balances ---');
  for (const a of accounts) {
    console.log(`Account ${a.glCode} (${a.accountName}): ${a.currentBalance}`);
  }

  const cashAcc = accounts.find(a => a.glCode === '1010103');
  assertCheck('Cash in Hand balance is 363,000', Number(cashAcc?.currentBalance) === 363000, `actual: ${cashAcc?.currentBalance}`);

  const bankAcc = await prisma.account.findFirst({ where: { glCode: '1010101' } });
  assertCheck('Bank balance is 0 (no legit bank txs)', Number(bankAcc?.currentBalance) === 0, `actual: ${bankAcc?.currentBalance}`);

  const arAcc = await prisma.account.findFirst({ where: { glCode: '1010201' } });
  assertCheck('Accounts Receivable balance is 0', Number(arAcc?.currentBalance) === 0, `actual: ${arAcc?.currentBalance}`);

  // Check Master Data Preservation
  const superAdmin = await prisma.user.findFirst({ where: { email: 'admin@erp.com' } });
  assertCheck('Super Admin preserved', !!superAdmin && superAdmin.isActive);

  const accountant = await prisma.user.findFirst({ where: { email: 'account@erp.com' } });
  assertCheck('Accountant user preserved', !!accountant && accountant.isActive);

  const coaCount = await prisma.account.count();
  assertCheck('Chart of Accounts master intact', coaCount >= 100, `count: ${coaCount}`);

  // 6. Test Dashboard / Financial Summary API Service
  console.log('\n--- Testing Live Financial Summary API Service ---');
  const summary = await AccountingService.getFinancialSummary();
  console.log('Financial Summary:', {
    totalAssets: summary.totalAssets,
    totalLiabilities: summary.totalLiabilities,
    totalRevenue: summary.totalRevenue,
    totalExpense: summary.totalExpense,
    cashBalance: summary.cashBalance,
    bankBalance: summary.bankBalance,
    netPeriodIncome: summary.netPeriodIncome,
    totalEquity: summary.totalEquity,
  });

  assertCheck('Summary Total Assets == 363,000', summary.totalAssets === 363000);
  assertCheck('Summary Total Revenue == 363,000', summary.totalRevenue === 363000);
  assertCheck('Summary Total Expense == 0', summary.totalExpense === 0);
  assertCheck('Summary Total Liabilities == 0', summary.totalLiabilities === 0);
  assertCheck('Summary Cash Balance == 363,000', summary.cashBalance === 363000);
  assertCheck('Accounting equation holds: Assets == Liabilities + Equity', summary.totalAssets === summary.totalLiabilities + summary.totalEquity);

  console.log('\n====================================================');
  if (allChecksPassed) {
    console.log('🎉 ALL 33 VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
  } else {
    console.error('❌ SOME CHECKS FAILED!');
    process.exit(1);
  }
  console.log('====================================================');
}

verify()
  .catch((e) => {
    console.error('❌ Verification script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
