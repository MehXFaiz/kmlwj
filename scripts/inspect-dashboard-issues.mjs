#!/usr/bin/env node
import { prisma } from '../api/_prisma.js';
import { Prisma } from '@prisma/client';

async function main() {
  console.log('Inspecting dashboard contributors: Cash/Bank and Expense accounts');

  const cashBankAccounts = await prisma.account.findMany({
    where: {
      isDeleted: false,
      accountType: { name: { in: ['Asset', 'ASSET'], mode: 'insensitive' } },
      children: { none: {} },
    },
    include: { accountType: true }
  });

  const cashAccounts = cashBankAccounts.filter(a => /cash/i.test(a.accountName) || (a.detailType || '').toLowerCase() === 'cash');
  const bankAccounts = cashBankAccounts.filter(a => /bank/i.test(a.accountName) || (a.detailType || '').toLowerCase() === 'bank');

  const pnlAccounts = await prisma.account.findMany({
    where: {
      isDeleted: false,
      accountType: { name: { in: ['Expense', 'EXPENSE', 'Expenses', 'EXPENSES'] } }
    },
    include: { accountType: true }
  });

  const printAggregates = async (accounts, label) => {
    console.log('\n== ' + label + ' Accounts ==');
    for (const acc of accounts) {
      const agg = await prisma.journalEntryLine.aggregate({
        _sum: { debit: true, credit: true },
        where: {
          accountId: acc.id,
          journalEntry: { status: 'Posted', isDeleted: false }
        }
      });
      const debit = new Prisma.Decimal(agg._sum.debit ?? 0);
      const credit = new Prisma.Decimal(agg._sum.credit ?? 0);
      const init = new Prisma.Decimal(acc.initialBalance ?? 0);
      const typeName = (acc.accountType?.name || 'ASSET').toUpperCase();
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);
      const current = isDebitNormal ? init.plus(debit).minus(credit) : init.plus(credit).minus(debit);

      console.log(`${acc.glCode} - ${acc.accountName}`);
      console.log(`  initialBalance: ${init.toFixed(2)}  debit: ${debit.toFixed(2)}  credit: ${credit.toFixed(2)}  computed: ${current.toFixed(2)}`);

      // List recent posted journal entries touching this account
      const jlines = await prisma.journalEntryLine.findMany({
        where: { accountId: acc.id, journalEntry: { status: 'Posted', isDeleted: false } },
        include: { journalEntry: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      if (jlines.length > 0) {
        console.log('  Recent posted lines:');
        for (const l of jlines) {
          console.log(`    JE ${l.journalEntry.voucherNo || l.journalEntry.id}  date:${l.journalEntry.postingDate?.toISOString().split('T')[0]}  dr:${l.debit} cr:${l.credit}`);
        }
      }
    }
  };

  await printAggregates(cashAccounts, 'Cash');
  await printAggregates(bankAccounts, 'Bank');
  await printAggregates(pnlAccounts, 'Expense (P&L)');

  console.log('\nInspection complete.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error running inspection:', err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
