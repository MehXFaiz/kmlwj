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
  console.log('=== CURRENT ACTIVE JOURNAL ENTRIES ===');
  const allPostedJEs = await prisma.journalEntry.findMany({
    where: { status: 'Posted' },
    include: { lines: { include: { account: true } } }
  });
  console.log(`Total Posted JEs (including isDeleted: true): ${allPostedJEs.length}`);
  
  const activePostedJEs = allPostedJEs.filter(j => !j.isDeleted);
  console.log(`Active Posted JEs (isDeleted: false): ${activePostedJEs.length}`);

  let totalDebitActive = 0;
  let totalCreditActive = 0;
  for (const j of activePostedJEs) {
    for (const l of j.lines) {
      totalDebitActive += Number(l.debit);
      totalCreditActive += Number(l.credit);
    }
  }
  console.log(`Active Posted JEs: Total Debit = ${totalDebitActive}, Total Credit = ${totalCreditActive}, Balanced = ${totalDebitActive === totalCreditActive}`);

  // Check legitimate JEs (HB-4 through HB-17)
  const legitJEs = allPostedJEs.filter(j => j.reference && j.reference.startsWith('HB-') && parseInt(j.reference.replace('HB-', '')) >= 4);
  console.log(`Legitimate User JEs (HB-4 to HB-17): count = ${legitJEs.length}`);
  let totalDebitLegit = 0;
  let totalCreditLegit = 0;
  const legitAccountBalances = {};
  for (const j of legitJEs) {
    for (const l of j.lines) {
      totalDebitLegit += Number(l.debit);
      totalCreditLegit += Number(l.credit);
      const acc = `${l.account?.glCode} (${l.account?.accountName})`;
      legitAccountBalances[acc] = (legitAccountBalances[acc] || 0) + Number(l.debit) - Number(l.credit);
    }
  }
  console.log(`Legitimate JEs: Total Debit = ${totalDebitLegit}, Total Credit = ${totalCreditLegit}, Balanced = ${totalDebitLegit === totalCreditLegit}`);
  console.log('Legitimate Net Balances per Account (Debit - Credit):', JSON.stringify(legitAccountBalances, null, 2));

  // Current Account Table Balances
  const accountsWithBalance = await prisma.account.findMany({
    where: { OR: [{ currentBalance: { not: 0 } }, { initialBalance: { not: 0 } }] },
    select: { glCode: true, accountName: true, initialBalance: true, currentBalance: true }
  });
  console.log('Accounts with non-zero balance currently in DB:', JSON.stringify(accountsWithBalance, null, 2));
}

checkAll()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
