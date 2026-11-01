import { prisma } from '../api/_prisma.js';

async function auditGlobal() {
  console.log('=== GLOBAL ACCOUNT DUPLICATION & RELATIONSHIP AUDIT ===');

  const allAccounts = await prisma.account.findMany({
    where: { isDeleted: false },
    include: {
      parent: true,
      children: true,
      accountType: true,
      journalEntryLines: true,
      openingBalanceLines: true,
      revenueHeads: true,
      expenseHeads: true,
      donations: true,
      invoices: true,
      hallBookings: true,
      hallBookingBanks: true,
      revenueCollections: true,
      donationsReceivedCash: true,
      donationsReceivedBank: true,
      incomeCategoryAccounts: true,
      addIncomeBanks: true,
      pettyCashConfigs: true,
      pettyCashAccounts: true,
      pettyCashSourceAccounts: true,
      pettyCashExpenseAccounts: true,
    },
    orderBy: { glCode: 'asc' }
  });

  console.log(`Total active accounts: ${allAccounts.length}`);

  // Group by exact lowercase accountName
  const byName = new Map<string, typeof allAccounts>();
  for (const a of allAccounts) {
    const key = a.accountName.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(a);
  }

  const multiByName = Array.from(byName.entries()).filter(([_, l]) => l.length > 1);
  console.log(`\nAccount names shared by multiple records: ${multiByName.length}`);

  for (const [name, list] of multiByName) {
    console.log(`\n----------------------------------------------------`);
    console.log(`"${name.toUpperCase()}" (${list.length} accounts):`);
    for (const a of list) {
      const activeRelations: string[] = [];
      if (a.journalEntryLines.length > 0) activeRelations.push(`JE Lines: ${a.journalEntryLines.length}`);
      if (a.openingBalanceLines.length > 0) activeRelations.push(`OB Lines: ${a.openingBalanceLines.length}`);
      if (a.expenseHeads.length > 0) activeRelations.push(`ExpenseHeads: ${a.expenseHeads.length}`);
      if (a.revenueHeads.length > 0) activeRelations.push(`RevenueHeads: ${a.revenueHeads.length}`);
      if (a.incomeCategoryAccounts.length > 0) activeRelations.push(`IncomeCategories: ${a.incomeCategoryAccounts.length}`);
      if (a.donations.length > 0) activeRelations.push(`Donations: ${a.donations.length}`);
      if (a.invoices.length > 0) activeRelations.push(`Invoices: ${a.invoices.length}`);
      if (a.hallBookings.length > 0) activeRelations.push(`HallBookings: ${a.hallBookings.length}`);
      if (a.hallBookingBanks.length > 0) activeRelations.push(`HallBookingBanks: ${a.hallBookingBanks.length}`);
      if (a.revenueCollections.length > 0) activeRelations.push(`RevenueCollections: ${a.revenueCollections.length}`);
      if (a.donationsReceivedCash.length > 0) activeRelations.push(`DonationsRecCash: ${a.donationsReceivedCash.length}`);
      if (a.donationsReceivedBank.length > 0) activeRelations.push(`DonationsRecBank: ${a.donationsReceivedBank.length}`);
      if (a.addIncomeBanks.length > 0) activeRelations.push(`AddIncomeBanks: ${a.addIncomeBanks.length}`);
      if (a.pettyCashAccounts.length > 0) activeRelations.push(`PettyCashAcc: ${a.pettyCashAccounts.length}`);
      if (a.children.length > 0) activeRelations.push(`Children: ${a.children.length}`);

      console.log(`  GL: ${a.glCode} | ID: ${a.id}`);
      console.log(`    Level: ${a.accountLevel} | Type: ${a.accountType?.name} | Detail: ${a.detailType}`);
      console.log(`    Parent: ${a.parent ? `${a.parent.glCode} (${a.parent.accountName})` : 'None'}`);
      console.log(`    Desc: "${a.description}"`);
      console.log(`    Bal: ${a.currentBalance} (Initial: ${a.initialBalance})`);
      console.log(`    Active Relations: ${activeRelations.length > 0 ? activeRelations.join(', ') : 'NONE (Orphan/Unused)'}`);
    }
  }

  await prisma.$disconnect();
}

auditGlobal();
