import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL not set');

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function checkAll() {
  console.log('=== USERS ===');
  console.log(await prisma.user.findMany({ select: { id: true, email: true, fullName: true, role: { select: { name: true } } } }));

  console.log('=== DONORS ===');
  console.log(await prisma.donor.findMany({ select: { id: true, donorCode: true, fullName: true, cnic: true, mobile: true } }));

  console.log('=== MEMBERS ===');
  console.log(await prisma.member.findMany({ select: { id: true, memberNo: true, fullName: true, cnic: true, mobile: true } }));

  console.log('=== BENEFICIARIES ===');
  console.log(await prisma.beneficiary.findMany({ select: { id: true, name: true, cnic: true, mobile: true } }));

  console.log('=== CUSTOMERS ===');
  console.log(await prisma.customer.findMany({ select: { id: true, name: true, phone: true } }));

  console.log('=== DONATIONS RECEIVED ===');
  console.log(await prisma.donationReceived.findMany({ select: { id: true, receiptNo: true, donationType: true, amount: true, donorId: true } }));

  console.log('=== DONATIONS GIVEN ===');
  console.log(await prisma.donation.findMany({ select: { id: true, donationType: true, amount: true, beneficiaryId: true } }));

  console.log('=== HALL BOOKINGS ===');
  console.log(await prisma.hallBooking.findMany({ select: { id: true, receiptNo: true, bookerName: true, netAmount: true } }));

  console.log('=== REVENUE COLLECTIONS ===');
  console.log(await prisma.revenueCollection.findMany({ select: { id: true, receiptNo: true, title: true, category: true, amount: true } }));

  console.log('=== ZAKAT CARDS ===');
  console.log(await prisma.zakatCard.findMany({ select: { id: true, cardNumber: true, zakatAmount: true } }));

  console.log('=== INVOICES ===');
  console.log(await prisma.invoice.findMany({ select: { id: true, invoiceNo: true, total: true } }));

  console.log('=== SIMPLE INCOME ===');
  console.log(await prisma.simpleIncome.findMany({ select: { id: true, amount: true, description: true } }));

  console.log('=== SIMPLE EXPENSE ===');
  console.log(await prisma.simpleExpense.findMany({ select: { id: true, amount: true, description: true } }));

  console.log('=== JOURNAL ENTRIES ===');
  console.log(await prisma.journalEntry.findMany({ select: { id: true, voucherNo: true, voucherType: true, reference: true } }));
}

checkAll()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
