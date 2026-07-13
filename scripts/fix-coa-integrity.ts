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
  console.log("=== APPLYING COA INTEGRITY FIXES ===");

  // 1. Resolve Dynamic Mappings
  const assetType = await prisma.accountType.findFirst({ where: { name: 'ASSET' } });
  const expenseType = await prisma.accountType.findFirst({ where: { name: 'EXPENSE' } });
  const liabilityType = await prisma.accountType.findFirst({ where: { name: 'LIABILITY' } });

  const parent1010100 = await prisma.account.findUnique({ where: { glCode: '1010100' } }); // Cash & Bank Balances
  const parent4080100 = await prisma.account.findUnique({ where: { glCode: '4080100' } }); // Admin Costs
  const parent2010000 = await prisma.account.findUnique({ where: { glCode: '2010000' } }); // Current Liabilities (or 2100000)

  if (!assetType || !expenseType || !liabilityType) {
    throw new Error("Required AccountTypes (ASSET, EXPENSE, LIABILITY) not found in database.");
  }
  if (!parent1010100 || !parent4080100 || !parent2010000) {
    throw new Error("Required Parent accounts (1010100, 4080100, 2010000) not found in database.");
  }

  console.log("Resolved IDs successfully:");
  console.log(`- Asset Type ID: ${assetType.id}`);
  console.log(`- Expense Type ID: ${expenseType.id}`);
  console.log(`- Liability Type ID: ${liabilityType.id}`);
  console.log(`- Cash & Bank Balances Parent ID: ${parent1010100.id}`);
  console.log(`- Admin Costs Parent ID: ${parent4080100.id}`);
  console.log(`- Current Liabilities Parent ID: ${parent2010000.id}`);

  // 2. Update Petty Cash (12312 -> 1010104)
  const pettyCash = await prisma.account.findUnique({ where: { glCode: '12312' } });
  if (pettyCash) {
    await prisma.account.update({
      where: { id: pettyCash.id },
      data: {
        glCode: '1010104',
        accountLevel: 'GL',
        parentId: parent1010100.id,
        accountTypeId: assetType.id,
      }
    });
    console.log("✅ Updated Petty Cash (12312 -> 1010104)");
  } else {
    console.log("⚠️ Petty Cash (12312) not found or already migrated.");
  }

  // 3. Update US Savings Account (1115 -> 1010105)
  const usSavings = await prisma.account.findUnique({ where: { glCode: '1115' } });
  if (usSavings) {
    await prisma.account.update({
      where: { id: usSavings.id },
      data: {
        glCode: '1010105',
        accountLevel: 'GL',
        parentId: parent1010100.id,
        accountTypeId: assetType.id,
      }
    });
    console.log("✅ Updated US Savings Account (1115 -> 1010105)");
  } else {
    console.log("⚠️ US Savings Account (1115) not found or already migrated.");
  }

  // 4. Update Software SaaS Tools (6700 -> 4080107)
  const saaS = await prisma.account.findUnique({ where: { glCode: '6700' } });
  if (saaS) {
    await prisma.account.update({
      where: { id: saaS.id },
      data: {
        glCode: '4080107',
        accountLevel: 'GL',
        parentId: parent4080100.id,
        accountTypeId: expenseType.id,
      }
    });
    console.log("✅ Updated Software SaaS Tools (6700 -> 4080107)");
  } else {
    console.log("⚠️ Software SaaS Tools (6700) not found or already migrated.");
  }

  // 5. Update Taxes Payable - State (2115 -> 2010200)
  const taxes = await prisma.account.findUnique({ where: { glCode: '2115' } });
  if (taxes) {
    await prisma.account.update({
      where: { id: taxes.id },
      data: {
        glCode: '2010200',
        accountLevel: 'SUBSIDIARY',
        parentId: parent2010000.id,
        accountTypeId: liabilityType.id,
      }
    });
    console.log("✅ Updated Taxes Payable - State (2115 -> 2010200)");
  } else {
    console.log("⚠️ Taxes Payable - State (2115) not found or already migrated.");
  }

  console.log("=== INTEGRITY FIXES COMPLETED ===");
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
