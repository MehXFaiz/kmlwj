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

async function check() {
  console.log('--- DB Record Counts ---');
  console.log('Donors:', await prisma.donor.count());
  console.log('DonationsReceived:', await prisma.donationReceived.count());
  console.log('Members:', await prisma.member.count());
  console.log('FamilyRelationships:', await prisma.familyRelationship.count());
  console.log('Beneficiaries:', await prisma.beneficiary.count());
  console.log('Donations (Given):', await prisma.donation.count());
  console.log('SimpleIncome:', await prisma.simpleIncome.count());
  console.log('SimpleExpense:', await prisma.simpleExpense.count());
  console.log('HallBooking:', await prisma.hallBooking.count());
  console.log('Customers:', await prisma.customer.count());
  console.log('Invoices:', await prisma.invoice.count());
  console.log('InvoiceItems:', await prisma.invoiceItem.count());
  console.log('RevenueCollections:', await prisma.revenueCollection.count());
  console.log('ZakatCards:', await prisma.zakatCard.count());
  console.log('JournalEntries:', await prisma.journalEntry.count());
  console.log('JournalEntryLines:', await prisma.journalEntryLine.count());
  console.log('AuditLogs:', await prisma.auditLog.count());
  console.log('Users:', await prisma.user.count());
  
  const donors = await prisma.donor.findMany({ select: { id: true, donorCode: true, fullName: true, cnic: true } });
  console.log('\n--- Donors Detail ---');
  console.log(donors);

  const members = await prisma.member.findMany({ select: { id: true, memberNo: true, fullName: true, cnic: true } });
  console.log('\n--- Members Detail ---');
  console.log(members);

  const beneficiaries = await prisma.beneficiary.findMany({ select: { id: true, name: true, cnic: true } });
  console.log('\n--- Beneficiaries Detail ---');
  console.log(beneficiaries);

  const customers = await prisma.customer.findMany({ select: { id: true, name: true } });
  console.log('\n--- Customers Detail ---');
  console.log(customers);

  const users = await prisma.user.findMany({ select: { id: true, email: true, fullName: true } });
  console.log('\n--- Users Detail ---');
  console.log(users);
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
