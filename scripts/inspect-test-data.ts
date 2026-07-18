
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
  console.log('🔍 Inspecting database...');
  console.log('--- Accounts ---');
  const accounts = await prisma.account.findMany({
    select: { id: true, glCode: true, accountName: true, accountLevel: true, currentBalance: true },
    orderBy: { glCode: 'asc' },
  });
  accounts.forEach(acc => console.log(`${acc.glCode} - ${acc.accountName} (${acc.accountLevel})`));
  console.log(`\n--- Revenue Heads ---`);
  const revenueHeads = await prisma.revenueHead.findMany({
    include: { account: true },
    orderBy: { name: 'asc' },
  });
  revenueHeads.forEach(rh => console.log(`${rh.name} (${rh.category}) -> ${rh.account?.glCode || 'No Account'}`));
  console.log(`\n--- Expense Heads ---`);
  const expenseHeads = await prisma.expenseHead.findMany({
    include: { account: true },
    orderBy: { name: 'asc' },
  });
  expenseHeads.forEach(eh => console.log(`${eh.name} (${eh.category}) -> ${eh.account?.glCode || 'No Account'}`));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
