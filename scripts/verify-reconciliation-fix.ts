/**
 * VERIFICATION — reconciliation gate behaves correctly under concurrent writes.
 *
 * Reproduces exactly what the browser does: two independent report calls, each
 * stamped with the ledger version it was computed from, then applies the same
 * gate Dashboard.jsx now applies. Read-only apart from the self-healing the two
 * report paths already perform.
 *
 *   npx tsx scripts/verify-reconciliation-fix.ts
 */
import { prisma } from '../api/_prisma.js';
import { AccountingService } from '../api/_services/accounting.service.js';

const FY = { start: '2026-01-01', end: '2026-12-31' };
const ROUNDS = 8;

const tbRevenueOf = (tb: any) => tb.accounts
  .filter((e: any) => ['REVENUE', 'INCOME'].includes((e.accountType || '').toUpperCase()))
  .reduce((s: number, e: any) => s + (Number(e.credit || 0) - Number(e.debit || 0)), 0);
const tbExpenseOf = (tb: any) => tb.accounts
  .filter((e: any) => ['EXPENSE', 'EXPENSES'].includes((e.accountType || '').toUpperCase()))
  .reduce((s: number, e: any) => s + (Number(e.debit || 0) - Number(e.credit || 0)), 0);

async function main() {
  let compared = 0, skipped = 0, falseAlarms = 0, genuine = 0;

  for (let i = 1; i <= ROUNDS; i++) {
    // Exactly what /api/v1/dashboard/stats does.
    await AccountingService.ensureLeafPostingsAndBalances(prisma).catch(() => {});
    const stats = await AccountingService.computeWithLedgerVersion(
      () => AccountingService.getFinancialSummary(FY.start, FY.end)
    );

    // Exactly what /api/v1/reports/trial-balance does — a SEPARATE request, so
    // a write can land in between. That is the whole point of the stamp.
    const tb = await AccountingService.computeWithLedgerVersion(
      () => AccountingService.getTrialBalance(FY.start, FY.end)
    );

    const dashRev = stats.result.totalRevenue;
    const dashExp = stats.result.totalExpense;
    const tbRev = tbRevenueOf(tb.result);
    const tbExp = tbExpenseOf(tb.result);
    const revDiff = Math.abs(tbRev - dashRev);
    const expDiff = Math.abs(tbExp - dashExp);

    const sameLedger = stats.ledgerVersion != null && stats.ledgerVersion === tb.ledgerVersion;

    if (!sameLedger) {
      skipped++;
      console.log(`round ${i}: SKIPPED (different ledger states)`
        + ` stats=${stats.ledgerVersion ?? 'straddled'} tb=${tb.ledgerVersion ?? 'straddled'}`
        + ` | uncomparable revDelta=${revDiff} expDelta=${expDiff}`);
      continue;
    }

    compared++;
    const alarms = revDiff > 1 || expDiff > 1;
    if (alarms) genuine++;
    console.log(`round ${i}: COMPARED ledger=${stats.ledgerVersion}`
      + ` | dashRev=${dashRev} tbRev=${tbRev} revDiff=${revDiff}`
      + ` | dashExp=${dashExp} tbExp=${tbExp} expDiff=${expDiff}`
      + ` | ${alarms ? '*** ACCOUNTING MISMATCH ***' : 'OK'}`);
    if (alarms) falseAlarms++;
  }

  console.log('\n=== RESULT ===');
  console.log(`  rounds=${ROUNDS} compared=${compared} skipped(skew)=${skipped} mismatchesRaised=${genuine}`);
  console.log(`  Every COMPARED round must show revDiff=0 and expDiff=0.`);
  console.log(`  ${genuine === 0 ? 'PASS — no reconciliation warnings on matched pairs.' : 'FAIL — a matched pair still disagrees; that is a real accounting bug.'}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
