
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
  console.log('=== TESTING INCOME STATEMENT ===');
  const pnlAccounts = await prisma.account.findMany({
    where: { accountType: { name: { in: ['REVENUE', 'EXPENSE'] } } },
    include: { accountType: true }
  });
  let revenues = [];
  let expenses = [];
  let totalRevenue = 0;
  let totalExpense = 0;
  for (const acc of pnlAccounts) {
    const agg = await prisma.journalEntryLine.aggregate({
      where: { accountId: acc.id, journalEntry: { status: 'Posted' } },
      _sum: { debit: true, credit: true }
    });
    const d = Number(agg._sum.debit) || 0;
    const c = Number(agg._sum.credit) || 0;
    let balance;
    if (acc.accountType?.name === 'REVENUE') balance = c - d;
    else if (acc.accountType?.name === 'EXPENSE') balance = d - c;
    else continue;
    if (balance === 0) continue;
    const item = { glCode: acc.glCode, name: acc.accountName, balance };
    if (acc.accountType?.name === 'REVENUE') {
      revenues.push(item);
      totalRevenue += balance;
    } else {
      expenses.push(item);
      totalExpense += balance;
    }
  }
  console.log('Revenues:', revenues);
  console.log('Expenses:', expenses);
  console.log('Total Revenue:', totalRevenue);
  console.log('Total Expense:', totalExpense);
  console.log('Net Income:', totalRevenue - totalExpense);

  console.log('\n=== TESTING BALANCE SHEET ===');
  const allAccounts = await prisma.account.findMany({
    include: { accountType: true }
  });
  let assets = [];
  let liabilities = [];
  let equity = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const acc of allAccounts) {
    const type = acc.accountType?.name;
    const agg = await prisma.journalEntryLine.aggregate({
      where: { accountId: acc.id, journalEntry: { status: 'Posted' } },
      _sum: { debit: true, credit: true }
    });
    const d = Number(agg._sum.debit) || 0;
    const c = Number(agg._sum.credit) || 0;
    const initial = Number(acc.initialBalance) || 0;
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes((type || '').toUpperCase());
    let balance = isDebitNormal ? initial + d - c : initial + c - d;
    if (balance === 0) continue;

    const item = { glCode: acc.glCode, name: acc.accountName, balance };

    if (type === 'ASSET') {
      assets.push(item);
      totalAssets += balance;
    } else if (type === 'LIABILITY') {
      liabilities.push(item);
      totalLiabilities += balance;
    } else if (type === 'EQUITY') {
      equity.push(item);
      totalEquity += balance;
    }
  }

  totalEquity += (totalRevenue - totalExpense);
  console.log('Assets:', assets);
  console.log('Liabilities:', liabilities);
  console.log('Equity:', equity);
  console.log('Total Assets:', totalAssets);
  console.log('Total Liabilities + Equity:', totalLiabilities + totalEquity);
  console.log('Balanced:', Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01);

  console.log('\n=== TESTING DASHBOARD STATS ===');
  let cashBalance = 0;
  let bankBalance = 0;

  for (const acc of allAccounts) {
    const type = acc.accountType?.name;
    const name = acc.accountName.toLowerCase();
    if (type === 'ASSET') {
      const agg = await prisma.journalEntryLine.aggregate({
        where: { accountId: acc.id, journalEntry: { status: 'Posted' } },
        _sum: { debit: true, credit: true }
      });
      const d = Number(agg._sum.debit) || 0;
      const c = Number(agg._sum.credit) || 0;
      let balance = Number(acc.initialBalance) || 0 + d - c;
      if (name.includes('cash')) cashBalance += balance;
      if (name.includes('bank')) bankBalance += balance;
    }
  }

  console.log('Total Revenue (dashboard):', totalRevenue);
  console.log('Total Expense (dashboard):', totalExpense);
  console.log('Cash Balance:', cashBalance);
  console.log('Bank Balance:', bankBalance);
  console.log('Net Income:', totalRevenue - totalExpense);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
