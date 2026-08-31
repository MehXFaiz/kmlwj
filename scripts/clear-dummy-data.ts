/**
 * CLEAR ALL DUMMY TRANSACTIONAL DATA
 *
 * This script deletes ALL transactional records from the database while
 * PRESERVING the following system/configuration data:
 *   ✅ Chart of Accounts (accounts, account types)
 *   ✅ Users, Roles, Permissions
 *   ✅ Members, Donors, Beneficiaries
 *   ✅ RevenueHeads, ExpenseHeads
 *   ✅ IncomeCategories
 *   ✅ ReservedCodes
 *   ✅ FinancialYears
 *   ✅ PettyCashConfig
 *   ✅ AuditLogs
 *
 * DELETES (transactional data):
 *   ❌ JournalEntryLines
 *   ❌ JournalEntries
 *   ❌ HallBookings
 *   ❌ Donations
 *   ❌ DonationReceived records
 *   ❌ SimpleIncome records
 *   ❌ SimpleExpense records
 *   ❌ AddIncomeRecords
 *   ❌ RevenueCollections
 *   ❌ ZakatCards
 *   ❌ PettyCashTransactions
 *   ❌ PettyCashReconciliations
 *   ❌ OpeningBalanceLines
 *   ❌ OpeningBalanceBatches
 *   ❌ InvoiceItems
 *   ❌ Invoices
 *   ❌ AiRepairIssues, AiRepairLogs
 *   ❌ Account currentBalance & initialBalance reset to 0
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       CLEARING ALL DUMMY TRANSACTIONAL DATA          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ─── Step 1: Journal Entry Lines (must go first due to FK) ───────────────────
  const jelCount = await prisma.journalEntryLine.count();
  await prisma.journalEntryLine.deleteMany({});
  console.log(`✅ Deleted ${jelCount} Journal Entry Lines`);

  // ─── Step 2: Unlink journal entries from all referencing models ───────────────
  // (Because JournalEntry is referenced by many models via unique FK, we must
  //  clear those links before deleting the journal entries themselves.)

  await prisma.hallBooking.updateMany({
    data: { journalEntryId: null }
  });
  await prisma.revenueCollection.updateMany({
    data: { journalEntryId: null }
  });
  await prisma.donationReceived.updateMany({
    data: { journalEntryId: null }
  });
  await prisma.zakatCard.updateMany({
    data: { journalEntryId: null }
  });
  await prisma.addIncomeRecord.updateMany({
    data: { journalEntryId: null }
  });
  await prisma.pettyCashTransaction.updateMany({
    data: { journalEntryId: null }
  });
  console.log('✅ Unlinked journalEntryId from all referencing models');

  // Opening balance batch links journal entries — delete lines first then batch
  const oblCount = await prisma.openingBalanceLine.count();
  await prisma.openingBalanceLine.deleteMany({});
  console.log(`✅ Deleted ${oblCount} Opening Balance Lines`);

  const obbCount = await prisma.openingBalanceBatch.count();
  await prisma.openingBalanceBatch.deleteMany({});
  console.log(`✅ Deleted ${obbCount} Opening Balance Batches`);

  // ─── Step 3: Delete all Journal Entries ──────────────────────────────────────
  const jeCount = await prisma.journalEntry.count();
  await prisma.journalEntry.deleteMany({});
  console.log(`✅ Deleted ${jeCount} Journal Entries`);

  // ─── Step 4: Transactional Records ───────────────────────────────────────────
  const hbCount = await prisma.hallBooking.count();
  await prisma.hallBooking.deleteMany({});
  console.log(`✅ Deleted ${hbCount} Hall Bookings`);

  const donCount = await prisma.donation.count();
  await prisma.donation.deleteMany({});
  console.log(`✅ Deleted ${donCount} Donation disbursements`);

  const drCount = await prisma.donationReceived.count();
  await prisma.donationReceived.deleteMany({});
  console.log(`✅ Deleted ${drCount} Donation Received records`);

  const siCount = await prisma.simpleIncome.count();
  await prisma.simpleIncome.deleteMany({});
  console.log(`✅ Deleted ${siCount} Simple Income records`);

  const seCount = await prisma.simpleExpense.count();
  await prisma.simpleExpense.deleteMany({});
  console.log(`✅ Deleted ${seCount} Simple Expense records`);

  const aiCount = await prisma.addIncomeRecord.count();
  await prisma.addIncomeRecord.deleteMany({});
  console.log(`✅ Deleted ${aiCount} Add Income Records`);

  const rcCount = await prisma.revenueCollection.count();
  await prisma.revenueCollection.deleteMany({});
  console.log(`✅ Deleted ${rcCount} Revenue Collections`);

  const zcCount = await prisma.zakatCard.count();
  await prisma.zakatCard.deleteMany({});
  console.log(`✅ Deleted ${zcCount} Zakat Cards`);

  // ─── Step 5: Petty Cash ───────────────────────────────────────────────────────
  const pcrCount = await prisma.pettyCashReconciliation.count();
  await prisma.pettyCashReconciliation.deleteMany({});
  console.log(`✅ Deleted ${pcrCount} Petty Cash Reconciliations`);

  const pctCount = await prisma.pettyCashTransaction.count();
  await prisma.pettyCashTransaction.deleteMany({});
  console.log(`✅ Deleted ${pctCount} Petty Cash Transactions`);

  // ─── Step 6: Invoices ─────────────────────────────────────────────────────────
  const iiCount = await prisma.invoiceItem.count();
  await prisma.invoiceItem.deleteMany({});
  console.log(`✅ Deleted ${iiCount} Invoice Items`);

  const invCount = await prisma.invoice.count();
  await prisma.invoice.deleteMany({});
  console.log(`✅ Deleted ${invCount} Invoices`);

  // ─── Step 7: AI Repair logs ───────────────────────────────────────────────────
  const arlCount = await prisma.aiRepairLog.count();
  await prisma.aiRepairLog.deleteMany({});
  console.log(`✅ Deleted ${arlCount} AI Repair Logs`);

  const ariCount = await prisma.aiRepairIssue.count();
  await prisma.aiRepairIssue.deleteMany({});
  console.log(`✅ Deleted ${ariCount} AI Repair Issues`);

  // ─── Step 8: Reset all account balances to 0 ─────────────────────────────────
  const updatedAccounts = await prisma.account.updateMany({
    data: {
      currentBalance: 0,
      initialBalance: 0,
    }
  });
  console.log(`✅ Reset currentBalance & initialBalance to 0 on ${updatedAccounts.count} accounts`);

  // ─── Final verification ────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                  VERIFICATION                        ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const remaining = {
    journalEntries: await prisma.journalEntry.count(),
    journalEntryLines: await prisma.journalEntryLine.count(),
    hallBookings: await prisma.hallBooking.count(),
    donations: await prisma.donation.count(),
    donationsReceived: await prisma.donationReceived.count(),
    simpleIncomes: await prisma.simpleIncome.count(),
    simpleExpenses: await prisma.simpleExpense.count(),
    addIncomeRecords: await prisma.addIncomeRecord.count(),
    revenueCollections: await prisma.revenueCollection.count(),
    zakatCards: await prisma.zakatCard.count(),
    pettyCashTransactions: await prisma.pettyCashTransaction.count(),
    pettyCashReconciliations: await prisma.pettyCashReconciliation.count(),
    invoices: await prisma.invoice.count(),
    invoiceItems: await prisma.invoiceItem.count(),
    openingBalanceBatches: await prisma.openingBalanceBatch.count(),
    openingBalanceLines: await prisma.openingBalanceLine.count(),
  };

  const preserved = {
    accounts: await prisma.account.count(),
    users: await prisma.user.count(),
    members: await prisma.member.count(),
    donors: await prisma.donor.count(),
    beneficiaries: await prisma.beneficiary.count(),
    roles: await prisma.role.count(),
    revenueHeads: await prisma.revenueHead.count(),
    expenseHeads: await prisma.expenseHead.count(),
    incomeCategories: await prisma.incomeCategory.count(),
    financialYears: await prisma.financialYear.count(),
    pettyCashConfigs: await prisma.pettyCashConfig.count(),
  };

  console.log('\n🗑️  DELETED (should all be 0):');
  let allZero = true;
  for (const [key, count] of Object.entries(remaining)) {
    const status = count === 0 ? '  ✅' : '  ❌';
    if (count !== 0) allZero = false;
    console.log(`${status} ${key}: ${count}`);
  }

  console.log('\n✅ PRESERVED:');
  for (const [key, count] of Object.entries(preserved)) {
    console.log(`  📌 ${key}: ${count}`);
  }

  if (allZero) {
    console.log('\n🎉 All transactional data cleared successfully! Dashboard will show Rs 0.');
  } else {
    console.log('\n⚠️  Some records remain — see above for details.');
  }
}

main()
  .catch(e => {
    console.error('❌ Error during data clearing:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
