
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
  console.log('🚀 Starting Accounting Test Suite...');

  // Step 1: Get a test user to use for postedBy
  const testUser = await prisma.user.findFirst({});
  if (!testUser) {
    console.error('❌ No user found in database. Please create a user first.');
    return;
  }
  console.log(`✅ Using test user: ${testUser.fullName} (ID: ${testUser.id})`);

  // Step 2: Get required data (revenue heads, expense heads, accounts)
  const revenueHeads = await prisma.revenueHead.findMany({ include: { account: true } });
  const expenseHeads = await prisma.expenseHead.findMany({ include: { account: true } });
  const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
  const bankAccounts = await prisma.account.findMany({
    where: {
      accountLevel: 'GL',
      isLocked: false,
      accountType: {
        name: { in: ['ASSET', 'Asset'], mode: 'insensitive' },
      },
      OR: [
        { accountName: { contains: 'Bank', mode: 'insensitive' } },
        { detailType: { equals: 'Bank', mode: 'insensitive' } },
      ],
    },
  });

  console.log(`✅ Found ${revenueHeads.length} revenue heads, ${expenseHeads.length} expense heads`);
  console.log(`✅ Cash account: ${cashAccount.glCode} - ${cashAccount.accountName}`);
  console.log(`✅ Bank accounts: ${bankAccounts.map(b => `${b.glCode} - ${b.accountName}`).join(', ')}`);

  // Step 3: Create sample income transactions
  console.log('\n📝 Creating sample income transactions...');
  const incomeAmounts = [500, 1200, 2500, 3000, 5000];
  const zakatAmounts = [10000, 25000, 15000];
  const otherIncomeAmounts = [8000, 12000];
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const incomeTransactions = [];

  // Membership fees
  const membershipHead = revenueHeads.find(r => r.name === 'Membership Fee');
  if (membershipHead) {
    for (let i = 0; i < incomeAmounts.length; i++) {
      const amount = incomeAmounts[i];
      const isCurrentYear = i % 2 === 0;
      const isCash = i % 2 === 0;
      const date = new Date(isCurrentYear ? currentYear : lastYear, i, 15);
      const transaction = await createIncomeTransaction(
        membershipHead,
        amount,
        date,
        isCash ? 'CASH' : 'BANK',
        isCash ? cashAccount.id : bankAccounts[0]?.id,
        testUser.id
      );
      incomeTransactions.push(transaction);
      console.log(`✅ Created membership fee: ${amount} PKR (${isCash ? 'Cash' : 'Bank'}, ${isCurrentYear ? currentYear : lastYear})`);
    }
  }

  // Zakat
  const zakatHead = revenueHeads.find(r => r.name === 'Zakat');
  if (zakatHead) {
    for (let i = 0; i < zakatAmounts.length; i++) {
      const amount = zakatAmounts[i];
      const isCurrentYear = i % 2 === 0;
      const isCash = i % 2 !== 0;
      const date = new Date(isCurrentYear ? currentYear : lastYear, i + 3, 20);
      const transaction = await createIncomeTransaction(
        zakatHead,
        amount,
        date,
        isCash ? 'CASH' : 'BANK',
        isCash ? cashAccount.id : bankAccounts[0]?.id,
        testUser.id
      );
      incomeTransactions.push(transaction);
      console.log(`✅ Created zakat: ${amount} PKR (${isCash ? 'Cash' : 'Bank'}, ${isCurrentYear ? currentYear : lastYear})`);
    }
  }

  // Other income
  const otherIncomeHead = revenueHeads.find(r => r.name === 'Coconut Income') || revenueHeads.find(r => r.category === 'Other Income & Donations');
  if (otherIncomeHead) {
    for (let i = 0; i < otherIncomeAmounts.length; i++) {
      const amount = otherIncomeAmounts[i];
      const isCurrentYear = i % 2 === 0;
      const isCash = i % 2 === 0;
      const date = new Date(isCurrentYear ? currentYear : lastYear, i + 6, 10);
      const transaction = await createIncomeTransaction(
        otherIncomeHead,
        amount,
        date,
        isCash ? 'CASH' : 'BANK',
        isCash ? cashAccount.id : bankAccounts[0]?.id,
        testUser.id
      );
      incomeTransactions.push(transaction);
      console.log(`✅ Created other income: ${amount} PKR (${isCash ? 'Cash' : 'Bank'}, ${isCurrentYear ? currentYear : lastYear})`);
    }
  }

  // Step 4: Create sample expense transactions
  console.log('\n📝 Creating sample expense transactions...');
  const expenseAmounts = [1000, 2500, 5000, 8000, 12000, 15000, 18000, 20000, 3000, 7000];
  const expenseTransactions = [];

  for (let i = 0; i < expenseAmounts.length; i++) {
    const amount = expenseAmounts[i];
    const expenseHead = expenseHeads[i % expenseHeads.length];
    const isCurrentYear = i % 2 === 0;
    const isCash = i % 2 !== 0;
    const date = new Date(isCurrentYear ? currentYear : lastYear, i, 25);
    const transaction = await createExpenseTransaction(
      expenseHead,
      amount,
      date,
      isCash ? 'CASH' : 'BANK',
      isCash ? cashAccount.id : bankAccounts[0]?.id,
      testUser.id
    );
    expenseTransactions.push(transaction);
    console.log(`✅ Created expense: ${amount} PKR for ${expenseHead.name} (${isCash ? 'Cash' : 'Bank'}, ${isCurrentYear ? currentYear : lastYear})`);
  }

  // Step 5: Recalculate all balances to ensure accuracy
  console.log('\n🔄 Recalculating all account balances...');
  await AccountingService.recalculateAllBalances(prisma);
  console.log('✅ Balances recalculated');

  // Step 6: Print summary
  console.log('\n📊 Summary:');
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  console.log(`Total Income: ${totalIncome} PKR`);
  console.log(`Total Expense: ${totalExpense} PKR`);
  console.log(`Net: ${totalIncome - totalExpense} PKR`);

  // Print cash and bank balances
  const updatedCashAccount = await prisma.account.findUnique({ where: { id: cashAccount.id } });
  const updatedBankAccounts = await Promise.all(bankAccounts.map(b => prisma.account.findUnique({ where: { id: b.id } })));
  console.log('\n💸 Account Balances:');
  console.log(`Cash in Hand: ${updatedCashAccount?.currentBalance} PKR`);
  updatedBankAccounts.forEach(b => {
    if (b) console.log(`${b.accountName}: ${b.currentBalance} PKR`);
  });

  console.log('\n✅ Test data creation complete!');
}

async function createIncomeTransaction(
  revenueHead: any,
  amount: number,
  date: Date,
  paymentMethod: string,
  bankAccountId: string | null,
  userId: string
) {
  const incomeAccountId = revenueHead.accountId || revenueHead.account?.id;

  const postingResult = await prisma.$transaction((tx) =>
    AccountingService.postReceipt(tx, {
      amount,
      cashOrBankAccountId: paymentMethod === 'BANK' && bankAccountId ? bankAccountId : undefined,
      cashOrBankAccountKeyword: paymentMethod !== 'BANK' ? 'Cash' : undefined,
      incomeAccountId: incomeAccountId || undefined,
      incomeAccountKeyword: !incomeAccountId ? revenueHead.name : undefined,
      description: `Test income: ${revenueHead.name}`,
      reference: 'Test Receipt',
      module: 'Test Suite',
      postedBy: userId,
      postingDate: date,
    })
  );

  return prisma.simpleIncome.create({
    data: {
      date,
      revenueHeadId: revenueHead.id,
      description: `Test income: ${revenueHead.name}`,
      amount,
      paymentMethod,
      bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
      reference: 'Test Receipt',
      journalEntryId: postingResult.journalEntry.id,
      createdById: userId,
    },
    include: { revenueHead: true },
  });
}

async function createExpenseTransaction(
  expenseHead: any,
  amount: number,
  date: Date,
  paymentMethod: string,
  bankAccountId: string | null,
  userId: string
) {
  const expenseAccountId = expenseHead.accountId || expenseHead.account?.id;

  const postingResult = await prisma.$transaction((tx) =>
    AccountingService.postPayment(tx, {
      amount,
      cashOrBankAccountId: paymentMethod === 'BANK' && bankAccountId ? bankAccountId : undefined,
      cashOrBankAccountKeyword: paymentMethod !== 'BANK' ? 'Cash' : undefined,
      expenseAccountId: expenseAccountId || undefined,
      expenseAccountKeyword: !expenseAccountId ? expenseHead.name : undefined,
      description: `Test expense: ${expenseHead.name}`,
      reference: 'Test Payment',
      module: 'Test Suite',
      postedBy: userId,
      postingDate: date,
    })
  );

  return prisma.simpleExpense.create({
    data: {
      date,
      expenseHeadId: expenseHead.id,
      paidTo: 'Test Vendor',
      description: `Test expense: ${expenseHead.name}`,
      amount,
      paymentMethod,
      bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
      reference: 'Test Payment',
      journalEntryId: postingResult.journalEntry.id,
      createdById: userId,
    },
    include: { expenseHead: true },
  });
}

main()
  .catch((e) => {
    console.error('❌ Error in test script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
