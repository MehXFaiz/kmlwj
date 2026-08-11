import { prisma } from '../api/_prisma.js';
import { AccountingService } from '../api/_services/accounting.service.js';

async function main() {
  console.log('=== 1. DASHBOARD SUMMARY STATS ===');
  const dashSummary = await AccountingService.getFinancialSummary('2026-01-01', '2026-12-31');
  console.log('Dashboard Total Revenue (2026):', dashSummary.totalRevenue);
  console.log('Dashboard Total Expense (2026):', dashSummary.totalExpense);

  const dashAllTime = await AccountingService.getFinancialSummary();
  console.log('Dashboard Total Revenue (All Time):', dashAllTime.totalRevenue);
  console.log('Dashboard Total Expense (All Time):', dashAllTime.totalExpense);

  console.log('\n=== 2. TRIAL BALANCE REPORT ===');
  const tb2026 = await AccountingService.getTrialBalance('2026-01-01', '2026-12-31');
  const tbRev2026 = tb2026.accounts
    .filter((e: any) => ['REVENUE', 'INCOME'].includes((e.accountType || '').toUpperCase()))
    .reduce((sum: number, e: any) => sum + (Number(e.credit || 0) - Number(e.debit || 0)), 0);
  const tbExp2026 = tb2026.accounts
    .filter((e: any) => ['EXPENSE', 'EXPENSES'].includes((e.accountType || '').toUpperCase()))
    .reduce((sum: number, e: any) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
  console.log('Trial Balance Revenue (2026):', tbRev2026);
  console.log('Trial Balance Expense (2026):', tbExp2026);

  const tbAllTime = await AccountingService.getTrialBalance();
  const tbRevAllTime = tbAllTime.accounts
    .filter((e: any) => ['REVENUE', 'INCOME'].includes((e.accountType || '').toUpperCase()))
    .reduce((sum: number, e: any) => sum + (Number(e.credit || 0) - Number(e.debit || 0)), 0);
  const tbExpAllTime = tbAllTime.accounts
    .filter((e: any) => ['EXPENSE', 'EXPENSES'].includes((e.accountType || '').toUpperCase()))
    .reduce((sum: number, e: any) => sum + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
  console.log('Trial Balance Revenue (All Time):', tbRevAllTime);
  console.log('Trial Balance Expense (All Time):', tbExpAllTime);

  console.log('\n=== 3. REVENUE & EXPENSE ACCOUNT BY ACCOUNT COMPARISON (2026) ===');
  const tbAccountsMap = new Map(tb2026.accounts.map((a: any) => [a.id, a]));

  const allAccounts = await prisma.account.findMany({
    where: { isDeleted: false },
    include: { accountType: true }
  });

  const periodAggregates = await AccountingService.getPostedAggregates({
    from: new Date('2026-01-01'),
    to: AccountingService['endOfDay']('2026-12-31')
  });

  console.log('--- REVENUE ACCOUNTS ---');
  for (const acc of allAccounts) {
    const typeName = (acc.accountType?.name || '').toUpperCase();
    if (typeName === 'REVENUE' || typeName === 'INCOME') {
      const agg = periodAggregates.get(acc.id);
      const aggDebit = Number(agg?.debit || 0);
      const aggCredit = Number(agg?.credit || 0);
      const netAgg = aggCredit - aggDebit;

      const tbAcc = tbAccountsMap.get(acc.id);
      const tbNet = tbAcc ? (Number(tbAcc.credit || 0) - Number(tbAcc.debit || 0)) : 0;
      console.log(`Acc: ${acc.glCode} - ${acc.accountName} | Level: ${acc.accountLevel} | aggNet: ${netAgg} | tbNet: ${tbNet} | diff: ${netAgg - tbNet}`);
    }
  }

  console.log('--- EXPENSE ACCOUNTS ---');
  for (const acc of allAccounts) {
    const typeName = (acc.accountType?.name || '').toUpperCase();
    if (typeName === 'EXPENSE' || typeName === 'EXPENSES') {
      const agg = periodAggregates.get(acc.id);
      const aggDebit = Number(agg?.debit || 0);
      const aggCredit = Number(agg?.credit || 0);
      const netAgg = aggDebit - aggCredit;

      const tbAcc = tbAccountsMap.get(acc.id);
      const tbNet = tbAcc ? (Number(tbAcc.debit || 0) - Number(tbAcc.credit || 0)) : 0;
      console.log(`Acc: ${acc.glCode} - ${acc.accountName} | Level: ${acc.accountLevel} | aggNet: ${netAgg} | tbNet: ${tbNet} | diff: ${netAgg - tbNet}`);
    }
  }

  console.log('\n=== 4. HALL BOOKINGS IN DATABASE ===');
  const hallBookings = await prisma.hallBooking.findMany({
    where: { isDeleted: false },
    include: {
      hallAccount: true,
      bankAccount: true,
    }
  });
  console.log(`Found ${hallBookings.length} Hall Bookings:`);
  for (const hb of hallBookings) {
    console.log(`- Booking ID: ${hb.id} | Booking #: ${hb.bookingNo} | Customer: ${hb.customerName}`);
    console.log(`  Date: ${hb.bookingDate} | Status: ${hb.status} | Total (Gross): ${hb.totalAmount} | Net: ${hb.netAmount} | Advance: ${hb.advanceAmount}`);
    console.log(`  Hall Acc ID: ${hb.hallAccountId} | Bank ID: ${hb.bankAccountId}`);
  }

  console.log('\n=== 5. POSTED JOURNAL ENTRIES FOR HALL BOOKINGS ===');
  const hbJournals = await prisma.journalEntry.findMany({
    where: {
      isDeleted: false,
      OR: [
        { module: { contains: 'Hall', mode: 'insensitive' } },
        { reference: { contains: 'HB-', mode: 'insensitive' } },
        { description: { contains: 'Hall', mode: 'insensitive' } },
      ]
    },
    include: {
      lines: {
        include: {
          account: { include: { accountType: true } }
        }
      }
    }
  });
  console.log(`Found ${hbJournals.length} Hall Booking Journal Entries:`);
  for (const je of hbJournals) {
    console.log(`- JE ID: ${je.id} | Voucher: ${je.voucherNo} | Date: ${je.postingDate.toISOString().slice(0,10)} | Status: ${je.status} | Ref: ${je.reference} | Mod: ${je.module}`);
    for (const l of je.lines) {
      console.log(`  Line ID: ${l.id} | Account: ${l.account?.glCode} ${l.account?.accountName} (${l.account?.accountType?.name}) | Dr: ${l.debit} | Cr: ${l.credit}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
