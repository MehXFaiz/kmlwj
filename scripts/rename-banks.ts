import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require') || connectionString?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== RUNNING BANK ACCOUNTS RENAME MIGRATION ===");

  // 1. Ensure Subsidiary 1100001 is named National Bank of Pakistan
  const sub1 = await prisma.account.findUnique({ where: { glCode: '1100001' } });
  if (sub1) {
    await prisma.account.update({
      where: { id: sub1.id },
      data: { accountName: 'National Bank of Pakistan' }
    });
    console.log("✅ Updated Subsidiary 1100001 -> National Bank of Pakistan");
  }

  // 2. Ensure Subsidiary 1100002 is named NBP Zakat Account
  const sub2 = await prisma.account.findUnique({ where: { glCode: '1100002' } });
  if (sub2) {
    await prisma.account.update({
      where: { id: sub2.id },
      data: { accountName: 'NBP Zakat Account' }
    });
    console.log("✅ Updated Subsidiary 1100002 -> NBP Zakat Account");
  }

  // 3. Ensure GL 1010101 is named National Bank of Pakistan
  const gl1 = await prisma.account.findUnique({ where: { glCode: '1010101' } });
  if (gl1) {
    await prisma.account.update({
      where: { id: gl1.id },
      data: { accountName: 'National Bank of Pakistan' }
    });
    console.log("✅ Updated GL 1010101 -> National Bank of Pakistan");
  }

  // 4. Ensure GL 1010102 is named NBP Zakat Bank
  const gl2 = await prisma.account.findUnique({ where: { glCode: '1010102' } });
  if (gl2) {
    await prisma.account.update({
      where: { id: gl2.id },
      data: { accountName: 'NBP Zakat Bank' }
    });
    console.log("✅ Updated GL 1010102 -> NBP Zakat Bank");
  }

  console.log("=== BANK ACCOUNTS RENAME MIGRATION COMPLETED ===");
}

main()
  .catch(e => {
    console.error("❌ Error applying fixes:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
