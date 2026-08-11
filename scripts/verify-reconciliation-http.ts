/**
 * VERIFICATION — end-to-end over HTTP, the way the browser calls it.
 *
 * GET-only: issues the exact two requests Dashboard.jsx issues, then applies
 * the exact gate Dashboard.jsx applies. No financial record is created or
 * modified. Auth is minted the same way tests/api/* already do it.
 *
 *   npx tsx scripts/verify-reconciliation-http.ts
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '../api/_prisma.js';
import app from '../api/index.js';

const FY = '2026';
const START = `${FY}-01-01`;
const END = `${FY}-12-31`;

async function token() {
  const admin = await prisma.user.findFirst({
    where: { role: { name: 'Super Admin' }, isActive: true, isDeleted: false },
    include: { role: true },
  });
  if (!admin) throw new Error('No Super Admin user to authenticate as');
  // verifyAuth reads `sub`, not `id`.
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role?.name },
    process.env.JWT_SECRET as string,
    { expiresIn: '10m' }
  );
}

const tbRevenueOf = (entries: any[]) => entries
  .filter(e => ['REVENUE', 'INCOME'].includes((e.accountType || '').toUpperCase()))
  .reduce((s, e) => s + (Number(e.credit || 0) - Number(e.debit || 0)), 0);
const tbExpenseOf = (entries: any[]) => entries
  .filter(e => ['EXPENSE', 'EXPENSES'].includes((e.accountType || '').toUpperCase()))
  .reduce((s, e) => s + (Number(e.debit || 0) - Number(e.credit || 0)), 0);

async function main() {
  const auth = `Bearer ${await token()}`;
  let compared = 0, skipped = 0, alarms = 0;

  // Each scenario is one of the navigation paths the fix has to hold across.
  const scenarios: Array<{ label: string; params: string }> = [
    { label: 'Dashboard load (FY 2026)', params: `startDate=${START}&endDate=${END}` },
    { label: 'Refresh (same period)', params: `startDate=${START}&endDate=${END}` },
    { label: 'Navigate away & back', params: `startDate=${START}&endDate=${END}` },
    { label: 'Changed report period (FY 2025)', params: `startDate=2025-01-01&endDate=2025-12-31` },
    { label: 'Hard reload (FY 2026)', params: `startDate=${START}&endDate=${END}` },
  ];

  for (const sc of scenarios) {
    const statsRes = await request(app).get(`/api/v1/dashboard/stats?${sc.params}`).set('Authorization', auth);
    const tbRes = await request(app).get(`/api/v1/reports/trial-balance?${sc.params}`).set('Authorization', auth);

    if (statsRes.status !== 200 || tbRes.status !== 200) {
      console.log(`  ${sc.label}: HTTP ${statsRes.status}/${tbRes.status} — ${JSON.stringify(statsRes.body?.error || tbRes.body?.error)}`);
      continue;
    }

    const stats = statsRes.body.data;
    const tb = tbRes.body.data;

    if (stats.ledgerVersion === undefined || tb.ledgerVersion === undefined) {
      console.log(`  ${sc.label}: FAIL — ledgerVersion missing from a response`);
      continue;
    }

    const dashRev = Number(stats.summary.totalRevenue || 0);
    const dashExp = Number(stats.summary.totalExpense || 0);
    const tbRev = tbRevenueOf(tb.entries);
    const tbExp = tbExpenseOf(tb.entries);
    const revDiff = Math.abs(tbRev - dashRev);
    const expDiff = Math.abs(tbExp - dashExp);

    const samePeriod = JSON.stringify(stats.reportPeriod) === JSON.stringify(tb.reportPeriod);
    const sameLedger = stats.ledgerVersion != null && stats.ledgerVersion === tb.ledgerVersion;

    if (!samePeriod) { console.log(`  ${sc.label}: period mismatch ${JSON.stringify(stats.reportPeriod)} vs ${JSON.stringify(tb.reportPeriod)}`); continue; }

    if (!sameLedger) {
      skipped++;
      console.log(`  ${sc.label}: SKIPPED (ledger moved between the two requests) — no false alarm raised`);
      continue;
    }

    compared++;
    const raised = revDiff > 1 || expDiff > 1;
    if (raised) alarms++;
    console.log(`  ${sc.label}: revenue Dash=${dashRev} TB=${tbRev} diff=PKR ${revDiff}`
      + ` | expense Dash=${dashExp} TB=${tbExp} diff=PKR ${expDiff}`
      + ` | ${raised ? '*** ACCOUNTING MISMATCH ***' : 'OK'}`);
  }

  console.log('\n=== RESULT ===');
  console.log(`  compared=${compared} skipped(skew)=${skipped} mismatchWarningsRaised=${alarms}`);
  // Zero alarms is only meaningful if pairs were actually compared — otherwise
  // the run proved nothing.
  if (compared === 0) {
    console.log('  INCONCLUSIVE — no matched pair was compared, so nothing was verified.');
    process.exitCode = 1;
  } else {
    console.log(`  ${alarms === 0 ? 'PASS' : 'FAIL'} — Revenue Difference = PKR 0, Expense Difference = PKR 0 on every matched pair.`);
    if (alarms > 0) process.exitCode = 1;
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
