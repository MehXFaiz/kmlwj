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

async function main() {
  console.log('🔄 Starting reset of all financial data and transactions...');

  // Delete transaction lines and entries
  const jelCount = await prisma.journalEntryLine.deleteMany({});
  console.log(`Deleted ${jelCount.count} JournalEntryLines`);

  const jeCount = await prisma.journalEntry.deleteMany({});
  console.log(`Deleted ${jeCount.count} JournalEntries`);

  const donGivenCount = await prisma.donation.deleteMany({});
  console.log(`Deleted ${donGivenCount.count} Donations Given`);

  const donRecvCount = await prisma.donationReceived.deleteMany({});
  console.log(`Deleted ${donRecvCount.count} Donations Received`);

  const seCount = await prisma.simpleExpense.deleteMany({});
  console.log(`Deleted ${seCount.count} SimpleExpenses`);

  const siCount = await prisma.simpleIncome.deleteMany({});
  console.log(`Deleted ${siCount.count} SimpleIncomes`);

  const rcCount = await prisma.revenueCollection.deleteMany({});
  console.log(`Deleted ${rcCount.count} RevenueCollections`);

  const invCount = await prisma.invoice.deleteMany({});
  console.log(`Deleted ${invCount.count} Invoices`);

  const hbCount = await prisma.hallBooking.deleteMany({});
  console.log(`Deleted ${hbCount.count} HallBookings`);

  // Delete notifications belonging to financial-transaction modules only.
  // Master-data modules (Users, Members, Welfare, Donors, Chart of Accounts,
  // Revenue/Expense Heads, Zakat Card, Family Tree) are kept.
  const financialNotificationModules = [
    'Journal Entries',
    'Journal',
    'Income',
    'Simple Income',
    'Expense',
    'Expenses',
    'Simple Expense',
    'Invoices',
    'Revenue',
    'Hall Booking',
    'Hall Bookings',
    'Donations Given',
    'Donations Received',
  ];
  const notifCount = await prisma.notification.deleteMany({
    where: { module: { in: financialNotificationModules } },
  });
  console.log(`Deleted ${notifCount.count} financial Notifications`);

  // Reset Account initialBalance and currentBalance to 0
  const accUpdate = await prisma.account.updateMany({
    data: {
      initialBalance: 0,
      currentBalance: 0,
    },
  });
  console.log(`Reset initialBalance and currentBalance to 0 across ${accUpdate.count} Accounts`);

  // Reset RevenueHead amount to 0
  await prisma.revenueHead.updateMany({
    data: { amount: 0 },
  });

  console.log('✅ All financial transactions and amounts cleared to 0 successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error clearing financial data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
