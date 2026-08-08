import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function runAudit() {
  console.log('=== STARTING LIVE-DATA ACCOUNTING CALCULATION AUDIT ===\n');

  // ---------------------------------------------------------
  // 1. DATABASE SCHEMA & RECORD COUNTS
  // ---------------------------------------------------------
  console.log('--- 1. DATABASE RECORD COUNTS ---');
  const userCount = await prisma.user.count();
  const accountCount = await prisma.account.count();
  const accountTypeCount = await prisma.accountType.count();
  const journalEntryCount = await prisma.journalEntry.count();
  const journalLineCount = await prisma.journalEntryLine.count();
  const simpleIncomeCount = await prisma.simpleIncome.count();
  const addIncomeRecordCount = await prisma.addIncomeRecord.count();
  const incomeCategoryCount = await prisma.incomeCategory.count();
  const revenueHeadCount = await prisma.revenueHead.count();
  const simpleExpenseCount = await prisma.simpleExpense.count();
  const expenseHeadCount = await prisma.expenseHead.count();
  const donationCount = await prisma.donation.count();
  const donationReceivedCount = await prisma.donationReceived.count();
  const hallBookingCount = await prisma.hallBooking.count();
  const revenueCollectionCount = await prisma.revenueCollection.count();
  const zakatCardCount = await prisma.zakatCard.count();
  const invoiceCount = await prisma.invoice.count();
  const beneficiaryCount = await prisma.beneficiary.count();
  const memberCount = await prisma.member.count();
  const donorCount = await prisma.donor.count();

  console.log(`User: ${userCount}`);
  console.log(`Account: ${accountCount}`);
  console.log(`AccountType: ${accountTypeCount}`);
  console.log(`JournalEntry: ${journalEntryCount}`);
  console.log(`JournalEntryLine: ${journalLineCount}`);
  console.log(`SimpleIncome: ${simpleIncomeCount}`);
  console.log(`AddIncomeRecord: ${addIncomeRecordCount}`);
  console.log(`IncomeCategory: ${incomeCategoryCount}`);
  console.log(`RevenueHead: ${revenueHeadCount}`);
  console.log(`SimpleExpense: ${simpleExpenseCount}`);
  console.log(`ExpenseHead: ${expenseHeadCount}`);
  console.log(`Donation: ${donationCount}`);
  console.log(`DonationReceived: ${donationReceivedCount}`);
  console.log(`HallBooking: ${hallBookingCount}`);
  console.log(`RevenueCollection: ${revenueCollectionCount}`);
  console.log(`ZakatCard: ${zakatCardCount}`);
  console.log(`Invoice: ${invoiceCount}`);
  console.log(`Beneficiary: ${beneficiaryCount}`);
  console.log(`Member: ${memberCount}`);
  console.log(`Donor: ${donorCount}\n`);

  // Breakdown of JournalEntry by status & isDeleted
  const jeStatus = await prisma.journalEntry.groupBy({
    by: ['status', 'isDeleted'],
    _count: true
  });
  console.log('Journal Entries by Status / isDeleted:', JSON.stringify(jeStatus, null, 2), '\n');

  // Breakdown of JournalEntry by voucherType
  const jeType = await prisma.journalEntry.groupBy({
    by: ['voucherType', 'status', 'isDeleted'],
    _count: true
  });
  console.log('Journal Entries by VoucherType / Status / isDeleted:', JSON.stringify(jeType, null, 2), '\n');

  // ---------------------------------------------------------
  // 2. CHART OF ACCOUNTS & OPENING BALANCES
  // ---------------------------------------------------------
  console.log('--- 2. CHART OF ACCOUNTS & OPENING BALANCES ---');
  const accounts = await prisma.account.findMany({
    where: { isDeleted: false },
    include: { accountType: true, parent: true }
  });

  console.log(`Total non-deleted accounts: ${accounts.length}`);
  let totalOpeningDebit = 0;
  let totalOpeningCredit = 0;

  for (const acc of accounts) {
    const init = Number(acc.initialBalance);
    const typeName = (acc.accountType?.name || '').toUpperCase();
    if (init !== 0) {
      console.log(`GL ${acc.glCode} | ${acc.accountName} | Level: ${acc.accountLevel} | Type: ${typeName} | DetailType: ${acc.detailType} | InitialBal: ${init}`);
      if (['ASSET', 'ASSETS', 'EXPENSE', 'EXPENSES'].includes(typeName)) {
        if (init > 0) totalOpeningDebit += init;
        else totalOpeningCredit += Math.abs(init);
      } else {
        if (init > 0) totalOpeningCredit += init;
        else totalOpeningDebit += Math.abs(init);
      }
    }
  }
  console.log(`Total Opening Debit: ${totalOpeningDebit}, Total Opening Credit: ${totalOpeningCredit}\n`);

  // ---------------------------------------------------------
  // 3. GENERAL LEDGER RECONCILIATION (JOURNAL ENTRIES & LINES)
  // ---------------------------------------------------------
  console.log('--- 3. GENERAL LEDGER RECONCILIATION ---');
  const journalEntries = await prisma.journalEntry.findMany({
    include: {
      lines: {
        include: {
          account: {
            include: { accountType: true }
          }
        }
      }
    }
  });

  let unbalancedJournals: any[] = [];
  let deletedAffectingLinesCount = 0;
  let linesWithDeletedAccount: any[] = [];
  let draftAffectingLinesCount = 0;

  for (const je of journalEntries) {
    let sumDebit = 0;
    let sumCredit = 0;

    for (const line of je.lines) {
      sumDebit += Number(line.debit);
      sumCredit += Number(line.credit);

      if (line.account?.isDeleted) {
        linesWithDeletedAccount.push({ lineId: line.id, jeId: je.id, voucherNo: je.voucherNo, accountId: line.accountId });
      }
    }

    const diff = Math.abs(sumDebit - sumCredit);
    if (diff > 0.001) {
      unbalancedJournals.push({
        id: je.id,
        voucherNo: je.voucherNo,
        status: je.status,
        isDeleted: je.isDeleted,
        postingDate: je.postingDate,
        totalDebit: sumDebit,
        totalCredit: sumCredit,
        difference: diff
      });
    }

    if (je.isDeleted && je.status === 'Posted') {
      deletedAffectingLinesCount += je.lines.length;
    }
    if (je.status !== 'Posted' && !je.isDeleted) {
      draftAffectingLinesCount += je.lines.length;
    }
  }

  console.log(`Unbalanced Journals Count: ${unbalancedJournals.length}`);
  if (unbalancedJournals.length > 0) {
    console.log('Unbalanced Journals:', JSON.stringify(unbalancedJournals, null, 2));
  }
  console.log(`Deleted Posted Journal Lines Count: ${deletedAffectingLinesCount}`);
  console.log(`Draft/Unposted Journal Lines Count: ${draftAffectingLinesCount}`);
  console.log(`Lines with Deleted Account Count: ${linesWithDeletedAccount.length}\n`);

  // ---------------------------------------------------------
  // 4. POSTED LEDGER AGGREGATES BY ACCOUNT TYPE
  // ---------------------------------------------------------
  console.log('--- 4. POSTED LEDGER AGGREGATES BY ACCOUNT TYPE ---');
  const postedLines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: 'Posted',
        isDeleted: false
      }
    },
    include: {
      account: {
        include: { accountType: true }
      },
      journalEntry: true
    }
  });

  console.log(`Total Posted Journal Entry Lines: ${postedLines.length}`);

  let typeAggregates: Record<string, { debit: number; credit: number; lineCount: number }> = {};

  for (const line of postedLines) {
    const typeName = (line.account?.accountType?.name || 'UNKNOWN').toUpperCase();
    if (!typeAggregates[typeName]) {
      typeAggregates[typeName] = { debit: 0, credit: 0, lineCount: 0 };
    }
    typeAggregates[typeName].debit += Number(line.debit);
    typeAggregates[typeName].credit += Number(line.credit);
    typeAggregates[typeName].lineCount += 1;
  }

  console.log('Aggregates by Account Type:', JSON.stringify(typeAggregates, null, 2), '\n');

  // ---------------------------------------------------------
  // 5. ACCOUNT-BY-ACCOUNT BALANCES & RECONCILIATION
  // ---------------------------------------------------------
  console.log('--- 5. ACCOUNT-BY-ACCOUNT BALANCES ---');
  let accountReconciliation: any[] = [];
  let totalAssetBal = 0;
  let totalLiabBal = 0;
  let totalEquityBal = 0;
  let totalRevenueBal = 0;
  let totalExpenseBal = 0;

  let cashInHandCalc = 0;
  let bankBalancesCalc: Record<string, { name: string; glCode: string; init: number; debit: number; credit: number; closing: number }> = {};

  for (const acc of accounts) {
    const typeName = (acc.accountType?.name || '').toUpperCase();
    const isDebitNormal = ['ASSET', 'ASSETS', 'EXPENSE', 'EXPENSES'].includes(typeName);
    const init = Number(acc.initialBalance);

    // Sum posted lines for this account
    const accLines = postedLines.filter(l => l.accountId === acc.id);
    let sumDebit = 0;
    let sumCredit = 0;
    for (const l of accLines) {
      sumDebit += Number(l.debit);
      sumCredit += Number(l.credit);
    }

    let calcBal = 0;
    if (isDebitNormal) {
      calcBal = init + sumDebit - sumCredit;
    } else {
      calcBal = init + sumCredit - sumDebit;
    }

    const storedBal = Number(acc.currentBalance);
    const diff = calcBal - storedBal;

    accountReconciliation.push({
      glCode: acc.glCode,
      name: acc.accountName,
      level: acc.accountLevel,
      type: typeName,
      detailType: acc.detailType,
      initialBalance: init,
      sumDebit,
      sumCredit,
      calcBalance: calcBal,
      storedBalance: storedBal,
      difference: diff
    });

    // Only aggregate leaf accounts to avoid double counting parent headers
    const isLeaf = !accounts.some(c => c.parentId === acc.id);

    if (isLeaf) {
      if (['ASSET', 'ASSETS'].includes(typeName)) {
        totalAssetBal += calcBal;

        // Check if Cash or Bank account
        const nameLower = acc.accountName.toLowerCase();
        const detailLower = (acc.detailType || '').toLowerCase();
        const isCash = detailLower === 'cash' || (nameLower.includes('cash') && !nameLower.includes('bank'));
        const isBank = detailLower === 'bank' || nameLower.includes('bank');

        if (isCash) {
          cashInHandCalc += calcBal;
          console.log(`CASH ACCOUNT: GL ${acc.glCode} | ${acc.accountName} | Init: ${init} | Debit: ${sumDebit} | Credit: ${sumCredit} | Calc: ${calcBal}`);
        }

        if (isBank) {
          bankBalancesCalc[acc.glCode] = {
            name: acc.accountName,
            glCode: acc.glCode,
            init,
            debit: sumDebit,
            credit: sumCredit,
            closing: calcBal
          };
          console.log(`BANK ACCOUNT: GL ${acc.glCode} | ${acc.accountName} | Init: ${init} | Debit: ${sumDebit} | Credit: ${sumCredit} | Calc: ${calcBal}`);
        }
      } else if (['LIABILITY', 'LIABILITIES'].includes(typeName)) {
        totalLiabBal += calcBal;
      } else if (['EQUITY'].includes(typeName)) {
        totalEquityBal += calcBal;
      } else if (['REVENUE', 'INCOME'].includes(typeName)) {
        // P&L revenue is credit - debit
        totalRevenueBal += (sumCredit - sumDebit);
      } else if (['EXPENSE', 'EXPENSES'].includes(typeName)) {
        // P&L expense is debit - credit
        totalExpenseBal += (sumDebit - sumCredit);
      }
    }
  }

  console.log('\nSummary of Leaf Account Balances (from Posted GL Lines + Init):');
  console.log(`Total Assets: ${totalAssetBal}`);
  console.log(`Total Liabilities: ${totalLiabBal}`);
  console.log(`Total Equity (Base): ${totalEquityBal}`);
  console.log(`Total Revenue: ${totalRevenueBal}`);
  console.log(`Total Expenses: ${totalExpenseBal}`);
  const netIncomeCalc = totalRevenueBal - totalExpenseBal;
  console.log(`Net Surplus/Loss (Revenue - Expense): ${netIncomeCalc}`);
  console.log(`Total Equity + Net Income: ${totalEquityBal + netIncomeCalc}`);
  console.log(`Assets = Liabilities + Equity Check: Assets (${totalAssetBal}) vs Liab+Equity (${totalLiabBal + totalEquityBal + netIncomeCalc}) -> Diff: ${totalAssetBal - (totalLiabBal + totalEquityBal + netIncomeCalc)}\n`);

  console.log(`Calculated Cash in Hand: ${cashInHandCalc}`);
  console.log('Bank Account Balances:', JSON.stringify(bankBalancesCalc, null, 2));

  // ---------------------------------------------------------
  // 6. OPERATIONAL TABLES AUDIT (INCOME & EXPENSE SOURCES)
  // ---------------------------------------------------------
  console.log('\n--- 6. OPERATIONAL TABLES AUDIT ---');

  // SimpleIncome
  const simpleIncomes = await prisma.simpleIncome.findMany({
    include: { revenueHead: { include: { account: true } } }
  });
  let simpleIncomeTotal = 0;
  let simpleIncomeByStatus: Record<string, number> = {};
  for (const si of simpleIncomes) {
    const amt = Number(si.amount);
    const key = si.isDeleted ? 'DELETED' : 'ACTIVE';
    simpleIncomeByStatus[key] = (simpleIncomeByStatus[key] || 0) + amt;
    if (!si.isDeleted) simpleIncomeTotal += amt;
  }
  console.log(`SimpleIncome Total (Active): ${simpleIncomeTotal}`, simpleIncomeByStatus);

  // AddIncomeRecord
  const addIncomes = await prisma.addIncomeRecord.findMany({
    include: { category: true }
  });
  let addIncomeTotals: Record<string, number> = {};
  for (const ai of addIncomes) {
    const amt = Number(ai.amount);
    const key = ai.isDeleted ? 'DELETED' : ai.status;
    addIncomeTotals[key] = (addIncomeTotals[key] || 0) + amt;
  }
  console.log('AddIncomeRecord Totals by Status:', addIncomeTotals);

  // DonationReceived
  const donationsReceived = await prisma.donationReceived.findMany();
  let donationRecTotals: Record<string, number> = {};
  for (const dr of donationsReceived) {
    const amt = Number(dr.amount);
    const key = dr.isDeleted ? 'DELETED' : dr.status;
    donationRecTotals[key] = (donationRecTotals[key] || 0) + amt;
  }
  console.log('DonationReceived Totals by Status:', donationRecTotals);

  // HallBooking
  const hallBookings = await prisma.hallBooking.findMany();
  let hallBookingTotals: Record<string, number> = {};
  for (const hb of hallBookings) {
    const amt = Number(hb.netAmount || hb.hallCharges || 0);
    const key = hb.isDeleted ? 'DELETED' : hb.status;
    hallBookingTotals[key] = (hallBookingTotals[key] || 0) + amt;
  }
  console.log('HallBooking Totals by Status:', hallBookingTotals);

  // RevenueCollection
  const revenueCollections = await prisma.revenueCollection.findMany();
  let revCollTotals: Record<string, number> = {};
  for (const rc of revenueCollections) {
    const amt = Number(rc.amount);
    const key = rc.isDeleted ? 'DELETED' : rc.status;
    revCollTotals[key] = (revCollTotals[key] || 0) + amt;
  }
  console.log('RevenueCollection Totals by Status:', revCollTotals);

  // SimpleExpense
  const simpleExpenses = await prisma.simpleExpense.findMany({
    include: { expenseHead: { include: { account: true } } }
  });
  let simpleExpenseTotals: Record<string, number> = {};
  for (const se of simpleExpenses) {
    const amt = Number(se.amount);
    const key = se.isDeleted ? 'DELETED' : se.status;
    simpleExpenseTotals[key] = (simpleExpenseTotals[key] || 0) + amt;
  }
  console.log('SimpleExpense Totals by Status:', simpleExpenseTotals);

  // ZakatCard
  const zakatCards = await prisma.zakatCard.findMany();
  let zakatCardTotal = 0;
  for (const zc of zakatCards) {
    if (!zc.isDeleted) zakatCardTotal += Number(zc.zakatAmount);
  }
  console.log(`ZakatCard Total (Active): ${zakatCardTotal}`);

  // ---------------------------------------------------------
  // 7. DETAILED GL BREAKDOWN FOR REVENUE AND EXPENSES
  // ---------------------------------------------------------
  console.log('\n--- 7. GL REVENUE ACCOUNTS BREAKDOWN ---');
  for (const acc of accounts) {
    const typeName = (acc.accountType?.name || '').toUpperCase();
    if (['REVENUE', 'INCOME'].includes(typeName)) {
      const accLines = postedLines.filter(l => l.accountId === acc.id);
      let dr = 0, cr = 0;
      for (const l of accLines) { dr += Number(l.debit); cr += Number(l.credit); }
      const net = cr - dr;
      console.log(`GL ${acc.glCode} | ${acc.accountName} | Init: ${acc.initialBalance} | Debit: ${dr} | Credit: ${cr} | Net Income: ${net}`);
    }
  }

  console.log('\n--- GL EXPENSE ACCOUNTS BREAKDOWN ---');
  for (const acc of accounts) {
    const typeName = (acc.accountType?.name || '').toUpperCase();
    if (['EXPENSE', 'EXPENSES'].includes(typeName)) {
      const accLines = postedLines.filter(l => l.accountId === acc.id);
      let dr = 0, cr = 0;
      for (const l of accLines) { dr += Number(l.debit); cr += Number(l.credit); }
      const net = dr - cr;
      console.log(`GL ${acc.glCode} | ${acc.accountName} | Init: ${acc.initialBalance} | Debit: ${dr} | Credit: ${cr} | Net Expense: ${net}`);
    }
  }

  console.log('\n--- GL ASSET ACCOUNTS BREAKDOWN ---');
  for (const acc of accounts) {
    const typeName = (acc.accountType?.name || '').toUpperCase();
    if (['ASSET', 'ASSETS'].includes(typeName)) {
      const accLines = postedLines.filter(l => l.accountId === acc.id);
      let dr = 0, cr = 0;
      for (const l of accLines) { dr += Number(l.debit); cr += Number(l.credit); }
      const init = Number(acc.initialBalance);
      const net = init + dr - cr;
      console.log(`GL ${acc.glCode} | ${acc.accountName} | Level: ${acc.accountLevel} | DetailType: ${acc.detailType} | Init: ${init} | Debit: ${dr} | Credit: ${cr} | Net Asset: ${net}`);
    }
  }

  // ---------------------------------------------------------
  // 8. TRIAL BALANCE TOTALS
  // ---------------------------------------------------------
  console.log('\n--- 8. TRIAL BALANCE VERIFICATION ---');
  let tbTotalDebit = 0;
  let tbTotalCredit = 0;

  for (const acc of accounts) {
    if (acc.accountLevel !== 'GL') continue; // leaf GL accounts only
    const typeName = (acc.accountType?.name || '').toUpperCase();
    const isDebitNormal = ['ASSET', 'ASSETS', 'EXPENSE', 'EXPENSES'].includes(typeName);
    const init = Number(acc.initialBalance);

    const accLines = postedLines.filter(l => l.accountId === acc.id);
    let sumDebit = 0;
    let sumCredit = 0;
    for (const l of accLines) {
      sumDebit += Number(l.debit);
      sumCredit += Number(l.credit);
    }

    let balance = isDebitNormal ? (init + sumDebit - sumCredit) : (init + sumCredit - sumDebit);

    if (isDebitNormal) {
      if (balance > 0) tbTotalDebit += balance;
      else tbTotalCredit += Math.abs(balance);
    } else {
      if (balance > 0) tbTotalCredit += balance;
      else tbTotalDebit += Math.abs(balance);
    }
  }

  console.log(`Trial Balance Total Debit: ${tbTotalDebit}`);
  console.log(`Trial Balance Total Credit: ${tbTotalCredit}`);
  console.log(`Trial Balance Difference: ${Math.abs(tbTotalDebit - tbTotalCredit)}`);

  console.log('\n=== AUDIT SCRIPT COMPLETE ===');
}

runAudit()
  .catch(e => {
    console.error('Audit Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
