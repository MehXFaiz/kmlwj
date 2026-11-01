import { prisma } from '../api/_prisma.js';

async function run() {
  const accounts = await prisma.account.findMany({
    where: { description: { contains: 'Auto-generated', mode: 'insensitive' }, isDeleted: false },
    include: { journalEntryLines: true, openingBalanceLines: true, expenseHeads: true, revenueHeads: true },
    orderBy: { glCode: 'asc' }
  });
  console.log(`Total auto-generated: ${accounts.length}`);
  for (const a of accounts) {
    console.log(`${a.glCode} | ${a.accountName.padEnd(40)} | JE: ${a.journalEntryLines.length} | OB: ${a.openingBalanceLines.length} | Bal: ${a.currentBalance} | Desc: "${a.description}"`);
  }
  await prisma.$disconnect();
}

run();
