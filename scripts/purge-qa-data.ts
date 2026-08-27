import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AccountingService } from '../api/_services/accounting.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
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

export const QA_INVOICE_ITEM_IDS = [
  '6702b120-749e-49c2-9f64-4a5af42d1471',
  'ce7dca81-0db8-4642-9b5b-1d86c84c47f8',
];

export const QA_INVOICE_IDS = [
  '1fa70c9e-fd91-440b-af43-e5d40cc91bbd',
];

export const QA_ADD_INCOME_IDS = [
  'bb639fec-3146-4270-a7ea-ea2aa885ee53',
];

export const QA_SIMPLE_EXPENSE_IDS = [
  '040022dc-850d-475a-941b-102fe2fa543a',
  '90126427-9c31-4aad-b830-ccf38bef3bb3',
];

export const QA_ZAKAT_CARD_IDS = [
  '12279900-aefe-4e6c-ac7e-c7f4ddd09e19',
];

export const QA_DONATION_GIVEN_IDS = [
  '963ad0e3-8b60-474b-af57-f740031a12c7',
  '94acc172-95d3-495e-8d04-89b757bb158f',
];

export const QA_DONATION_REC_IDS = [
  'e21bb47c-70c2-43ad-bd6b-98403005cdba',
  'e094959e-6c74-4bed-99a5-9f01644a3644',
  'bbbfccbf-491a-47b6-9630-4a11daac0203',
];

export const QA_HALL_BOOKING_IDS = [
  '8886f5b5-8f41-446a-a392-01c56bde980d',
  'aa90147e-5bbe-41e5-bc76-c3dd124c54c7',
  '5c46d28c-e0ae-4d5c-984c-9bf848770e59',
];

export const QA_REVENUE_COLL_IDS = [
  '0c039db0-5911-40fc-a417-4c6428e58937',
  'e5bebfef-90d7-4ba5-9e64-4886dfc8bbe3',
  '67971403-3d48-414d-9d5c-5aef5aaa3c8e',
];

export const QA_CUSTOMER_IDS = [
  '665c112b-6532-447b-815d-172cab7a8e1a',
];

export const QA_DONOR_IDS = [
  '4c6ba3cf-f560-4893-84dd-3e73ecfe0bab',
];

export const QA_MEMBER_IDS = [
  '4ba16332-798d-4f82-b279-c1c156885b9a',
];

export const QA_BENEFICIARY_IDS = [
  '3fb118dd-015b-4460-9b65-b17d687e43a0',
];

export const QA_JOURNAL_ENTRY_IDS = [
  '77cb62db-6567-41b6-a009-34c797073c4b', // HB-1
  '5cf6e2f9-2cdc-41a6-98d2-715284b608e3', // HB-2
  '8741b245-81b4-4b6f-ab3b-3cf57f7e2717', // HB-3
  '5d49d696-26a5-40aa-805a-2d524b2e3e2d', // QA-REC-DON-001
  '4bac33b8-6cd8-496b-952e-af3ad96c1cb2', // QA-REC-DON-002
  '5620b41c-e28c-4e45-8e3e-4a740f396342', // QA-ZAKAT-REC-001
  '3ffb3de1-21db-408e-92b6-c8d812b76a84', // ZK-000001
  'a1b20fbe-167d-4abf-8155-0d127b87fb8d', // QA-REC-MED-001
  '51438693-eb1b-4ea3-bff5-387fb9148ca7', // QA-DON-GIVEN-001
  '4d252ee1-cf1a-4b43-bee6-d31de626acb1', // QA-EXP-SALARY-001
  '95101e88-3bb4-4dfd-80b2-eb81d7fceccd', // QA-EXP-FUEL-001
  'eb12d67c-33c4-48be-bd87-4b490fab4b60', // QA-REV-MEM-001
  '6c4b91d2-9df3-4956-90cb-0f20069a1763', // QA-REV-BUS-001
  '873d9988-17dc-44cf-b9c4-79643e84653f', // QA-ADD-INC-001
  'cbb54e07-9baf-4ef4-86fa-b05ee2e3ce7a', // INV-2026-QA01
  'a2b3e1e2-5e3a-4b0e-8373-28a49ea779fa', // drift-test 45000
  'b0004dbb-f67b-44b1-a17e-db6ce30320ab', // drift-test 3500
  'cd97d78e-932d-4150-98d0-1d281d20cce3', // drift-test 60000
  '650c9ee8-91bf-410a-9aea-1a98e22051d0', // drift-test 12000
  'fce556c1-3693-43f2-a7c0-e1a14103faa1', // drift-test 25000
  '9f63831f-3573-47d5-847f-a31873094228', // drift-test 8000
];

async function purgeQaData() {
  console.log('🚀 Starting Atomic Purge of QA/Test Data...');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete QA Invoice Items
    const delInvoiceItems = await tx.invoiceItem.deleteMany({
      where: { id: { in: QA_INVOICE_ITEM_IDS } },
    });
    console.log(`✓ Deleted InvoiceItem records: ${delInvoiceItems.count}`);

    // 2. Delete QA Invoices
    const delInvoices = await tx.invoice.deleteMany({
      where: { id: { in: QA_INVOICE_IDS } },
    });
    console.log(`✓ Deleted Invoice records: ${delInvoices.count}`);

    // 3. Delete QA Add Income Record
    const delAddIncome = await tx.addIncomeRecord.deleteMany({
      where: { id: { in: QA_ADD_INCOME_IDS } },
    });
    console.log(`✓ Deleted AddIncomeRecord records: ${delAddIncome.count}`);

    // 4. Delete QA Simple Expenses
    const delSimpleExp = await tx.simpleExpense.deleteMany({
      where: { id: { in: QA_SIMPLE_EXPENSE_IDS } },
    });
    console.log(`✓ Deleted SimpleExpense records: ${delSimpleExp.count}`);

    // 5. Delete QA Zakat Cards
    const delZakatCard = await tx.zakatCard.deleteMany({
      where: { id: { in: QA_ZAKAT_CARD_IDS } },
    });
    console.log(`✓ Deleted ZakatCard records: ${delZakatCard.count}`);

    // 6. Delete QA Donations Given
    const delDonationGiven = await tx.donation.deleteMany({
      where: { id: { in: QA_DONATION_GIVEN_IDS } },
    });
    console.log(`✓ Deleted Donation (given) records: ${delDonationGiven.count}`);

    // 7. Delete QA Donations Received
    const delDonationRec = await tx.donationReceived.deleteMany({
      where: { id: { in: QA_DONATION_REC_IDS } },
    });
    console.log(`✓ Deleted DonationReceived records: ${delDonationRec.count}`);

    // 8. Delete QA Hall Bookings
    const delHallBook = await tx.hallBooking.deleteMany({
      where: { id: { in: QA_HALL_BOOKING_IDS } },
    });
    console.log(`✓ Deleted HallBooking records: ${delHallBook.count}`);

    // 9. Delete QA Revenue Collections
    const delRevColl = await tx.revenueCollection.deleteMany({
      where: { id: { in: QA_REVENUE_COLL_IDS } },
    });
    console.log(`✓ Deleted RevenueCollection records: ${delRevColl.count}`);

    // 10. Delete QA Master Entities
    const delCust = await tx.customer.deleteMany({
      where: { id: { in: QA_CUSTOMER_IDS } },
    });
    console.log(`✓ Deleted Customer records: ${delCust.count}`);

    const delDonor = await tx.donor.deleteMany({
      where: { id: { in: QA_DONOR_IDS } },
    });
    console.log(`✓ Deleted Donor records: ${delDonor.count}`);

    const delMember = await tx.member.deleteMany({
      where: { id: { in: QA_MEMBER_IDS } },
    });
    console.log(`✓ Deleted Member records: ${delMember.count}`);

    const delBen = await tx.beneficiary.deleteMany({
      where: { id: { in: QA_BENEFICIARY_IDS } },
    });
    console.log(`✓ Deleted Beneficiary records: ${delBen.count}`);

    // 11. Delete QA Journal Entry Lines
    const delJELines = await tx.journalEntryLine.deleteMany({
      where: { journalEntryId: { in: QA_JOURNAL_ENTRY_IDS } },
    });
    console.log(`✓ Deleted JournalEntryLine records: ${delJELines.count}`);

    // 12. Delete QA Journal Entries
    const delJE = await tx.journalEntry.deleteMany({
      where: { id: { in: QA_JOURNAL_ENTRY_IDS } },
    });
    console.log(`✓ Deleted JournalEntry records: ${delJE.count}`);

    // 13. Recalculate GL Balances from remaining legitimate transactions
    console.log('🔄 Recalculating all account balances from legitimate transactions...');
    const recalcResult = await AccountingService.recalculateAllBalances(tx);
    console.log(`✓ Account balances updated: ${recalcResult.updated}`);

    return {
      invoiceItems: delInvoiceItems.count,
      invoices: delInvoices.count,
      addIncome: delAddIncome.count,
      simpleExpenses: delSimpleExp.count,
      zakatCards: delZakatCard.count,
      donationsGiven: delDonationGiven.count,
      donationsReceived: delDonationRec.count,
      hallBookings: delHallBook.count,
      revenueCollections: delRevColl.count,
      customers: delCust.count,
      donors: delDonor.count,
      members: delMember.count,
      beneficiaries: delBen.count,
      journalEntryLines: delJELines.count,
      journalEntries: delJE.count,
      accountsRecalculated: recalcResult.updated,
    };
  }, {
    timeout: 60000,
    maxWait: 20000,
  });

  console.log('\n=============================================');
  console.log('🎉 ATOMIC PURGE COMPLETED SUCCESSFULLY!');
  console.log('=============================================');
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  purgeQaData()
    .catch((e) => {
      console.error('❌ Purge failed and rolled back:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
