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
  console.log('--- Inspecting Accounts ---');
  const accounts = await prisma.account.findMany({
    include: { accountType: true },
    orderBy: { glCode: 'asc' }
  });

  for (const a of accounts) {
    const init = Number(a.initialBalance);
    const curr = Number(a.currentBalance);
    if (init !== 0 || curr !== 0 || a.glCode.startsWith('101') || a.accountName.toLowerCase().includes('cash')) {
      console.log(`[${a.glCode}] ${a.accountName} | Level: ${a.accountLevel} | Type: ${a.accountType?.name} | Detail: ${a.detailType} | InitialBal: ${init} | CurrentBal: ${curr}`);
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
