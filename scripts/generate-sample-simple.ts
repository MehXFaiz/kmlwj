
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
  console.log('🔍 Loading required data...');
  const adminUser = await prisma.user.findFirstOrThrow({
    where: { fullName: 'admin' }
  });
  console.log('Using user:', adminUser.fullName);

  const revenueHeads = await prisma.revenueHead.findMany({ include: { account: true } });
  const expenseHeads = await prisma.expenseHead.findMany({ include: { account: true } });
  const cashAccount = await prisma.account.findFirstOrThrow({
    where: { accountName: { contains: 'Cash', mode: 'insensitive' }, accountLevel: { in: ['GL', 'SUBSIDIARY'] } }
  });
  const bankAccount = await prisma.account.findFirstOrThrow({
    where: { accountName: { contains: 'National Bank of Pakistan', mode: 'insensitive' }, accountLevel: { in: ['GL', 'SUBSIDIARY'] } }
  });

  console.log('📝 Creating sample income transactions...');

  // --- Membership Fees (5) ---
  const membershipHead = revenueHeads.find(rh => rh.name === 'Membership Fee')!;
  await createIncome(adminUser.id, membershipHead, 500, 'CASH', cashAccount, new Date(2025, 0, 15)); // Jan 2025
  await createIncome(adminUser.id, membershipHead, 1000, 'BANK', bankAccount, new Date(2025, 2, 20)); // Mar 2025
  await createIncome(adminUser.id, membershipHead, 1500, 'CASH', cashAccount, new Date(2024, 5, 10)); // Jun 2024
  await createIncome(adminUser.id, membershipHead, 2500, 'BANK', bankAccount, new Date(2024, 8, 5)); // Sep 2024
  await createIncome(adminUser.id, membershipHead, 5000, 'CASH', cashAccount, new Date(2025, 4, 1)); // May 2025

  // --- Zakat (3) ---
  const zakatHead = revenueHeads.find(rh => rh.name === 'Zakat')!;
  await createIncome(adminUser.id, zakatHead, 10000, 'CASH', cashAccount, new Date(2025, 1, 25)); // Feb 2025
  await createIncome(adminUser.id, zakatHead, 25000, 'BANK', bankAccount, new Date(2024, 10, 15)); // Nov 2024
  await createIncome(adminUser.id, zakatHead, 15000, 'CASH', cashAccount, new Date(2025, 3, 10)); // Apr 2025

  // --- Other Income (2) ---
  const otherHead = revenueHeads.find(rh => rh.name === 'Bus Booking')!;
  await createIncome(adminUser.id, otherHead, 8000, 'BANK', bankAccount, new Date(2024, 6, 20)); // Jul 2024
  await createIncome(adminUser.id, otherHead, 12000, 'CASH', cashAccount, new Date(2025, 5, 12)); // Jun 2025

  console.log('✅ Income transactions created!');

  console.log('📝 Creating sample expense transactions...');

  const expenseAmounts = [1000, 2500, 5000, 7500, 10000, 12000, 15000, 18000, 20000, 3000];
  const expenseDates = [
    new Date(2025, 0, 20), // Jan 2025
    new Date(2024, 3, 15), // Apr 2024
    new Date(2025, 2, 10), // Mar 2025
    new Date(2024, 7, 5),  // Aug 2024
    new Date(2025, 4, 25), // May 2025
    new Date(2024, 9, 18), // Oct 2024
    new Date(2025, 6, 8),  // Jul 2025
    new Date(2024, 11, 30),// Dec 2024
    new Date(2025, 3, 12), // Apr 2025
    new Date(2024, 1, 22), // Feb 2024
  ];

  for (let i = 0; i < 10; i++) {
    const expenseHead = expenseHeads[i % expenseHeads.length];
    const paymentMethod = i % 2 === 0 ? 'CASH' : 'BANK';
    const account = paymentMethod === 'CASH' ? cashAccount : bankAccount;
    await createExpense(adminUser.id, expenseHead, expenseAmounts[i], paymentMethod, account, expenseDates[i]);
  }

  console.log('✅ Expense transactions created! All done!');
}

async function createIncome(userId: string, revenueHead: any, amount: number, paymentMethod: string, account: any, date: Date) {
  return prisma.$transaction(async (tx) => {
    // Create Journal Entry
    const je = await tx.journalEntry.create({
      data: {
        voucherNo: `BR-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        postingDate: date,
        subsidiary: 'Global',
        reference: 'Sample Income',
        description: `Sample ${revenueHead.name}`,
        postedBy: userId,
        status: 'Posted',
        voucherType: 'BR'
      }
    });

    // Debit Cash/Bank
    await tx.journalEntryLine.create({
      data: {
        journalEntryId: je.id,
        accountId: account.id,
        debit: amount,
        credit: 0,
        description: 'Debit Cash/Bank'
      }
    });

    // Credit Revenue
    await tx.journalEntryLine.create({
      data: {
        journalEntryId: je.id,
        accountId: revenueHead.accountId || revenueHead.account.id,
        debit: 0,
        credit: amount,
        description: `Credit ${revenueHead.name}`
      }
    });

    // Create Ledger Entries
    await tx.ledgerEntry.create({
      data: {
        accountId: account.id,
        debit: amount,
        credit: 0,
        reference: je.voucherNo,
        description: `Sample ${revenueHead.name}`,
        postingDate: date
      }
    });

    await tx.ledgerEntry.create({
      data: {
        accountId: revenueHead.accountId || revenueHead.account.id,
        debit: 0,
        credit: amount,
        reference: je.voucherNo,
        description: `Sample ${revenueHead.name}`,
        postingDate: date
      }
    });

    // Update account balances
    await tx.account.update({
      where: { id: account.id },
      data: { currentBalance: { increment: amount } }
    });

    await tx.account.update({
      where: { id: revenueHead.accountId || revenueHead.account.id },
      data: { currentBalance: { increment: amount } }
    });

    // Create Simple Income
    await tx.simpleIncome.create({
      data: {
        date,
        revenueHeadId: revenueHead.id,
        description: `Sample ${revenueHead.name}`,
        amount,
        paymentMethod,
        bankAccountId: paymentMethod === 'BANK' ? account.id : null,
        reference: je.voucherNo,
        journalEntryId: je.id,
        createdById: userId
      }
    });

    return je;
  });
}

async function createExpense(userId: string, expenseHead: any, amount: number, paymentMethod: string, account: any, date: Date) {
  return prisma.$transaction(async (tx) => {
    // Create Journal Entry
    const je = await tx.journalEntry.create({
      data: {
        voucherNo: `BP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        postingDate: date,
        subsidiary: 'Global',
        reference: 'Sample Expense',
        description: `Sample ${expenseHead.name}`,
        postedBy: userId,
        status: 'Posted',
        voucherType: 'BP'
      }
    });

    // Debit Expense
    await tx.journalEntryLine.create({
      data: {
        journalEntryId: je.id,
        accountId: expenseHead.accountId || expenseHead.account.id,
        debit: amount,
        credit: 0,
        description: `Debit ${expenseHead.name}`
      }
    });

    // Credit Cash/Bank
    await tx.journalEntryLine.create({
      data: {
        journalEntryId: je.id,
        accountId: account.id,
        debit: 0,
        credit: amount,
        description: 'Credit Cash/Bank'
      }
    });

    // Create Ledger Entries
    await tx.ledgerEntry.create({
      data: {
        accountId: expenseHead.accountId || expenseHead.account.id,
        debit: amount,
        credit: 0,
        reference: je.voucherNo,
        description: `Sample ${expenseHead.name}`,
        postingDate: date
      }
    });

    await tx.ledgerEntry.create({
      data: {
        accountId: account.id,
        debit: 0,
        credit: amount,
        reference: je.voucherNo,
        description: `Sample ${expenseHead.name}`,
        postingDate: date
      }
    });

    // Update account balances
    await tx.account.update({
      where: { id: expenseHead.accountId || expenseHead.account.id },
      data: { currentBalance: { increment: amount } }
    });

    await tx.account.update({
      where: { id: account.id },
      data: { currentBalance: { decrement: amount } }
    });

    // Create Simple Expense
    await tx.simpleExpense.create({
      data: {
        date,
        expenseHeadId: expenseHead.id,
        paidTo: 'Sample Vendor',
        description: `Sample ${expenseHead.name}`,
        amount,
        paymentMethod,
        bankAccountId: paymentMethod === 'BANK' ? account.id : null,
        reference: je.voucherNo,
        journalEntryId: je.id,
        createdById: userId
      }
    });

    return je;
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
