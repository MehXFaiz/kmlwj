import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require') || connectionString?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const accs = await prisma.account.findMany({
    where: {
      OR: [
        { glCode: { startsWith: '10101' } },
        { glCode: { startsWith: '10102' } },
        { accountName: { contains: 'Bank', mode: 'insensitive' } },
        { accountName: { contains: 'Cash', mode: 'insensitive' } },
      ],
    },
    orderBy: { glCode: 'asc' },
    select: {
      glCode: true,
      accountName: true,
      accountLevel: true,
      detailType: true,
      currentBalance: true,
    },
  });

  console.log('=== REMAINING CASH & BANK ACCOUNTS ===');
  for (const a of accs) {
    console.log(`[${a.glCode}] ${a.accountName} (${a.accountLevel}, ${a.detailType}) - Balance: Rs ${a.currentBalance}`);
  }

  const testAccounts = await prisma.account.findMany({
    where: {
      accountName: { contains: 'Test', mode: 'insensitive' },
    },
  });
  console.log(`\nRemaining accounts containing 'Test': ${testAccounts.length}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
