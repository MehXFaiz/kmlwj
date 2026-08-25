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

export async function resetFinancialData(client = prisma) {
  console.log('🔄 Starting complete ERP Data Reset (deleting transactional data, preserving master config)...');

  const results = await client.$transaction(async (tx) => {
    // 1. Source Transactional Records (referencing Journal Entries & Accounts)
    const invItem = await tx.invoiceItem.deleteMany({});
    const inv = await tx.invoice.deleteMany({});
    const addInc = await tx.addIncomeRecord.deleteMany({});
    const simpInc = await tx.simpleIncome.deleteMany({});
    const simpExp = await tx.simpleExpense.deleteMany({});
    const don = await tx.donation.deleteMany({});
    const donRec = await tx.donationReceived.deleteMany({});
    const zakCard = await tx.zakatCard.deleteMany({});
    const hallBook = await tx.hallBooking.deleteMany({});
    const revColl = await tx.revenueCollection.deleteMany({});
    const pettyCashTx = await tx.pettyCashTransaction.deleteMany({});
    const pettyCashRec = await tx.pettyCashReconciliation.deleteMany({});
    const aiIssues = await tx.aiRepairIssue.deleteMany({});
    const aiLogs = await tx.aiRepairLog.deleteMany({});

    // 2. Opening Balance Transaction Records
    const obLine = await tx.openingBalanceLine.deleteMany({});
    const obBatch = await tx.openingBalanceBatch.deleteMany({});

    // 3. Journal Entry Lines & Headers
    const jel = await tx.journalEntryLine.deleteMany({});
    const je = await tx.journalEntry.deleteMany({});

    // 4. Operational Business Entities (Members, Beneficiaries, Donors, Customers)
    const famRel = await tx.familyRelationship.deleteMany({});
    const memb = await tx.member.deleteMany({});
    const ben = await tx.beneficiary.deleteMany({});
    const dnr = await tx.donor.deleteMany({});
    const cust = await tx.customer.deleteMany({});
    const refTokens = await tx.refreshToken.deleteMany({});
    const auditLogs = await tx.auditLog.deleteMany({});

    // 5. Reset Financial Years (ensure all FY are open)
    await tx.financialYear.updateMany({
      data: { isClosed: false, closedAt: null, closedById: null, reopenedAt: null, reopenedById: null, closingNotes: null }
    });

    // 6. Reset Monetary Balances across all Chart of Accounts to 0
    const accUpdate = await tx.account.updateMany({
      data: {
        initialBalance: 0,
        currentBalance: 0,
      },
    });

    // 7. Reset RevenueHead amounts to 0
    const revHeadUpdate = await tx.revenueHead.updateMany({
      data: { amount: 0 },
    });

    // 8. Reset Autoincrement Sequences
    try {
      await tx.$executeRawUnsafe('ALTER SEQUENCE "HallBooking_receiptNo_seq" RESTART WITH 1;');
    } catch (e) {}
    try {
      await tx.$executeRawUnsafe('ALTER SEQUENCE "RevenueCollection_receiptNo_seq" RESTART WITH 1;');
    } catch (e) {}

    // 9. Accounting Verification Guard
    const remainingJEs = await tx.journalEntry.count({});
    if (remainingJEs > 0) {
      throw new Error(`Integrity error: ${remainingJEs} orphan journal entries remain post deletion.`);
    }

    const totals = await tx.journalEntryLine.aggregate({
      _sum: { debit: true, credit: true }
    });
    const totalDebit = Number(totals._sum.debit || 0);
    const totalCredit = Number(totals._sum.credit || 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.01;

    if (!isBalanced) {
      throw new Error(`Accounting reconciliation failed: Total Debits (PKR ${totalDebit}) != Total Credits (PKR ${totalCredit}).`);
    }

    return {
      invItemCount: invItem.count,
      invCount: inv.count,
      addIncomeCount: addInc.count,
      simpleIncomeCount: simpInc.count,
      simpleExpenseCount: simpExp.count,
      donationGivenCount: don.count,
      donationReceivedCount: donRec.count,
      zakatCardCount: zakCard.count,
      hallBookingCount: hallBook.count,
      revenueCollectionCount: revColl.count,
      pettyCashTxCount: pettyCashTx.count,
      pettyCashRecCount: pettyCashRec.count,
      aiIssueCount: aiIssues.count,
      aiLogCount: aiLogs.count,
      obBatchCount: obBatch.count,
      obLineCount: obLine.count,
      jelCount: jel.count,
      jeCount: je.count,
      memberCount: memb.count,
      beneficiaryCount: ben.count,
      donorCount: dnr.count,
      customerCount: cust.count,
      refreshTokenCount: refTokens.count,
      auditLogCount: auditLogs.count,
      accCount: accUpdate.count,
      revHeadCount: revHeadUpdate.count,
      totalDebit,
      totalCredit,
      isBalanced
    };
  }, { timeout: 60000 });

  console.log(`✅ Deleted ${results.jeCount} Journal Entries`);
  console.log(`✅ Deleted ${results.jelCount} Journal Entry Lines`);
  console.log(`✅ Deleted ${results.addIncomeCount} Add Income Records`);
  console.log(`✅ Deleted ${results.simpleIncomeCount} Simple Income Records`);
  console.log(`✅ Deleted ${results.simpleExpenseCount} Simple Expense Records`);
  console.log(`✅ Deleted ${results.donationGivenCount} Donations Given`);
  console.log(`✅ Deleted ${results.donationReceivedCount} Donations Received`);
  console.log(`✅ Deleted ${results.zakatCardCount} Zakat Cards`);
  console.log(`✅ Deleted ${results.hallBookingCount} Hall Bookings`);
  console.log(`✅ Deleted ${results.revenueCollectionCount} Revenue Collections`);
  console.log(`✅ Deleted ${results.invCount} Invoices (${results.invItemCount} items)`);
  console.log(`✅ Deleted ${results.pettyCashTxCount} Petty Cash Transactions`);
  console.log(`✅ Deleted ${results.pettyCashRecCount} Petty Cash Reconciliations`);
  console.log(`✅ Deleted ${results.obBatchCount} Opening Balance Batches (${results.obLineCount} lines)`);
  console.log(`✅ Deleted ${results.memberCount} Members`);
  console.log(`✅ Deleted ${results.beneficiaryCount} Beneficiaries`);
  console.log(`✅ Deleted ${results.donorCount} Donors`);
  console.log(`✅ Deleted ${results.customerCount} Customers`);
  console.log(`✅ Deleted ${results.refreshTokenCount} Refresh Tokens`);
  console.log(`✅ Deleted ${results.auditLogCount} Audit Logs`);
  console.log(`✅ Reset monetary balances to 0 across ${results.accCount} Chart of Accounts`);
  console.log(`✅ Reset Revenue Head amounts across ${results.revHeadCount} heads`);
  console.log(`✅ Accounting Trial Balance: Total Debits = PKR ${results.totalDebit}, Total Credits = PKR ${results.totalCredit} (BALANCED)`);

  console.log('\n🎉 Complete ERP Data Reset completed successfully.\n\nThe system is now completely empty of transactional data and ready for fresh entries.');
  return results;
}

async function main() {
  await resetFinancialData();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch((e) => {
      console.error('❌ Error executing complete ERP data reset (transaction rolled back):', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
