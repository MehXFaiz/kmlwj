/**
 * VERIFICATION — Trial Balance opening balances per account, for a chosen FY.
 *
 * Strictly READ-ONLY. Derives every figure from posted JournalEntryLine rows
 * (status='Posted', isDeleted=false) exactly as AccountingService does, and
 * checks the accounting identity the report must satisfy:
 *
 *     Opening + Period Debits - Period Credits = Closing
 *
 * Usage:  npx tsx scripts/verify-opening-balances.ts [FY]
 *         FY 2026 => 01-07-2025 .. 30-06-2026   (July-June financial year)
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../api/_prisma.js';
import { AccountingService } from '../api/_services/accounting.service.js';

/** FY N runs 01-07-(N-1) .. 30-06-N. */
function fyRange(fy: number) {
  return { startDate: `${fy - 1}-07-01`, endDate: `${fy}-06-30` };
}

/** The six canonical opening-balance accounts, addressed by GL code only. */
const OPENING_ACCOUNTS = ['1010101', '1010102', '1010103', '1010104', '1010301', '1010201'];

const money = (d: Prisma.Decimal) => d.toFixed(2).padStart(16);

async function main() {
  const fy = Number(process.argv[2] || 2026);
  const { startDate, endDate } = fyRange(fy);
  const from = new Date(startDate);
  const to = new Date(endDate); to.setHours(23, 59, 59, 999);
  const priorTo = new Date(from.getTime() - 1);

  console.log(`FY ${fy}:  opening as of ${startDate}   closing as of ${endDate}`);
  console.log(`  prior window: everything posted <= ${priorTo.toISOString()}\n`);

  const prior = await AccountingService.getPostedAggregates({ to: priorTo });
  const period = await AccountingService.getPostedAggregates({ from, to });
  const cumulative = await AccountingService.getPostedAggregates({ to });

  const accounts = await prisma.account.findMany({
    where: { glCode: { in: OPENING_ACCOUNTS } },
    include: { accountType: true },
  });
  const byCode = new Map(accounts.map(a => [a.glCode, a]));

  console.log('GL CODE  ACCOUNT                          OPENING(Dr)      PERIOD Dr       PERIOD Cr        CLOSING(Dr)   IDENTITY');
  let openTotal = new Prisma.Decimal(0);
  let closeTotal = new Prisma.Decimal(0);
  let allOk = true;

  for (const code of OPENING_ACCOUNTS) {
    const acc = byCode.get(code);
    if (!acc) { console.log(`${code}  *** ACCOUNT NOT FOUND ***`); allOk = false; continue; }

    const type = acc.accountType?.name?.toUpperCase() || 'ASSET';
    const opening = AccountingService.naturalBalance(type, acc.initialBalance, prior.get(acc.id));
    const closing = AccountingService.naturalBalance(type, acc.initialBalance, cumulative.get(acc.id));
    const pd = period.get(acc.id)?.debit ?? new Prisma.Decimal(0);
    const pc = period.get(acc.id)?.credit ?? new Prisma.Decimal(0);

    const identityOk = opening.plus(pd).minus(pc).equals(closing);
    if (!identityOk) allOk = false;
    openTotal = openTotal.plus(opening);
    closeTotal = closeTotal.plus(closing);

    console.log(`${code}  ${acc.accountName.slice(0, 30).padEnd(30)} ${money(opening)} ${money(pd)} ${money(pc)} ${money(closing)}   ${identityOk ? 'OK' : 'BROKEN'}`);
  }

  console.log(`\n  TOTAL opening = ${openTotal.toFixed(2)}   TOTAL closing = ${closeTotal.toFixed(2)}`);
  console.log(`  Identity (Opening + Dr - Cr = Closing) holds for every account: ${allOk ? 'YES' : 'NO'}`);

  // Whole-report balance check, straight from the service.
  const tb = await AccountingService.getTrialBalance(startDate, endDate);
  console.log(`\n  Trial Balance totalDebit = ${tb.totalDebit}`);
  console.log(`  Trial Balance totalCredit = ${tb.totalCredit}`);
  console.log(`  Difference = ${tb.difference}  => ${tb.difference === 0 ? 'BALANCED' : 'NOT BALANCED'}`);

  // ── Does the Jammat sheet still balance if opening balances move to DEBIT?
  // The sheet is a Receipts & Payments statement: Opening + Revenue = Expense +
  // Closing. With Revenue on CREDIT and Expense on DEBIT, that identity only
  // closes when Opening contributes to CREDIT and Closing to DEBIT (each as a
  // SIGNED amount, i.e. a negative balance crossing to the other column).
  const cats0 = tb.openingBalances as any;
  const cats1 = tb.closingBalances as any;
  const catKeys = ['banks', 'cashInHand', 'advanceAndLoan', 'receivable', 'otherAssets'];
  const flat = (c: any) => catKeys.flatMap(k => c[k]?.accounts ?? []);

  const revenue = tb.accounts
    .filter((e: any) => ['REVENUE', 'INCOME'].includes((e.accountType || '').toUpperCase()))
    .reduce((s: number, e: any) => s + Math.max(0, (e.credit || 0) - (e.debit || 0)), 0);
  const expense = tb.accounts
    .filter((e: any) => (e.accountType || '').toUpperCase() === 'EXPENSE')
    .reduce((s: number, e: any) => s + Math.max(0, (e.debit || 0) - (e.credit || 0)), 0);

  let openDr = 0, openCr = 0, closeDr = 0, closeCr = 0;
  for (const a of flat(cats0)) { if (a.balance > 0) openCr += a.balance; else openDr += Math.abs(a.balance); }
  for (const a of flat(cats1)) { if (a.balance > 0) closeDr += a.balance; else closeCr += Math.abs(a.balance); }

  // Requested layout: positive asset opening -> DEBIT, negative -> CREDIT.
  let openDrFlipped = 0, openCrFlipped = 0;
  for (const a of flat(cats0)) { if (a.balance > 0) openDrFlipped += a.balance; else openCrFlipped += Math.abs(a.balance); }

  const curDr = openDr + expense + closeDr;
  const curCr = openCr + revenue + closeCr;
  const flipDr = openDrFlipped + expense + closeDr;
  const flipCr = openCrFlipped + revenue + closeCr;

  console.log('\n  --- JAMMAT SHEET TOTALS: current placement vs requested placement ---');
  console.log(`  revenue=${revenue}  expense=${expense}`);
  console.log(`  CURRENT  (opening->credit side): Debit=${curDr}  Credit=${curCr}  diff=${Math.abs(curDr - curCr)} ${Math.abs(curDr - curCr) < 0.01 ? '=> BALANCED' : '=> NOT BALANCED'}`);
  console.log(`  REQUESTED(opening->debit side) : Debit=${flipDr}  Credit=${flipCr}  diff=${Math.abs(flipDr - flipCr)} ${Math.abs(flipDr - flipCr) < 0.01 ? '=> BALANCED' : '=> NOT BALANCED'}`);

  // What the report actually ships to the UI.
  const cats = tb.openingBalances as any;
  console.log('\n  openingBalances categories returned to the UI:');
  for (const key of ['banks', 'cashInHand', 'advanceAndLoan', 'receivable', 'otherAssets']) {
    const c = cats[key];
    console.log(`    ${key.padEnd(15)} total=${String(c.total).padStart(14)}  accounts=${c.accounts.length}`);
    for (const a of c.accounts) console.log(`        ${a.glCode} ${a.name.slice(0, 34).padEnd(34)} balance=${a.balance}`);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
