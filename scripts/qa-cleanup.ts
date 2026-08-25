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

async function cleanupQaTestData() {
  console.log('🧹 Starting QA Test Data Cleanup (removing only test records)...');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete QA Invoices & Items
    const inv = await tx.invoice.deleteMany({
      where: { invoiceNo: { startsWith: 'INV-2026-QA' } }
    });

    // 2. Delete QA Add Income Records
    const addInc = await tx.addIncomeRecord.deleteMany({
      where: { referenceNumber: { startsWith: 'QA-' } }
    });

    // 3. Delete QA Simple Expenses
    const simpExp = await tx.simpleExpense.deleteMany({
      where: { description: { contains: 'QA TEST DATA' } }
    });

    // 4. Delete QA Zakat Cards
    const zakCard = await tx.zakatCard.deleteMany({
      where: { cardNumber: 'ZK-000001' }
    });

    // 5. Delete QA Donations
    const don = await tx.donation.deleteMany({
      where: { remarks: { contains: 'QA TEST DATA' } }
    });

    // 6. Delete QA Donations Received
    const donRec = await tx.donationReceived.deleteMany({
      where: { narration: { contains: 'QA TEST DATA' } }
    });

    // 7. Delete QA Revenue Collections
    const revColl = await tx.revenueCollection.deleteMany({
      where: { remarks: { contains: 'QA TEST DATA' } }
    });

    // 8. Delete QA Hall Bookings
    const hallBook = await tx.hallBooking.deleteMany({
      where: { remarks: { contains: 'QA TEST DATA' } }
    });

    // 9. Delete QA Master Entities
    const cust = await tx.customer.deleteMany({
      where: { name: { startsWith: 'QA Customer' } }
    });
    const dnr = await tx.donor.deleteMany({
      where: { donorCode: { startsWith: 'QA-' } }
    });
    const ben = await tx.beneficiary.deleteMany({
      where: { name: { startsWith: 'QA Beneficiary' } }
    });
    const memb = await tx.member.deleteMany({
      where: { memberNo: { startsWith: 'QA-' } }
    });

    // 10. Delete QA Journal Entries
    const je = await tx.journalEntry.deleteMany({
      where: { description: { contains: 'QA TEST DATA' } }
    });

    // 11. Recalculate Account Balances
    const accUpdate = await tx.account.updateMany({
      data: {
        initialBalance: 0,
        currentBalance: 0,
      },
    });

    return {
      invoices: inv.count,
      addIncome: addInc.count,
      simpleExpense: simpExp.count,
      zakatCards: zakCard.count,
      donations: don.count,
      donationsReceived: donRec.count,
      revenueCollections: revColl.count,
      hallBookings: hallBook.count,
      customers: cust.count,
      donors: dnr.count,
      beneficiaries: ben.count,
      members: memb.count,
      journalEntries: je.count
    };
  });

  await AccountingService.recalculateAllBalances(prisma);

  console.log('✅ QA Test Data Cleanup finished successfully.');
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cleanupQaTestData()
    .catch(console.error)
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}

export { cleanupQaTestData };
