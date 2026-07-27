
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
  console.log('Recalculating all account balances...');
  await AccountingService.recalculateAllBalances(prisma);
  console.log('Balances recalculated!');

  console.log('\nChecking leaf accounts only:');
  const allAccounts = await prisma.account.findMany({ include: { accountType: true }, orderBy: { glCode: 'asc' } });

  for (const acc of allAccounts) {
    const hasChildren = allAccounts.some(a => a.parentId === acc.id);
    if (hasChildren) {
      continue;
    }

    // Single source of truth: posted journal entry lines (not the removed LedgerEntry table).
    const agg = await prisma.journalEntryLine.aggregate({
      where: { accountId: acc.id, journalEntry: { status: 'Posted' } },
      _sum: { debit: true, credit: true }
    });

    const posted = (Number(agg._sum.debit) || 0) - (Number(agg._sum.credit) || 0);
    console.log(`Account: ${acc.glCode} - ${acc.accountName} - cached=${acc.currentBalance} postedNet=${posted}`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
