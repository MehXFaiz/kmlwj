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

  // 1. Rename Meezan Bank Account (1100001) -> National Bank of Pakistan
  const meezanSub = await prisma.account.findUnique({ where: { glCode: '1100001' } });
  if (meezanSub) {
    await prisma.account.update({
      where: { id: meezanSub.id },
      data: { accountName: 'National Bank of Pakistan' }
    });
    console.log("✅ Renamed Subsidiary Meezan Bank Account (1100001 -> National Bank of Pakistan)");
  }

  // 2. Rename HBL Bank Account (1100002) -> NBP Zakat Account
  const hblSub = await prisma.account.findUnique({ where: { glCode: '1100002' } });
  if (hblSub) {
    await prisma.account.update({
      where: { id: hblSub.id },
      data: { accountName: 'NBP Zakat Account' }
    });
    console.log("✅ Renamed Subsidiary HBL Bank Account (1100002 -> NBP Zakat Account)");
  }

  // 3. Rename Meezan Bank Account (1010101) -> National Bank of Pakistan
  const meezanGL = await prisma.account.findUnique({ where: { glCode: '1010101' } });
  if (meezanGL) {
    await prisma.account.update({
      where: { id: meezanGL.id },
      data: { accountName: 'National Bank of Pakistan' }
    });
    console.log("✅ Renamed GL Meezan Bank Account (1010101 -> National Bank of Pakistan)");
  }

  // 4. Rename HBL Bank Account (1010102) -> NBP Zakat Account
  const hblGL = await prisma.account.findUnique({ where: { glCode: '1010102' } });
  if (hblGL) {
    await prisma.account.update({
      where: { id: hblGL.id },
      data: { accountName: 'NBP Zakat Account' }
    });
    console.log("✅ Renamed GL HBL Bank Account (1010102 -> NBP Zakat Account)");
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
