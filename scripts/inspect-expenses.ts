import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Fetch all accounts of type EXPENSE
  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { accountType: { name: { equals: 'EXPENSE', mode: 'insensitive' } } },
        { glCode: { startsWith: '4' } }
      ]
    },
    include: { accountType: true }
  });

  console.log('--- EXPENSE ACCOUNTS ---');
  let sumOfAllAccounts = 0;
  let sumOfLeafAccounts = 0;
  
  for (const acc of accounts) {
    const hasChildren = accounts.some(a => a.parentId === acc.id);
    const isLeaf = !hasChildren;
    
    console.log(`GL: ${acc.glCode} | Name: ${acc.accountName} | Level: ${acc.accountLevel} | Bal: ${acc.currentBalance} | isLeaf: ${isLeaf}`);
    
    sumOfAllAccounts += acc.currentBalance;
    if (isLeaf) {
      sumOfLeafAccounts += acc.currentBalance;
    }
  }
  
  console.log(`\nSum of all Expense accounts: ${sumOfAllAccounts}`);
  console.log(`Sum of leaf Expense accounts: ${sumOfLeafAccounts}`);

  // 2. Fetch all posted journal entry lines for Expense accounts
  const jLines = await prisma.journalEntryLine.findMany({
    where: {
      account: {
        OR: [
          { accountType: { name: { equals: 'EXPENSE', mode: 'insensitive' } } },
          { glCode: { startsWith: '4' } }
        ]
      },
      journalEntry: {
        status: 'Posted'
      }
    },
    include: { account: true }
  });

  console.log('\n--- POSTED JOURNAL ENTRY LINES FOR EXPENSE ACCOUNTS ---');
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of jLines) {
    console.log(`Voucher: ${line.journalEntryId} | Acc: ${line.account.glCode} (${line.account.accountName}) | Debit: ${line.debit} | Credit: ${line.credit}`);
    totalDebit += line.debit;
    totalCredit += line.credit;
  }
  console.log(`Total Debits: ${totalDebit} | Total Credits: ${totalCredit} | Net (Debit - Credit): ${totalDebit - totalCredit}`);

  // 3. Fetch Simple Expenses
  const simpleExpenses = await prisma.simpleExpense.findMany({
    include: { expenseHead: { include: { account: true } } }
  });
  console.log('\n--- SIMPLE EXPENSES ---');
  let totalSimpleExpense = 0;
  for (const se of simpleExpenses) {
    console.log(`Date: ${se.date.toISOString()} | Amount: ${se.amount} | Head: ${se.expenseHead.name} | Acc: ${se.expenseHead.account?.glCode || se.expenseHead.accountId}`);
    totalSimpleExpense += se.amount;
  }
  console.log(`Total Simple Expenses: ${totalSimpleExpense}`);

  // 4. Fetch Donations
  const donations = await prisma.donation.findMany();
  console.log('\n--- DONATIONS ---');
  let totalApprovedDonations = 0;
  for (const d of donations) {
    console.log(`Type: ${d.donationType} | Status: ${d.status} | Amount: ${d.amount}`);
    if (d.status === 'APPROVED') {
      totalApprovedDonations += d.amount;
    }
  }
  console.log(`Total Approved Donations: ${totalApprovedDonations}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
