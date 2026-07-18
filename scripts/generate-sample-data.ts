
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
  console.log('🔍 Inspecting existing data...');
  // Check users
  const users = await prisma.user.findMany();
  console.log('Users:', users.map(u => ({ id: u.id, name: u.fullName, email: u.email })));

  const adminUser = users.find(u => u.role?.name === 'Super Admin') || users[0];
  if (!adminUser) {
    throw new Error('No users found!');
  }
  console.log('Using user for transactions:', adminUser.fullName);

  // Check Revenue Heads
  const revenueHeads = await prisma.revenueHead.findMany({ include: { account: true } });
  console.log('Revenue Heads:', revenueHeads.map(rh => ({
    id: rh.id,
    name: rh.name,
    category: rh.category,
    accountId: rh.accountId,
    accountName: rh.account?.accountName
  })));

  // Check Expense Heads
  const expenseHeads = await prisma.expenseHead.findMany({ include: { account: true } });
  console.log('Expense Heads:', expenseHeads.map(eh => ({
    id: eh.id,
    name: eh.name,
    category: eh.category,
    accountId: eh.accountId,
    accountName: eh.account?.accountName
  })));

  // Check Cash and Bank Accounts
  const cashAndBankAccounts = await prisma.account.findMany({
    where: {
      OR: [
        { accountName: { contains: 'Cash', mode: 'insensitive' } },
        { accountName: { contains: 'Bank', mode: 'insensitive' } }
      ],
      accountLevel: { in: ['GL', 'SUBSIDIARY'] },
      children: { none: {} },
      isLocked: false
    },
    orderBy: { glCode: 'asc' }
  });
  console.log('Cash & Bank Accounts:', cashAndBankAccounts.map(a => ({
    id: a.id,
    code: a.glCode,
    name: a.accountName
  })));

  const cashAccount = cashAndBankAccounts.find(a => a.accountName.toLowerCase().includes('cash')) || cashAndBankAccounts[0];
  const bankAccount = cashAndBankAccounts.find(a => a.accountName.toLowerCase().includes('bank')) || cashAndBankAccounts[1];

  console.log('📝 Creating sample transactions...');

  // Fiscal year info - current and previous
  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;

  const transactions = [];

  // --- Sample Income Transactions ---
  // 5 Membership Fees
  const membershipRevenueHead = revenueHeads.find(rh => rh.name.toLowerCase().includes('membership') || rh.category?.toLowerCase().includes('membership')) || revenueHeads[0];
  if (membershipRevenueHead) {
    transactions.push(
      await createIncome(adminUser.id, membershipRevenueHead.id, 500, 'CASH', cashAccount?.id, new Date(currentYear, 0, 15)),
      await createIncome(adminUser.id, membershipRevenueHead.id, 1000, 'BANK', bankAccount?.id, new Date(currentYear, 2, 20)),
      await createIncome(adminUser.id, membershipRevenueHead.id, 1500, 'CASH', cashAccount?.id, new Date(previousYear, 5, 10)),
      await createIncome(adminUser.id, membershipRevenueHead.id, 2500, 'BANK', bankAccount?.id, new Date(previousYear, 8, 5)),
      await createIncome(adminUser.id, membershipRevenueHead.id, 5000, 'CASH', cashAccount?.id, new Date(currentYear, 4, 1))
    );
  }

  // 3 Zakat Receipts (using Donation Received or Revenue Head)
  const zakatRevenueHead = revenueHeads.find(rh => rh.name.toLowerCase().includes('zakat')) || revenueHeads.find(rh => rh.category?.toLowerCase().includes('zakat')) || revenueHeads[1];
  if (zakatRevenueHead) {
    transactions.push(
      await createIncome(adminUser.id, zakatRevenueHead.id, 10000, 'CASH', cashAccount?.id, new Date(currentYear, 1, 25)),
      await createIncome(adminUser.id, zakatRevenueHead.id, 25000, 'BANK', bankAccount?.id, new Date(previousYear, 10, 15)),
      await createIncome(adminUser.id, zakatRevenueHead.id, 15000, 'CASH', cashAccount?.id, new Date(currentYear, 3, 10))
    );
  }

  // 2 Other Incomes
  const otherIncomeRevenueHead = revenueHeads.find(rh => rh.name.toLowerCase().includes('other') || rh.category?.toLowerCase().includes('other')) || revenueHeads[2];
  if (otherIncomeRevenueHead) {
    transactions.push(
      await createIncome(adminUser.id, otherIncomeRevenueHead.id, 8000, 'BANK', bankAccount?.id, new Date(previousYear, 6, 20)),
      await createIncome(adminUser.id, otherIncomeRevenueHead.id, 12000, 'CASH', cashAccount?.id, new Date(currentYear, 5, 12))
    );
  }

  // --- Sample Expense Transactions ---
  // 10 Expense entries across different heads
  const expenseAmounts = [1000, 2500, 5000, 7500, 10000, 12000, 15000, 18000, 20000, 3000];
  const expensePaymentMethods = ['CASH', 'BANK', 'CASH', 'BANK', 'CASH', 'BANK', 'CASH', 'BANK', 'CASH', 'BANK'];
  const expenseDates = [
    new Date(currentYear, 0, 20),
    new Date(previousYear, 3, 15),
    new Date(currentYear, 2, 10),
    new Date(previousYear, 7, 5),
    new Date(currentYear, 4, 25),
    new Date(previousYear, 9, 18),
    new Date(currentYear, 6, 8),
    new Date(previousYear, 11, 30),
    new Date(currentYear, 3, 12),
    new Date(previousYear, 1, 22)
  ];

  for (let i = 0; i < 10; i++) {
    const expenseHead = expenseHeads[i % expenseHeads.length];
    if (expenseHead) {
      const paymentMethod = expensePaymentMethods[i];
      const accountId = paymentMethod === 'BANK' ? bankAccount?.id : cashAccount?.id;
      transactions.push(
        await createExpense(adminUser.id, expenseHead.id, expenseAmounts[i], paymentMethod, accountId, expenseDates[i])
      );
    }
  }

  console.log('✅ Sample data generation complete!');
  console.log('Created transactions count:', transactions.length);
}

async function createIncome(userId: string, revenueHeadId: string, amount: number, paymentMethod: string, bankAccountId: string | undefined, date: Date) {
  return prisma.$transaction(async (tx) => {
    const revenueHead = await tx.revenueHead.findUnique({
      where: { id: revenueHeadId },
      include: { account: true }
    });

    const incomeAccountId = revenueHead?.accountId || revenueHead?.account?.id;

    const postingResult = await AccountingService.postReceipt(tx, {
      amount: amount,
      cashOrBankAccountId: paymentMethod === 'BANK' ? bankAccountId : undefined,
      cashOrBankAccountKeyword: paymentMethod !== 'BANK' ? 'Cash' : undefined,
      incomeAccountId: incomeAccountId || undefined,
      incomeAccountKeyword: !incomeAccountId ? (revenueHead?.name || 'Income') : undefined,
      description: `Sample Income - ${revenueHead?.name}`,
      reference: `SAMPLE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      module: 'Sample Data Generator',
      postedBy: userId,
      postingDate: date
    });

    return tx.simpleIncome.create({
      data: {
        date: date,
        revenueHeadId: revenueHeadId,
        description: `Sample ${revenueHead?.name}`,
        amount: amount,
        paymentMethod: paymentMethod,
        bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
        reference: postingResult.voucherNo,
        journalEntryId: postingResult.journalEntry.id,
        createdById: userId
      }
    });
  });
}

async function createExpense(userId: string, expenseHeadId: string, amount: number, paymentMethod: string, bankAccountId: string | undefined, date: Date) {
  return prisma.$transaction(async (tx) => {
    const expenseHead = await tx.expenseHead.findUnique({
      where: { id: expenseHeadId },
      include: { account: true }
    });

    const expenseAccountId = expenseHead?.accountId || expenseHead?.account?.id;

    const postingResult = await AccountingService.postPayment(tx, {
      amount: amount,
      cashOrBankAccountId: paymentMethod === 'BANK' ? bankAccountId : undefined,
      cashOrBankAccountKeyword: paymentMethod !== 'BANK' ? 'Cash' : undefined,
      expenseAccountId: expenseAccountId || undefined,
      expenseAccountKeyword: !expenseAccountId ? (expenseHead?.name || 'Expense') : undefined,
      description: `Sample Expense - ${expenseHead?.name}`,
      reference: `SAMPLE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      module: 'Sample Data Generator',
      postedBy: userId,
      postingDate: date
    });

    return tx.simpleExpense.create({
      data: {
        date: date,
        expenseHeadId: expenseHeadId,
        paidTo: 'Sample Vendor',
        description: `Sample ${expenseHead?.name}`,
        amount: amount,
        paymentMethod: paymentMethod,
        bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
        reference: postingResult.voucherNo,
        journalEntryId: postingResult.journalEntry.id,
        createdById: userId
      }
    });
  });
}

main()
  .catch((e) => {
    console.error('❌ Error generating sample data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
