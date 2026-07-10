
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

async function runAudit() {
  console.log('=== CHART OF ACCOUNTS AUDIT ===\n');

  // 1. Get all accounts with parent and type details
  const allAccounts = await prisma.account.findMany({
    include: {
      accountType: true,
      parent: true,
      children: true,
    },
    orderBy: {
      glCode: 'asc',
    },
  });

  console.log('Total accounts in system:', allAccounts.length);
  console.log('\n--- Account List ---\n');
  allAccounts.forEach((acc) => {
    console.log(
      `Code: ${acc.glCode.padEnd(10)} | Name: ${acc.accountName.padEnd(35)} | Type: ${acc.accountType?.name.padEnd(10)} | Level: ${acc.accountLevel.padEnd(10)} | Parent: ${acc.parent?.glCode || '-'}`
    );
  });

  // 2. Check for duplicate GL codes
  console.log('\n--- DUPLICATE GL CODE CHECK ---');
  const codeCounts: Record<string, number> = {};
  allAccounts.forEach((acc) => {
    if (codeCounts[acc.glCode]) codeCounts[acc.glCode]++;
    else codeCounts[acc.glCode] = 1;
  });
  const duplicates = Object.entries(codeCounts).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.error('❌ Duplicate GL codes found:', duplicates);
  } else {
    console.log('✅ All GL codes are unique.');
  }

  // 3. Check account type hierarchy (code prefix matches type)
  console.log('\n--- ACCOUNT TYPE VALIDATION ---');
  const prefixes = [
    { prefix: '1', expectedType: 'ASSET', description: 'Assets' },
    { prefix: '2', expectedType: 'LIABILITY', description: 'Liabilities' },
    { prefix: '3', expectedType: 'REVENUE', description: 'Revenue' },
    { prefix: '4', expectedType: 'EXPENSE', description: 'Expenses' },
  ];
  const typeErrors = [];
  for (const acc of allAccounts) {
    const matchingPrefix = prefixes.find((p) => acc.glCode.startsWith(p.prefix));
    if (!matchingPrefix) continue;
    if (!acc.accountType) {
      typeErrors.push({ acc, error: `Account ${acc.glCode} has no account type!` });
      continue;
    }
    if (acc.accountType.name !== matchingPrefix.expectedType) {
      typeErrors.push({
        acc,
        error: `Account ${acc.glCode} (${acc.accountName}) is type ${acc.accountType.name}, should be ${matchingPrefix.expectedType}`,
      });
    }
  }
  if (typeErrors.length > 0) {
    console.error('❌ Account type errors:');
    typeErrors.forEach(({ error }) => console.error(`  - ${error}`));
  } else {
    console.log('✅ All accounts are in correct type categories.');
  }

  // 4. Check for missing GL codes (revenue/expense heads without accounts)
  console.log('\n--- REVENUE/EXPENSE HEAD CODE CHECK ---');
  const revenueHeads = await prisma.revenueHead.findMany({ include: { account: true } });
  const expenseHeads = await prisma.expenseHead.findMany({ include: { account: true } });

  const revenueWithoutCode = revenueHeads.filter((head) => !head.accountId);
  const expenseWithoutCode = expenseHeads.filter((head) => !head.accountId);

  if (revenueWithoutCode.length > 0) {
    console.warn(`⚠️ ${revenueWithoutCode.length} revenue heads missing linked account:`);
    revenueWithoutCode.forEach((head) => console.warn(`  - ${head.name} (${head.category})`));
  } else {
    console.log('✅ All revenue heads have linked accounts.');
  }

  if (expenseWithoutCode.length > 0) {
    console.warn(`⚠️ ${expenseWithoutCode.length} expense heads missing linked account:`);
    expenseWithoutCode.forEach((head) => console.warn(`  - ${head.name} (${head.category})`));
  } else {
    console.log('✅ All expense heads have linked accounts.');
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

runAudit()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
