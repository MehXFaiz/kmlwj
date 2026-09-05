import { prisma } from '../api/_prisma.js';

async function checkOpeningBalances() {
  const accounts = await prisma.account.findMany({
    include: { accountType: true },
    orderBy: { glCode: 'asc' }
  });
  console.log(`Total Accounts: ${accounts.length}`);
  for (const a of accounts) {
    console.log(`[${a.glCode}] ${a.accountName} | Type: ${a.accountType?.name} | Level: ${a.accountLevel} | Detail: ${a.detailType} | Init: ${a.initialBalance} | Curr: ${a.currentBalance}`);
  }

  const [hbCount, donRecCount, donCount, revColCount, addIncCount, expCount, pcCount] = await Promise.all([
    prisma.hallBooking.count({ where: { isDeleted: false } }),
    prisma.donationReceived.count({ where: { isDeleted: false } }),
    prisma.donation.count({ where: { isDeleted: false } }),
    prisma.revenueCollection.count({ where: { isDeleted: false } }),
    prisma.addIncomeRecord.count({ where: { isDeleted: false } }),
    prisma.simpleExpense.count({ where: { isDeleted: false } }),
    prisma.pettyCashTransaction.count({ where: { isDeleted: false } })
  ]);
  console.log('\n--- Module Counts ---');
  console.log(`Hall Bookings: ${hbCount}`);
  console.log(`Donations Received: ${donRecCount}`);
  console.log(`Donations Disbursed: ${donCount}`);
  console.log(`Revenue Collections: ${revColCount}`);
  console.log(`Add Income Records: ${addIncCount}`);
  console.log(`Simple Expenses: ${expCount}`);
  console.log(`Petty Cash Transactions: ${pcCount}`);
}

checkOpeningBalances().catch(console.error).finally(() => prisma.$disconnect());

