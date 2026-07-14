import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runTimedQuery(label: string, fn: () => Promise<any>) {
  console.log(`Running: ${label}...`);
  const start = Date.now();
  try {
    const res = await fn();
    console.log(`✅ ${label} finished in ${Date.now() - start}ms (Result preview: ${JSON.stringify(res).slice(0, 100)})`);
  } catch (err) {
    console.error(`❌ ${label} failed in ${Date.now() - start}ms:`, err);
  }
}

async function main() {
  console.log("=== STARTING DYNAMIC QUERY TEST ===");

  await runTimedQuery("1. count accounts", () => prisma.account.count());
  await runTimedQuery("2. count revenue heads", () => prisma.revenueHead.count());
  await runTimedQuery("3. count expense heads", () => prisma.expenseHead.count());
  await runTimedQuery("4. count journal entries", () => prisma.journalEntry.count());
  await runTimedQuery("5. count locked accounts", () => prisma.account.count({ where: { isLocked: true } }));
  await runTimedQuery("6. count active users", () => prisma.user.count({ where: { isActive: true } }));
  
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(`${currentYear}-01-01T00:00:00Z`);
  const endOfYear = new Date(`${currentYear + 1}-01-01T00:00:00Z`);

  await runTimedQuery("7. fetch ledger entries", () => prisma.ledgerEntry.findMany({
    where: { postingDate: { gte: startOfYear, lt: endOfYear } },
    include: { account: { include: { accountType: true } } }
  }));

  await runTimedQuery("8. fetch all accounts with type", () => prisma.account.findMany({
    include: { accountType: true }
  }));

  await runTimedQuery("9. fetch recent journals raw", () => prisma.journalEntry.findMany({
    take: 8,
    orderBy: { postingDate: 'desc' },
    include: { lines: true }
  }));

  const startOfMonth = new Date(currentYear, new Date().getMonth(), 1);

  await runTimedQuery("10. count pending donations", () => prisma.donation.count({
    where: { status: 'PENDING' }
  }));

  await runTimedQuery("11. aggregate donations this month", () => prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: { status: 'APPROVED', createdAt: { gte: startOfMonth } }
  }));

  await runTimedQuery("12. count hall bookings this month", () => prisma.hallBooking.count({
    where: { createdAt: { gte: startOfMonth } }
  }));

  await runTimedQuery("13. count outstanding invoices", () => prisma.invoice.count({
    where: { status: { in: ['ISSUED', 'OVERDUE'] } }
  }));

  await runTimedQuery("14. fetch pending approvals list", () => prisma.donation.findMany({
    where: { status: 'PENDING' },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { beneficiary: true }
  }));

  await runTimedQuery("15. group by donationType", () => prisma.donation.groupBy({
    by: ['donationType'],
    _sum: { amount: true },
    where: { status: 'APPROVED' }
  }));

  await runTimedQuery("16. fetch raw audit logs", () => prisma.auditLog.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { fullName: true, email: true } } }
  }));

  console.log("=== DIAGNOSTICS COMPLETED ===");
}

main()
  .catch(e => {
    console.error("Test process failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
