import { PrismaClient } from '@prisma/client';
import { prisma } from '../api/_prisma.js';

async function audit() {
  console.log('=== DATABASE FINANCIAL AUDIT ===\n');

  // 1. Financial Years
  const fyList = await prisma.financialYear.findMany();
  console.log('--- Financial Years ---');
  console.log(JSON.stringify(fyList, null, 2));

  // 2. Hall Bookings
  const hallBookings = await prisma.hallBooking.findMany({
    where: { isDeleted: false },
    include: { journalEntry: { include: { lines: true } }, hallAccount: true }
  });
  console.log(`\n--- Hall Bookings (Total count: ${hallBookings.length}) ---`);
  let hbGross = 0;
  let hbNet = 0;
  let hbReceived = 0;
  let hbRemaining = 0;
  let hbPostedGLCount = 0;
  let hbPostedGLSum = 0;

  for (const hb of hallBookings) {
    hbGross += Number(hb.hallCharges || 0);
    hbNet += Number(hb.netAmount || 0);
    hbReceived += Number(hb.receivedAmount || 0);
    hbRemaining += Number(hb.remainingAmount || 0);
    if (hb.journalEntryId && hb.status === 'POSTED') {
      hbPostedGLCount++;
      hbPostedGLSum += Number(hb.netAmount || 0);
    }
  }
  console.log(`Gross Charges: ${hbGross}`);
  console.log(`Net Amount (Total Hall Income on page): ${hbNet}`);
  console.log(`Received Amount: ${hbReceived}`);
  console.log(`Remaining Amount: ${hbRemaining}`);
  console.log(`Posted to GL count: ${hbPostedGLCount} / ${hallBookings.length}, Posted Sum: ${hbPostedGLSum}`);
  console.log('Hall booking statuses:', hallBookings.map(h => ({ id: h.id, receiptNo: h.receiptNo, status: h.status, netAmount: h.netAmount, journalEntryId: h.journalEntryId, date: h.programDate })));

  // 3. Revenue Collections
  const revCols = await prisma.revenueCollection.findMany({
    where: { isDeleted: false },
    include: { journalEntry: true }
  });
  console.log(`\n--- Revenue Collections (Count: ${revCols.length}) ---`);
  const revColByCategory: Record<string, number> = {};
  for (const rc of revCols) {
    revColByCategory[rc.category] = (revColByCategory[rc.category] || 0) + Number(rc.amount || 0);
  }
  console.log('Categories sum:', revColByCategory);
  console.log('Revenue collection statuses:', revCols.map(r => ({ id: r.id, category: r.category, status: r.status, amount: r.amount, journalEntryId: r.journalEntryId })));

  // 4. Donations Received
  const donRec = await prisma.donationReceived.findMany({
    where: { isDeleted: false },
    include: { journalEntry: true }
  });
  console.log(`\n--- Donations Received (Count: ${donRec.length}) ---`);
  let donRecSum = 0;
  const donRecByType: Record<string, number> = {};
  for (const d of donRec) {
    donRecSum += Number(d.amount || 0);
    donRecByType[d.donationType] = (donRecByType[d.donationType] || 0) + Number(d.amount || 0);
  }
  console.log(`Total Donations Received: ${donRecSum}`);
  console.log('By Type:', donRecByType);
  console.log('Donations Received statuses:', donRec.map(d => ({ id: d.id, receiptNo: d.receiptNo, type: d.donationType, status: d.status, amount: d.amount, journalEntryId: d.journalEntryId })));

  // 5. Donations Disbursed (Donation model)
  const donDisb = await prisma.donation.findMany({
    where: { isDeleted: false }
  });
  console.log(`\n--- Donations Disbursed (Count: ${donDisb.length}) ---`);
  let donDisbSum = 0;
  for (const d of donDisb) {
    donDisbSum += Number(d.amount || 0);
  }
  console.log(`Total Donations Disbursed: ${donDisbSum}`);
  console.log('Donations Disbursed statuses:', donDisb.map(d => ({ id: d.id, status: d.status, amount: d.amount, journalEntryId: d.journalEntryId })));

  // 6. AddIncomeRecords & SimpleIncome
  const addIncomes = await prisma.addIncomeRecord.findMany({ where: { isDeleted: false } });
  const simpleIncomes = await prisma.simpleIncome.findMany({ where: { isDeleted: false } });
  console.log(`\n--- Other Income ---`);
  console.log(`AddIncomeRecords count: ${addIncomes.length}, sum: ${addIncomes.reduce((s, a) => s + a.amount, 0)}`);
  console.log(`SimpleIncome count: ${simpleIncomes.length}, sum: ${simpleIncomes.reduce((s, a) => s + a.amount, 0)}`);

  // 7. SimpleExpense & PettyCash
  const simpleExpenses = await prisma.simpleExpense.findMany({ where: { isDeleted: false } });
  const pettyCashTx = await prisma.pettyCashTransaction.findMany({ where: { isDeleted: false } });
  console.log(`\n--- Expenses ---`);
  console.log(`SimpleExpenses count: ${simpleExpenses.length}, sum: ${simpleExpenses.reduce((s, e) => s + e.amount, 0)}`);
  console.log(`PettyCashTx count: ${pettyCashTx.length}, sum: ${pettyCashTx.reduce((s, p) => s + p.amount, 0)}`);

  // 8. Accounts & Cash/Bank Accounts
  const accounts = await prisma.account.findMany({
    where: { isDeleted: false },
    include: { accountType: true }
  });
  console.log(`\n--- Accounts (Total: ${accounts.length}) ---`);
  for (const acc of accounts) {
    if (acc.accountType?.name?.toUpperCase() === 'ASSET' || acc.detailType === 'Cash' || acc.detailType === 'Bank' || acc.accountName.toLowerCase().includes('cash') || acc.accountName.toLowerCase().includes('bank')) {
      console.log(`[${acc.glCode}] ${acc.accountName} (${acc.accountType?.name}) - Detail: ${acc.detailType}, InitBal: ${acc.initialBalance}, CurrBal: ${acc.currentBalance}`);
    }
  }

  // 9. All Journal Entries
  const jes = await prisma.journalEntry.findMany({
    where: { isDeleted: false },
    include: { lines: { include: { account: { include: { accountType: true } } } } }
  });
  console.log(`\n--- Journal Entries (Total: ${jes.length}) ---`);
  for (const je of jes) {
    const dSum = je.lines.reduce((s, l) => s + l.debit, 0);
    const cSum = je.lines.reduce((s, l) => s + l.credit, 0);
    console.log(`Voucher ${je.voucherNo} (${je.voucherType}) [${je.status}] Date: ${je.postingDate.toISOString().slice(0, 10)} - Module: ${je.lines[0]?.description?.slice(0, 30)} - Debit: ${dSum}, Credit: ${cSum}`);
  }
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
