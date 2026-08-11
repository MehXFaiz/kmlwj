/**
 * TEMPORARY DIAGNOSTIC — are the two revenue/expense formulas equivalent?
 *
 * Strictly read-only. Pulls ONE snapshot of accounts + posted lines inside a
 * single transaction, then replays BOTH formulas over that same snapshot, so a
 * concurrent writer cannot straddle the comparison. Any difference reported
 * here is a genuine formula difference, not snapshot skew.
 *
 *   npx tsx scripts/diagnose-formula-equivalence.ts
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../api/_prisma.js';

const FY = { start: '2026-01-01', end: '2026-12-31' };

function endOfDay(d: string) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

async function main() {
  const from = new Date(FY.start);
  const to = endOfDay(FY.end);

  const snap = await prisma.$transaction(async (tx) => {
    const accounts = await tx.account.findMany({ where: { isDeleted: false }, include: { accountType: true } });
    const periodGroups = await tx.journalEntryLine.groupBy({
      by: ['accountId'],
      where: { journalEntry: { status: 'Posted', isDeleted: false, postingDate: { gte: from, lte: to } } },
      _sum: { debit: true, credit: true },
    });
    const cumulativeGroups = await tx.journalEntryLine.groupBy({
      by: ['accountId'],
      where: { journalEntry: { status: 'Posted', isDeleted: false, postingDate: { lte: to } } },
      _sum: { debit: true, credit: true },
    });
    return { accounts, periodGroups, cumulativeGroups };
  }, { timeout: 120000, maxWait: 30000 });

  const period = new Map(snap.periodGroups.map(g => [g.accountId, {
    d: new Prisma.Decimal(g._sum.debit ?? 0), c: new Prisma.Decimal(g._sum.credit ?? 0),
  }]));
  const cumulative = new Map(snap.cumulativeGroups.map(g => [g.accountId, {
    d: new Prisma.Decimal(g._sum.debit ?? 0), c: new Prisma.Decimal(g._sum.credit ?? 0),
  }]));

  // ── Formula 1: AccountingBalanceRebuildService.rebuildAllSummaries
  //    leaf accounts only; REVENUE|INCOME and EXPENSE|EXPENSES; period window.
  const leaf = snap.accounts.filter(a => !snap.accounts.some(c => c.parentId === a.id));
  let dashRev = new Prisma.Decimal(0), dashExp = new Prisma.Decimal(0);
  for (const a of leaf) {
    const t = (a.accountType?.name || '').toUpperCase();
    const p = period.get(a.id);
    const d = p?.d ?? new Prisma.Decimal(0), c = p?.c ?? new Prisma.Decimal(0);
    if (t === 'REVENUE' || t === 'INCOME') dashRev = dashRev.plus(c.minus(d));
    else if (t === 'EXPENSE' || t === 'EXPENSES') dashExp = dashExp.plus(d.minus(c));
  }

  // ── Formula 2: AccountingService.getTrialBalance
  //    ALL accounts; isPnl matches only REVENUE|EXPENSE (no INCOME/EXPENSES);
  //    P&L uses the period window, everything else cumulative + initialBalance.
  //    Then Dashboard.jsx re-nets the emitted debit/credit columns.
  let tbRev = new Prisma.Decimal(0), tbExp = new Prisma.Decimal(0);
  const strays: string[] = [];
  for (const a of snap.accounts) {
    const t = (a.accountType?.name || '').toUpperCase();
    const isPnl = ['REVENUE', 'EXPENSE'].includes(t);
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(t);
    const agg = isPnl ? period.get(a.id) : cumulative.get(a.id);
    const d = agg?.d ?? new Prisma.Decimal(0), c = agg?.c ?? new Prisma.Decimal(0);
    const init = isPnl ? new Prisma.Decimal(0) : new Prisma.Decimal(a.initialBalance ?? 0);
    const bal = isDebitNormal ? init.plus(d).minus(c) : init.plus(c).minus(d);

    let debit = new Prisma.Decimal(0), credit = new Prisma.Decimal(0);
    if (isDebitNormal) { if (bal.gt(0)) debit = bal; else credit = bal.abs(); }
    else { if (bal.gt(0)) credit = bal; else debit = bal.abs(); }

    if (['REVENUE', 'INCOME'].includes(t)) tbRev = tbRev.plus(credit.minus(debit));
    else if (['EXPENSE', 'EXPENSES'].includes(t)) tbExp = tbExp.plus(debit.minus(credit));

    // Divergence probes
    const isLeaf = !snap.accounts.some(x => x.parentId === a.id);
    const hasActivity = !(period.get(a.id)?.d ?? new Prisma.Decimal(0)).isZero()
      || !(period.get(a.id)?.c ?? new Prisma.Decimal(0)).isZero();
    if (!isLeaf && hasActivity && ['REVENUE', 'INCOME', 'EXPENSE', 'EXPENSES'].includes(t)) {
      strays.push(`HEADER POSTING: ${a.glCode} ${a.accountName} [${a.accountLevel}/${t}] counted by TB, dropped by Dashboard`);
    }
    if (['INCOME', 'EXPENSES', 'ASSETS'].includes(t)) {
      strays.push(`ALIAS TYPE NAME: ${a.glCode} ${a.accountName} has accountType "${a.accountType?.name}" — getTrialBalance's isPnl/isDebitNormal do not match it`);
    }
  }

  console.log('=== SAME-SNAPSHOT REPLAY OF BOTH FORMULAS (FY 2026) ===');
  console.log(`  Dashboard formula : revenue=${dashRev} expense=${dashExp}`);
  console.log(`  TrialBalance form.: revenue=${tbRev} expense=${tbExp}`);
  console.log(`  revDiff=${tbRev.minus(dashRev).abs()}  expDiff=${tbExp.minus(dashExp).abs()}`);
  console.log(`  accounts=${snap.accounts.length} leaf=${leaf.length} header=${snap.accounts.length - leaf.length}`);
  console.log('\n=== LATENT DIVERGENCE PROBES ===');
  if (strays.length === 0) console.log('  none active on current data');
  for (const s of [...new Set(strays)]) console.log(`  ${s}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
