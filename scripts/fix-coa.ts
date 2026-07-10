
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

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

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== Fixing COA Issues ===");

  // Fix revenue heads
  const allAccounts = await prisma.account.findMany();
  const accountMap = new Map(allAccounts.map(a => [a.accountName, a]));

  // Fix Sadaya-Hall
  const sadayaAccount = accountMap.get("Sadaya Hall");
  if (sadayaAccount) {
    await prisma.revenueHead.updateMany({
      where: { name: "Sadaya-Hall" },
      data: { accountId: sadayaAccount.id }
    });
  }

  // Fix Zikarya-Hall
  const zikaryaAccount = accountMap.get("Zikarya Hall");
  if (zikaryaAccount) {
    await prisma.revenueHead.updateMany({
      where: { name: "Zikarya-Hall" },
      data: { accountId: zikaryaAccount.id }
    });
  }

  // Fix Anexy-Hall → Annexy Hall
  const annexyAccount = accountMap.get("Annexy Hall");
  if (annexyAccount) {
    await prisma.revenueHead.updateMany({
      where: { name: "Anexy-Hall" },
      data: { accountId: annexyAccount.id }
    });
  }

  // Delete Faizan if it exists
  await prisma.revenueHead.deleteMany({
    where: { name: "Faizan" }
  });

  console.log("=== Fixed revenue heads!");

  // Delete legacy accounts if needed, but keeping them for now!

  console.log("=== Fix Complete ===");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

