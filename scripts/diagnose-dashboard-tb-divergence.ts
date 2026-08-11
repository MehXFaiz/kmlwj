/**
 * TEMPORARY DIAGNOSTIC — Dashboard vs Trial Balance revenue/expense divergence.
 *
 * Read-only except that it invokes the same service methods the two API
 * endpoints invoke (those methods self-heal; that is precisely part of what we
 * are measuring). Creates no records, modifies no financial data.
 *
 *   npx tsx scripts/diagnose-dashboard-tb-divergence.ts
 */
import { prisma } from '../api/_prisma.js';
import { AccountingService } from '../api/_services/accounting.service.js';

const FY = { start: '2026-01-01', end: '2026-12-31' };

const tbRevenueOf = (tb: any) => tb.accounts
  .filter((e: any) => ['REVENUE', 'INCOME'].includes((e.accountType || '').toUpperCase()))
  .reduce((s: number, e: any) => s + (Number(e.credit || 0) - Number(e.debit || 0)), 0);
const tbExpenseOf = (tb: any) => tb.accounts
  .filter((e: any) => ['EXPENSE', 'EXPENSES'].includes((e.accountType || '').toUpperCase()))
  .reduce((s: number, e: any) => s + (Number(e.debit || 0) - Number(e.credit || 0)), 0);

const JE_SELECT = { id: true, voucherNo: true, postingDate: true, status: true, voucherType: true, reference: true } as const;

async function main() {
  console.log('############ A. ACCOUNT TYPE NAMES IN DB ############');
  const types = await prisma.accountType.findMany();
  for (const t of types) {
    const n = await prisma.account.count({ where: { accountTypeId: t.id, isDeleted: false } });
    console.log(`  AccountType: "${t.name}"  (accounts: ${n})`);
  }

  console.log('\n############ B. POSTED LINES ON NON-LEAF (HEADER) ACCOUNTS ############');
  console.log('  Trial Balance iterates ALL accounts; Dashboard iterates LEAF accounts only.');
  const allAccounts = await prisma.account.findMany({
    where: { isDeleted: false },
    include: { accountType: true },
  });
  const parentIds = new Set(allAccounts.map(a => a.parentId).filter(Boolean) as string[]);
  const headerAccounts = allAccounts.filter(a => parentIds.has(a.id));
  const headerLines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: { in: headerAccounts.map(a => a.id) },
      journalEntry: { status: 'Posted', isDeleted: false },
    },
    include: {
      account: { include: { accountType: true } },
      journalEntry: { select: JE_SELECT },
    },
  });
  console.log(`  header accounts: ${headerAccounts.length}, posted lines sitting on them: ${headerLines.length}`);
  for (const l of headerLines) {
    console.log(`  LINE ${l.id} | JE ${l.journalEntry.voucherNo} ${l.journalEntry.postingDate.toISOString().slice(0, 10)}`
      + ` | ${l.account.glCode} ${l.account.accountName} [${l.account.accountLevel}/${l.account.accountType?.name}]`
      + ` | Dr ${l.debit} Cr ${l.credit}`);
  }

  console.log('\n############ C. SEQUENTIAL (CONTROL) ############');
  const seqSummary = await AccountingService.getFinancialSummary(FY.start, FY.end);
  const seqTb = await AccountingService.getTrialBalance(FY.start, FY.end);
  console.log(`  Dashboard revenue=${seqSummary.totalRevenue} expense=${seqSummary.totalExpense}`);
  console.log(`  TrialBal  revenue=${tbRevenueOf(seqTb)} expense=${tbExpenseOf(seqTb)}`);
  console.log(`  revDiff=${Math.abs(tbRevenueOf(seqTb) - seqSummary.totalRevenue)}`
    + ` expDiff=${Math.abs(tbExpenseOf(seqTb) - seqSummary.totalExpense)}`);

  console.log('\n############ D. CONCURRENT — reproduces the browser ############');
  console.log('  Dashboard.jsx fires fetchStats() and fetchTbReport() together; both');
  console.log('  endpoints run write-healing while reading. 5 concurrent rounds:');
  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now();
    const [sum, tb] = await Promise.all([
      AccountingService.getFinancialSummary(FY.start, FY.end),
      AccountingService.getTrialBalance(FY.start, FY.end),
    ]);
    const r = Math.abs(tbRevenueOf(tb) - sum.totalRevenue);
    const e = Math.abs(tbExpenseOf(tb) - sum.totalExpense);
    console.log(`  round ${i} (${Date.now() - t0}ms): dashRev=${sum.totalRevenue} tbRev=${tbRevenueOf(tb)} revDiff=${r}`
      + ` | dashExp=${sum.totalExpense} tbExp=${tbExpenseOf(tb)} expDiff=${e}`);
  }

  console.log('\n############ E. WHAT THE UI ACTUALLY COMPARES ############');
  console.log('  TrialBalanceSheet.jsx mounts with fetchTbReport({}) => ALL TIME.');
  const tbAllTime = await AccountingService.getTrialBalance();
  const sumFy = await AccountingService.getFinancialSummary(FY.start, FY.end);
  console.log(`  all-time TB revenue=${tbRevenueOf(tbAllTime)} vs FY dashboard revenue=${sumFy.totalRevenue}`
    + ` -> diff=${Math.abs(tbRevenueOf(tbAllTime) - sumFy.totalRevenue)}`);
  console.log(`  all-time TB expense=${tbExpenseOf(tbAllTime)} vs FY dashboard expense=${sumFy.totalExpense}`
    + ` -> diff=${Math.abs(tbExpenseOf(tbAllTime) - sumFy.totalExpense)}`);

  console.log('\n############ F. HALL BOOKING REVENUE AUDIT ############');
  const bookings = await prisma.hallBooking.findMany({
    where: { isDeleted: false },
    include: {
      hallAccount: true,
      journalEntry: {
        include: { lines: { include: { account: { include: { accountType: true } } } } },
      },
    },
    orderBy: { bookingDate: 'asc' },
  });
  console.log(`  ${bookings.length} bookings`);
  let gross = 0, disc = 0, net = 0, recv = 0, glRevSum = 0;
  const seenJe = new Set<string>();
  for (const b of bookings as any[]) {
    const je = b.journalEntry;
    const posted = je && !je.isDeleted && je.status === 'Posted';
    const glRev = posted
      ? je.lines
        .filter((l: any) => (l.account?.accountType?.name || '').toUpperCase() === 'REVENUE')
        .reduce((s: number, l: any) => s + (Number(l.credit) || 0) - (Number(l.debit) || 0), 0)
      : 0;
    if (je && seenJe.has(je.id)) console.log(`  !! DUPLICATE JE ${je.id} referenced by booking ${b.id}`);
    if (je) seenJe.add(je.id);
    gross += Number(b.hallCharges || 0);
    disc += Number(b.discount || 0);
    net += Number(b.netAmount || 0);
    recv += Number(b.receivedAmount || 0);
    glRevSum += glRev;
    console.log(`  Booking ${b.id} rcpt#${b.receiptNo} ${new Date(b.bookingDate).toISOString().slice(0, 10)}`
      + ` | hall=${b.hallAccount?.accountName || '-'} | status=${b.status} | pay=${b.paymentMethod}`
      + ` | charges=${b.hallCharges} disc=${b.discount} net=${b.netAmount} recvd=${b.receivedAmount} remain=${b.remainingAmount} refund=${b.refundAmount}`
      + ` | JE=${je?.voucherNo || 'NONE'}/${je?.status || '-'} glRevenue=${glRev}`);
  }
  console.log(`  TOTALS charges=${gross} discount=${disc} net=${net} received=${recv} postedGLRevenue=${glRevSum}`);
  console.log(`  net-vs-GL delta = ${net - glRevSum} | received-vs-GL delta = ${recv - glRevSum}`);

  console.log('\n############ G. POSTED LINES MATCHING THE REPORTED DIFFS ############');
  for (const amt of [3500, 8000, 25000, 52000, 57000]) {
    const hits = await prisma.journalEntryLine.findMany({
      where: {
        journalEntry: { isDeleted: false },
        OR: [{ debit: amt }, { credit: amt }],
      },
      include: {
        account: { include: { accountType: true } },
        journalEntry: { select: JE_SELECT },
      },
      take: 8,
    });
    console.log(`  --- amount ${amt}: ${hits.length} line(s)`);
    for (const h of hits) {
      console.log(`      JE ${h.journalEntry.voucherNo} ${h.journalEntry.postingDate.toISOString().slice(0, 10)}`
        + ` [${h.journalEntry.status}/${h.journalEntry.voucherType}] ${h.account.glCode} ${h.account.accountName}`
        + ` (${h.account.accountType?.name}) Dr ${h.debit} Cr ${h.credit}`);
    }
  }

  console.log('\n############ H. DRAFT / CANCELLED ENTRIES (excluded by both) ############');
  const byStatus = await prisma.journalEntry.groupBy({ by: ['status', 'isDeleted'], _count: true });
  for (const g of byStatus) console.log(`  status=${g.status} isDeleted=${g.isDeleted} count=${g._count}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
