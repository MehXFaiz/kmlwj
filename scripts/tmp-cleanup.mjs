// Wipe all transactional data and reset account balances (per user's request, step 1)
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('C:/Users/dania.shabih/Documents/GitHub/kmlwj/.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const counts = {};
  // Delete children that reference JournalEntry first
  counts.zakatCards = (await prisma.zakatCard.deleteMany()).count;
  counts.revenueCollections = (await prisma.revenueCollection.deleteMany()).count;
  counts.donationsReceived = (await prisma.donationReceived.deleteMany()).count;
  counts.hallBookings = (await prisma.hallBooking.deleteMany()).count;
  counts.invoiceItems = (await prisma.invoiceItem.deleteMany()).count;
  counts.invoices = (await prisma.invoice.deleteMany()).count;
  counts.simpleIncomes = (await prisma.simpleIncome.deleteMany()).count;
  counts.simpleExpenses = (await prisma.simpleExpense.deleteMany()).count;
  counts.donations = (await prisma.donation.deleteMany()).count;
  counts.journalEntryLines = (await prisma.journalEntryLine.deleteMany()).count;
  counts.ledgerEntries = (await prisma.ledgerEntry.deleteMany()).count;
  counts.journalEntries = (await prisma.journalEntry.deleteMany()).count;

  // Reset balances to initial
  const accounts = await prisma.account.findMany({ select: { id: true, initialBalance: true } });
  for (const a of accounts) {
    await prisma.account.update({ where: { id: a.id }, data: { currentBalance: a.initialBalance } });
  }
  counts.accountsReset = accounts.length;

  console.log(JSON.stringify(counts, null, 2));
  await prisma.$disconnect();
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
