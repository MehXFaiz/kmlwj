import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

let failures = 0;

function check(label: string, actual: number, expected = 0) {
  const ok = Math.abs(actual - expected) < 0.005;
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${label}: ${actual}`);
}

async function main() {
  console.log('── Transaction tables (must all be 0) ──');
  check('JournalEntries', await prisma.journalEntry.count());
  check('JournalEntryLines', await prisma.journalEntryLine.count());
  check('AddIncomeRecords', await prisma.addIncomeRecord.count());
  check('SimpleIncomes', await prisma.simpleIncome.count());
  check('SimpleExpenses', await prisma.simpleExpense.count());
  check('RevenueCollections', await prisma.revenueCollection.count());
  check('Donations (Given)', await prisma.donation.count());
  check('DonationsReceived', await prisma.donationReceived.count());
  check('ZakatCards', await prisma.zakatCard.count());
  check('Invoices', await prisma.invoice.count());
  check('InvoiceItems', await prisma.invoiceItem.count());
  check('HallBookings', await prisma.hallBooking.count());
  check('PettyCashTransactions', await prisma.pettyCashTransaction.count());
  check('PettyCashReconciliations', await prisma.pettyCashReconciliation.count());
  check('OpeningBalanceBatches', await prisma.openingBalanceBatch.count());
  check('OpeningBalanceLines', await prisma.openingBalanceLine.count());
  check('AiRepairIssues', await prisma.aiRepairIssue.count());
  check('AiRepairLogs', await prisma.aiRepairLog.count());

  console.log('\n── Orphan checks ──');
  const orphanLines = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "JournalEntryLine" jel
    LEFT JOIN "JournalEntry" je ON je.id = jel."journalEntryId"
    WHERE je.id IS NULL`;
  check('Orphan JournalEntryLines (no parent entry)', Number(orphanLines[0].n));

  console.log('\n── Trial balance / ledger sums (must all be 0) ──');
  const jelSum = await prisma.journalEntryLine.aggregate({ _sum: { debit: true, credit: true } });
  check('Trial Balance Debit', Number(jelSum._sum.debit) || 0);
  check('Trial Balance Credit', Number(jelSum._sum.credit) || 0);

  console.log('\n── Account balances (must all be 0) ──');
  const nonZero = await prisma.account.findMany({
    where: { OR: [{ currentBalance: { not: 0 } }, { initialBalance: { not: 0 } }] },
    select: { glCode: true, accountName: true, initialBalance: true, currentBalance: true },
  });
  check('Accounts with non-zero balance', nonZero.length);

  const named = ['Cash in Hand', 'National Bank of Pakistan', 'Petty Cash'];
  for (const name of named) {
    const acc = await prisma.account.findFirst({
      where: { accountName: { contains: name, mode: 'insensitive' } },
      select: { glCode: true, accountName: true, currentBalance: true },
    });
    if (acc) {
      check(`${acc.accountName} (${acc.glCode}) balance`, Number(acc.currentBalance));
    }
  }

  console.log('\n── Preserved master data (informational) ──');
  console.log(`   Users: ${await prisma.user.count()}`);
  console.log(`   Roles: ${await prisma.role.count()}`);
  console.log(`   Permissions: ${await prisma.permission.count()}`);
  console.log(`   Accounts (COA): ${await prisma.account.count()}`);
  console.log(`   IncomeCategories: ${await prisma.incomeCategory.count()}`);
  console.log(`   ExpenseHeads: ${await prisma.expenseHead.count()}`);
  console.log(`   RevenueHeads: ${await prisma.revenueHead.count()}`);
  console.log(`   PettyCashConfigs: ${await prisma.pettyCashConfig.count()}`);
  console.log(`   FinancialYears: ${await prisma.financialYear.count()}`);
  console.log(`   Members: ${await prisma.member.count()}`);
  console.log(`   Beneficiaries: ${await prisma.beneficiary.count()}`);
  console.log(`   Donors: ${await prisma.donor.count()}`);
  console.log(`   Customers: ${await prisma.customer.count()}`);

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) FAILED — system is not at a clean zero state.`);
    process.exit(1);
  }
  console.log('\n✅ All checks passed — accounting system is at a clean zero state.');
}

main()
  .catch((e) => {
    console.error('❌ Verification error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
