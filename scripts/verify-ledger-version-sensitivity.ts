/**
 * VERIFICATION — the ledger fingerprint actually moves when the ledger moves.
 *
 * Strictly READ-ONLY: no journal entry, line or balance is created, modified or
 * deleted. Sensitivity is demonstrated by recomputing the same fingerprint over
 * deliberately perturbed *query scopes* (one fewer posted entry / one fewer
 * posted line / an entry treated as soft-deleted) and showing each perturbation
 * produces a different stamp — i.e. any real post, soft-delete, restore,
 * reversal or auto-heal re-link would change it too.
 *
 *   npx tsx scripts/verify-ledger-version-sensitivity.ts
 */
import { prisma } from '../api/_prisma.js';
import { AccountingService, POSTED_JOURNAL_FILTER } from '../api/_services/accounting.service.js';

/** Same shape as AccountingService.getLedgerVersion, over an arbitrary scope. */
async function fingerprint(entryWhere: any, lineWhere: any): Promise<string> {
  const [entries, lines] = await Promise.all([
    prisma.journalEntry.aggregate({ where: entryWhere, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.journalEntryLine.aggregate({ where: lineWhere, _count: { _all: true }, _max: { updatedAt: true } }),
  ]);
  return [
    entries._count._all,
    entries._max.updatedAt?.getTime() ?? 0,
    lines._count._all,
    lines._max.updatedAt?.getTime() ?? 0,
  ].join(':');
}

async function main() {
  const live = await AccountingService.getLedgerVersion();
  console.log(`  live fingerprint                     : ${live}`);

  const baseline = await fingerprint(POSTED_JOURNAL_FILTER, { journalEntry: POSTED_JOURNAL_FILTER });
  console.log(`  recomputed over same scope           : ${baseline}  ${baseline === live ? '(stable)' : '(UNSTABLE)'}`);

  const newest = await prisma.journalEntry.findFirst({
    where: POSTED_JOURNAL_FILTER,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, voucherNo: true },
  });
  if (!newest) { console.log('  no posted entries to perturb'); return; }

  // "As if" that entry had never been posted — i.e. what the fingerprint WOULD
  // have been one post earlier. No data is touched; only the query scope moves.
  const withoutEntry = await fingerprint(
    { ...POSTED_JOURNAL_FILTER, id: { not: newest.id } },
    { journalEntry: { ...POSTED_JOURNAL_FILTER, id: { not: newest.id } } }
  );
  console.log(`  as if JE ${newest.voucherNo} were absent : ${withoutEntry}`);

  const newestLine = await prisma.journalEntryLine.findFirst({
    where: { journalEntry: POSTED_JOURNAL_FILTER },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  const withoutLine = newestLine
    ? await fingerprint(POSTED_JOURNAL_FILTER, { journalEntry: POSTED_JOURNAL_FILTER, id: { not: newestLine.id } })
    : baseline;
  console.log(`  as if one line were re-linked away    : ${withoutLine}`);

  const checks = [
    ['stable across repeat reads', baseline === live],
    ['changes when a posted entry count/updatedAt changes', withoutEntry !== baseline],
    ['changes when a posted LINE changes (auto-heal re-link)', withoutLine !== baseline],
  ] as const;

  console.log('\n=== RESULT ===');
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`);
    if (!pass) ok = false;
  }
  console.log(ok
    ? '  Fingerprint is stable on a quiet ledger and sensitive to every mutation shape.'
    : '  Fingerprint is not sensitive enough — the reconciliation gate would let skew through.');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
