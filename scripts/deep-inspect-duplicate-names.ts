import { prisma } from '../api/_prisma.js';

async function inspect() {
  console.log('=== DEEP INSPECTION OF REPEATED ACCOUNT NAMES ===');

  const targetNames = [
    'Staff Salaries',
    'Bus Expense',
    'Bus Expenses',
    'Hall Expense',
    'Generator Expense',
    'Other Expenses',
    'Entertainment',
    'Monthly Donation'
  ];

  for (const name of targetNames) {
    const accounts = await prisma.account.findMany({
      where: {
        accountName: { contains: name, mode: 'insensitive' },
        isDeleted: false
      },
      include: {
        parent: true,
        accountType: true,
        journalEntryLines: {
          include: {
            journalEntry: true
          }
        },
        openingBalanceLines: true,
        expenseHeads: true,
        revenueHeads: true,
        pettyCashAccounts: true
      },
      orderBy: { glCode: 'asc' }
    });

    console.log(`\n======================================================`);
    console.log(`ACCOUNTS MATCHING "${name}" (${accounts.length} found):`);
    console.log(`======================================================`);

    for (const a of accounts) {
      console.log(`GL: ${a.glCode} | ID: ${a.id}`);
      console.log(`  Name: "${a.accountName}"`);
      console.log(`  Level: ${a.accountLevel} | Type: ${a.accountType?.name} | Detail: ${a.detailType}`);
      console.log(`  Parent: ${a.parent ? `${a.parent.glCode} (${a.parent.accountName})` : 'None'}`);
      console.log(`  Description: "${a.description}"`);
      console.log(`  InitialBal: ${a.initialBalance} | CurrentBal: ${a.currentBalance}`);
      console.log(`  Linked JE Lines: ${a.journalEntryLines.length}`);
      if (a.journalEntryLines.length > 0) {
        for (const jl of a.journalEntryLines) {
          console.log(`    - JE Line: voucher=${jl.journalEntry?.voucherNo}, debit=${jl.debit}, credit=${jl.credit}, desc="${jl.description}"`);
        }
      }
      console.log(`  Linked OB Lines: ${a.openingBalanceLines.length}`);
      if (a.openingBalanceLines.length > 0) {
        for (const ol of a.openingBalanceLines) {
          console.log(`    - OB Line: batchId=${ol.batchId}, amount=${ol.amount}, dc=${ol.debitCredit}`);
        }
      }
      console.log(`  Linked ExpenseHeads: ${a.expenseHeads.length}`);
      console.log(`  Linked RevenueHeads: ${a.revenueHeads.length}`);
    }
  }

  await prisma.$disconnect();
}

inspect();
