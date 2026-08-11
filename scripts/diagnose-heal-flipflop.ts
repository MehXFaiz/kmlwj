/**
 * TEMPORARY DIAGNOSTIC — is the auto-healer mutating the ledger on every read?
 *
 * getTrialBalance() awaits healJournalEntryAccounts() and /dashboard/stats
 * fires ensureLeafPostingsAndBalances() un-awaited. Both are WRITERS. This
 * script snapshots revenue/expense around them and reports what they re-link.
 *
 *   npx tsx scripts/diagnose-heal-flipflop.ts
 */
import { prisma } from '../api/_prisma.js';
import { AccountingService } from '../api/_services/accounting.service.js';

const FY = { start: '2026-01-01', end: '2026-12-31' };

async function totals(label: string) {
  const s = await AccountingService.getFinancialSummary(FY.start, FY.end);
  console.log(`  [${label}] revenue=${s.totalRevenue} expense=${s.totalExpense}`);
  return s;
}

async function main() {
  console.log('############ 1. MULTI-CREDIT / MULTI-DEBIT SOURCE DOCUMENTS ############');
  console.log('  healJournalEntryAccounts picks the line to re-link with');
  console.log('    findFirst({ where: { journalEntryId, credit: { gt: 0 } } })   // no orderBy');
  console.log('  If a JE has more than one such line, which line gets re-pointed is');
  console.log('  whatever order Postgres happens to return — different on each call.');

  const incomeRecs = await prisma.addIncomeRecord.findMany({
    where: { isDeleted: false, journalEntryId: { not: null } },
    include: { category: true },
  });
  let multiCredit = 0;
  for (const rec of incomeRecs as any[]) {
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: rec.journalEntryId! },
      include: { account: { include: { accountType: true } } },
    });
    const credits = lines.filter(l => Number(l.credit) > 0);
    if (credits.length > 1) {
      multiCredit++;
      console.log(`  AddIncomeRecord ${rec.id} JE ${rec.journalEntryId} has ${credits.length} credit lines`
        + ` -> target category account = ${rec.category?.accountId}`);
      for (const c of credits) {
        console.log(`      line ${c.id} ${c.account.glCode} ${c.account.accountName}`
          + ` (${c.account.accountType?.name}) Cr ${c.credit}`);
      }
    }
  }
  console.log(`  AddIncomeRecords: ${incomeRecs.length}, with >1 credit line: ${multiCredit}`);

  const simpleExps = await prisma.simpleExpense.findMany({
    where: { isDeleted: false, journalEntryId: { not: null } },
    include: { expenseHead: true },
  });
  let multiDebit = 0;
  for (const exp of simpleExps as any[]) {
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: exp.journalEntryId! },
      include: { account: { include: { accountType: true } } },
    });
    const debits = lines.filter(l => Number(l.debit) > 0);
    if (debits.length > 1) {
      multiDebit++;
      console.log(`  SimpleExpense ${exp.id} JE ${exp.journalEntryId} has ${debits.length} debit lines`
        + ` -> target head account = ${exp.expenseHead?.accountId}`);
      for (const d of debits) {
        console.log(`      line ${d.id} ${d.account.glCode} ${d.account.accountName}`
          + ` (${d.account.accountType?.name}) Dr ${d.debit}`);
      }
    }
  }
  console.log(`  SimpleExpenses: ${simpleExps.length}, with >1 debit line: ${multiDebit}`);

  console.log('\n############ 2. RUN THE HEALER REPEATEDLY ############');
  console.log('  A converged healer repairs nothing on the second pass.');
  await totals('before any heal');
  for (let i = 1; i <= 4; i++) {
    const accBefore = await prisma.account.count();
    const res = await AccountingService.healJournalEntryAccounts();
    const accAfter = await prisma.account.count();
    console.log(`  heal pass ${i}: repaired=${res.repaired.length} skipped=${res.skipped.length}`
      + ` accounts ${accBefore}->${accAfter}`);
    for (const r of res.repaired.slice(0, 10)) console.log(`      + ${r.action || JSON.stringify(r)}`);
    await totals(`after heal ${i}`);
  }

  console.log('\n############ 3. ensureLeafPostingsAndBalances (fired un-awaited by /stats) ############');
  await totals('before ensureLeaf');
  await AccountingService.ensureLeafPostingsAndBalances(prisma);
  await totals('after ensureLeaf 1');
  await AccountingService.ensureLeafPostingsAndBalances(prisma);
  await totals('after ensureLeaf 2');

  console.log('\n############ 4. PURE READ STABILITY (no healer) ############');
  console.log('  getFinancialSummary alone, 4 times — should be identical every time.');
  for (let i = 1; i <= 4; i++) await totals(`pure read ${i}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
