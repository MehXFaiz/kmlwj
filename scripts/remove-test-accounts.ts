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

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require') || connectionString?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Only test accounts:
const TEST_GL_CODES = [
  '1010202', // Test Bank Account
  '1010203', // Test Bank Account
  '1010204', // Test Bank Account
  '1010199', // Test Cash in Hand
  '5010199', // Test Office Expense
  '5010200', // Test Expense
  '5010201', // Test Expense
  '5010202', // Test Expense
  '5010203', // Test Expense
  '4010199', // Test Donation Revenue
  '4010200', // Test Revenue
  '4010201', // Test Revenue
  '4010202', // Test Revenue
  '3030199', // Test Opening Equity
  '3030200', // Test Equity
  '3030201', // Test Equity
  '3030202', // Test Equity
  '3030203', // Test Equity
];

async function removeTestAccounts() {
  console.log('🔍 Identifying test accounts to delete...');

  const accountsToDelete = await prisma.account.findMany({
    where: {
      glCode: { in: TEST_GL_CODES },
    },
    select: {
      id: true,
      glCode: true,
      accountName: true,
      currentBalance: true,
      initialBalance: true,
      isSystemDefined: true,
    },
  });

  console.log(`Found ${accountsToDelete.length} test accounts to delete:`);
  for (const acc of accountsToDelete) {
    console.log(`  - [${acc.glCode}] ${acc.accountName} (ID: ${acc.id})`);
  }

  const ids = accountsToDelete.map(a => a.id);

  // Safety checks: check if any journal lines exist
  const linesCount = await prisma.journalEntryLine.count({
    where: { accountId: { in: ids } },
  });
  if (linesCount > 0) {
    throw new Error(`Cannot delete: ${linesCount} journal entry lines exist for these accounts!`);
  }

  // Check children
  const childrenCount = await prisma.account.count({
    where: { parentId: { in: ids } },
  });
  if (childrenCount > 0) {
    throw new Error(`Cannot delete: ${childrenCount} child accounts exist under these accounts!`);
  }

  // Delete in atomic transaction
  console.log('🚀 Deleting test accounts...');
  const result = await prisma.$transaction(async (tx) => {
    // Unlink any optional references in case any dummy configs reference them
    await tx.revenueHead.deleteMany({ where: { accountId: { in: ids } } });
    await tx.expenseHead.deleteMany({ where: { accountId: { in: ids } } });
    await tx.incomeCategory.updateMany({ where: { accountId: { in: ids } }, data: { accountId: null } });
    await tx.pettyCashConfig.deleteMany({ where: { accountId: { in: ids } } });

    const del = await tx.account.deleteMany({
      where: { id: { in: ids } },
    });

    // Recalculate GL balance cache
    console.log('🔄 Rebuilding GL balances...');
    const recalc = await AccountingService.recalculateAllBalances(tx);

    return {
      deletedAccounts: del.count,
      recalculatedAccounts: recalc.updated,
    };
  });

  console.log('✅ Success:', result);
}

removeTestAccounts()
  .catch((e) => {
    console.error('❌ Error removing test accounts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
