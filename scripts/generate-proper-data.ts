
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
  console.log('Loading data...');
  // Get admin user
  const adminUser = await prisma.user.findFirstOrThrow({ where: { fullName: 'admin' } });
  console.log('Using admin:', adminUser.id);

  // Get revenue heads
  const revenueHeads = await prisma.revenueHead.findMany({ include: { account: true } });
  const membershipHead = revenueHeads.find(rh => rh.name === 'Membership Fee')!;
  const zakatHead = revenueHeads.find(rh => rh.name === 'Zakat')!;
  const otherHead = revenueHeads.find(rh => rh.name === 'Bus Booking')!;
  console.log('Revenue heads found:', revenueHeads.map(rh => rh.name));

  // Get expense heads
  const expenseHeads = await prisma.expenseHead.findMany({ include: { account: true } });

  // Get accounts
  const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
  const bankAccount = await prisma.account.findFirstOrThrow({ where: { accountName: { contains: 'Meezan' } } });

  console.log('Cash account:', cashAccount.glCode, cashAccount.accountName);
  console.log('Bank account:', bankAccount.glCode, bankAccount.accountName);

  console.log('Creating membership transactions...');
  // Create 5 membership fee transactions
  const membershipAmounts = [500, 1000, 1500, 2500, 5000];
  const membershipDates = [
    new Date(2026, 0, 15), // Jan 2026
    new Date(2026, 2, 20), // March 2026
    new Date(2025, 5, 10), // June 2025
    new Date(2025, 8, 5), // September 2025
    new Date(2026, 4, 1), // May 2026
  ];
  const membershipPaymentMethods = ['CASH', 'BANK', 'CASH', 'BANK', 'CASH'];

  for (let i = 0; i < membershipAmounts.length; i++) {
    console.log('Creating membership', i+1, membershipAmounts[i]);
    await createIncome(
      adminUser.id,
      membershipHead,
      membershipAmounts[i],
      membershipPaymentMethods[i],
      membershipPaymentMethods[i] === 'CASH' ? cashAccount : bankAccount,
      membershipDates[i],
    );
  }
  console.log('✅ Membership transactions created!');

  console.log('Creating zakat transactions...');
  // Zakat 3 transactions
  const zakatAmounts = [10000, 25000, 15000];
  const zakatDates = [
    new Date(2026, 1, 25),
    new Date(2025, 10, 15),
    new Date(2026, 3, 10),
  ];
  const zakatPaymentMethods = ['CASH', 'BANK', 'CASH'];
  for (let i = 0; i < zakatAmounts.length; i++) {
    console.log('Creating zakat', i+1, zakatAmounts[i]);
    await createIncome(
      adminUser.id,
      zakatHead,
      zakatAmounts[i],
      zakatPaymentMethods[i],
      zakatPaymentMethods[i] === 'CASH' ? cashAccount : bankAccount,
      zakatDates[i],
    );
  }
  console.log('✅ Zakat transactions created!');

  console.log('Creating other income transactions...');
  // Other Income 2 transactions
  const otherAmounts = [8000, 12000];
  const otherDates = [new Date(2025, 6, 20), new Date(2026, 5, 12)];
  const otherPaymentMethods = ['BANK', 'CASH'];
  for (let i = 0; i < otherAmounts.length; i++) {
    console.log('Creating other income', i+1, otherAmounts[i]);
    await createIncome(
      adminUser.id,
      otherHead,
      otherAmounts[i],
      otherPaymentMethods[i],
      otherPaymentMethods[i] === 'CASH' ? cashAccount : bankAccount,
      otherDates[i],
    );
  }
  console.log('✅ Other income transactions created!');

  console.log('Creating expense transactions...');
  // Create 10 expenses
  const expenseAmounts = [1000, 2500, 5000, 7500, 10000, 12000, 15000, 18000, 20000, 3000];
  const expenseDates = [
    new Date(2026, 0, 20),
    new Date(2025, 3, 15),
    new Date(2026, 2, 10),
    new Date(2025, 7, 5),
    new Date(2026, 4, 25),
    new Date(2025, 9, 18),
    new Date(2026, 6, 8),
    new Date(2025, 11, 30),
    new Date(2026, 3, 12),
    new Date(2025, 1, 22),
  ];

  for (let i = 0; i < 10; i++) {
    const expenseHead = expenseHeads[i % expenseHeads.length];
    const paymentMethod = i % 2 === 0 ? 'CASH' : 'BANK';
    console.log('Creating expense', i+1, expenseAmounts[i], expenseHead.name);
    await createExpense(
      adminUser.id,
      expenseHead,
      expenseAmounts[i],
      paymentMethod,
      paymentMethod === 'CASH' ? cashAccount : bankAccount,
      expenseDates[i],
    );
  }
  console.log('✅ Expense transactions created!');

  // Recalculate all balances
  await AccountingService.recalculateAllBalances(prisma);

  console.log('✅ All transactions created!');
}

async function createIncome(
  userId: string,
  revenueHead: any,
  amount: number,
  paymentMethod: string,
  cashOrBankAccount: any,
  postingDate: Date,
) {
  return prisma.$transaction(async (tx) => {
    const postingResult = await AccountingService.postReceipt(tx, {
      amount,
      cashOrBankAccountId: cashOrBankAccount.id,
      incomeAccountId: revenueHead.accountId || revenueHead.account?.id,
      reference: `Sample ${revenueHead.name}`,
      description: `Sample ${revenueHead.name}`,
      module: 'Data Generator',
      postedBy: userId,
      postingDate,
    });

    await tx.simpleIncome.create({
      data: {
        date: postingDate,
        revenueHeadId: revenueHead.id,
        description: `Sample ${revenueHead.name}`,
        amount,
        paymentMethod,
        bankAccountId: paymentMethod === 'BANK' ? cashOrBankAccount.id : null,
        reference: postingResult.voucherNo,
        journalEntryId: postingResult.journalEntry.id,
        createdById: userId,
      },
    });

    return postingResult;
  }, {
    maxWait: 30000,
    timeout: 60000,
  });
}

async function createExpense(
  userId: string,
  expenseHead: any,
  amount: number,
  paymentMethod: string,
  cashOrBankAccount: any,
  postingDate: Date,
) {
  return prisma.$transaction(async (tx) => {
    const postingResult = await AccountingService.postPayment(tx, {
      amount,
      cashOrBankAccountId: cashOrBankAccount.id,
      expenseAccountId: expenseHead.accountId || expenseHead.account?.id,
      reference: `Sample ${expenseHead.name}`,
      description: `Sample ${expenseHead.name}`,
      module: 'Data Generator',
      postedBy: userId,
      postingDate,
    });

    await tx.simpleExpense.create({
      data: {
        date: postingDate,
        expenseHeadId: expenseHead.id,
        paidTo: 'Sample Vendor',
        description: `Sample ${expenseHead.name}`,
        amount,
        paymentMethod,
        bankAccountId: paymentMethod === 'BANK' ? cashOrBankAccount.id : null,
        reference: postingResult.voucherNo,
        journalEntryId: postingResult.journalEntry.id,
        createdById: userId,
      },
    });

    return postingResult;
  }, {
    maxWait: 30000,
    timeout: 60000,
  });
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
