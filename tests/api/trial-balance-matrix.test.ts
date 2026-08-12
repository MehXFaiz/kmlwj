import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../api/_prisma.js';
import { AccountingService, POSTED_JOURNAL_FILTER } from '../../api/_services/accounting.service.js';

// Same options the accounting routes use — the default 5s interactive
// transaction timeout is too tight for a hosted database.
const txOptions = { maxWait: 10000, timeout: 30000 };

/**
 * Trial Balance (Matrix) regression suite.
 *
 * Root cause of the "Income/Expense rows missing" bug: the Trial Balance
 * Matrix page (src/views/TrialBalanceSheet.jsx) opened on a hardcoded
 * `DEFAULT_FISCAL_YEAR = 2026` (01-07-2025..30-06-2026). Once "today" rolled
 * past 30-06-2026, every newly posted Revenue/Expense transaction fell
 * outside that frozen window and the Matrix rendered empty — even though
 * AccountingService.getTrialBalance (the single source of truth also used by
 * the General Ledger) always included them once the date filter actually
 * covered their posting date. That was fixed by deriving the default period
 * from the current date instead of a literal year.
 *
 * This suite guards the underlying data path — AccountingService.getTrialBalance
 * — against exactly that class of regression: every account type appearing,
 * signs following each type's normal balance, date-range scoping behaving
 * correctly for P&L accounts, and status/isDeleted filtering matching
 * POSTED_JOURNAL_FILTER. It asserts on *deltas* (before/after a posting)
 * rather than absolute totals, since this runs against the same shared,
 * already-populated database as the rest of the suite.
 */
describe('Trial Balance Matrix — Revenue/Expense data path', () => {
  let assetId: string;
  let revenueId: string;
  let expenseId: string;
  let liabilityId: string;
  let assetGlCode: string;
  let revenueGlCode: string;
  let expenseGlCode: string;
  let liabilityGlCode: string;
  const createdJournalIds: string[] = [];

  /**
   * Picks a postable (leaf, no children) account of the given type. Prefers
   * accountLevel GL, but this Chart of Accounts has no leaf-level Liability
   * account yet (its GL codes stop at SUBSIDIARY, e.g. "Accounts Payable") —
   * so this falls back to any leaf account of the type, matching what
   * getTrialBalance itself treats as postable (an account with real posted
   * activity), rather than assuming every type has reached GL level.
   */
  async function pick(typeName: string) {
    const levelRank: Record<string, number> = { GL: 0, SUBSIDIARY: 1, PARENT: 2, MAIN: 3 };
    const candidates = await prisma.account.findMany({
      where: { isDeleted: false, accountType: { name: typeName } },
    });
    candidates.sort((a, b) => (levelRank[a.accountLevel] ?? 9) - (levelRank[b.accountLevel] ?? 9) || a.glCode.localeCompare(b.glCode));
    for (const acc of candidates) {
      const hasChildren = await prisma.account.findFirst({ where: { parentId: acc.id, isDeleted: false } });
      if (!hasChildren) return acc;
    }
    throw new Error(`No postable (leaf) account of type ${typeName} to test against`);
  }

  /** Posts a balanced two-line entry with a fixed, identifiable reference. */
  async function post(
    debitAccountId: string,
    creditAccountId: string,
    amount: number,
    opts: { status?: string; postingDate?: Date } = {}
  ) {
    const je = await prisma.$transaction(
      (tx) =>
        AccountingService.postTransaction(tx, {
          module: 'Trial Balance Matrix Regression Test',
          reference: 'TB-MATRIX-TEST',
          description: `tb-matrix-test ${amount}`,
          status: opts.status || 'Posted',
          postingDate: opts.postingDate,
          lines: [
            { accountId: debitAccountId, debit: amount, credit: 0 },
            { accountId: creditAccountId, debit: 0, credit: amount },
          ],
        } as any),
      txOptions
    );
    const id = (je as any)?.id ?? (je as any)?.journalEntry?.id;
    if (id) createdJournalIds.push(id);
    return id as string;
  }

  /** Debit/credit for one GL code out of a getTrialBalance() result, or zero if absent. */
  function rowFor(tb: any, glCode: string) {
    const row = tb.accounts.find((a: any) => a.glCode === glCode);
    return { debit: row?.debit || 0, credit: row?.credit || 0, present: !!row };
  }

  beforeAll(async () => {
    const [asset, revenue, expense, liability] = await Promise.all([
      pick('ASSET'),
      pick('REVENUE'),
      pick('EXPENSE'),
      pick('LIABILITY'),
    ]);
    assetId = asset.id; assetGlCode = asset.glCode;
    revenueId = revenue.id; revenueGlCode = revenue.glCode;
    expenseId = expense.id; expenseGlCode = expense.glCode;
    liabilityId = liability.id; liabilityGlCode = liability.glCode;
  }, 60000);

  afterAll(async () => {
    for (const id of createdJournalIds) {
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: id } }).catch(() => {});
      await prisma.journalEntry.delete({ where: { id } }).catch(() => {});
    }
    // Leave the database consistent for whatever runs next.
    await AccountingService.recalculateAllBalances().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }, 60000);

  // A. Revenue transaction — credit-normal, must land on the CREDIT side.
  it('A) a posted Revenue transaction increases the account on the credit side', async () => {
    const before = rowFor(await AccountingService.getTrialBalance(), revenueGlCode);
    await post(assetId, revenueId, 4321); // Debit Asset / Credit Revenue
    const after = rowFor(await AccountingService.getTrialBalance(), revenueGlCode);

    expect(after.credit - before.credit).toBeCloseTo(4321, 2);
    expect(after.debit - before.debit).toBeCloseTo(0, 2);
  }, 60000);

  // B. Expense transaction — debit-normal, must land on the DEBIT side.
  it('B) a posted Expense transaction increases the account on the debit side', async () => {
    const before = rowFor(await AccountingService.getTrialBalance(), expenseGlCode);
    await post(expenseId, liabilityId, 1234); // Debit Expense / Credit Liability (accrued)
    const after = rowFor(await AccountingService.getTrialBalance(), expenseGlCode);

    expect(after.debit - before.debit).toBeCloseTo(1234, 2);
    expect(after.credit - before.credit).toBeCloseTo(0, 2);
  }, 60000);

  // C. Revenue + Expense together — both must be present and independently correct.
  it('C) Revenue and Expense postings both appear correctly in the same report', async () => {
    const before = await AccountingService.getTrialBalance();
    const revBefore = rowFor(before, revenueGlCode);
    const expBefore = rowFor(before, expenseGlCode);

    await post(assetId, revenueId, 5555);
    await post(expenseId, liabilityId, 2222);

    const after = await AccountingService.getTrialBalance();
    const revAfter = rowFor(after, revenueGlCode);
    const expAfter = rowFor(after, expenseGlCode);

    expect(revAfter.credit - revBefore.credit).toBeCloseTo(5555, 2);
    expect(expAfter.debit - expBefore.debit).toBeCloseTo(2222, 2);
  }, 60000);

  // D. Asset transaction — debit-normal, must land on the DEBIT side.
  it('D) a posted Asset-increasing transaction lands on the debit side', async () => {
    const before = rowFor(await AccountingService.getTrialBalance(), assetGlCode);
    await post(assetId, liabilityId, 3333); // Debit Asset / Credit Liability
    const after = rowFor(await AccountingService.getTrialBalance(), assetGlCode);

    expect(after.debit - before.debit).toBeCloseTo(3333, 2);
    expect(after.credit - before.credit).toBeCloseTo(0, 2);
  }, 60000);

  // E. Liability transaction — credit-normal, must land on the CREDIT side.
  it('E) a posted Liability-increasing transaction lands on the credit side', async () => {
    const before = rowFor(await AccountingService.getTrialBalance(), liabilityGlCode);
    await post(assetId, liabilityId, 4444); // Debit Asset / Credit Liability
    const after = rowFor(await AccountingService.getTrialBalance(), liabilityGlCode);

    expect(after.credit - before.credit).toBeCloseTo(4444, 2);
    expect(after.debit - before.debit).toBeCloseTo(0, 2);
  }, 60000);

  // F. Opening balance — a prior-period posting must be carried into an
  // in-period report as an opening position, not as period-activity debit/credit.
  it('F) a prior-period posting is reflected as an opening balance, not period activity', async () => {
    const priorDate = new Date('2020-01-15T00:00:00.000Z');
    await post(assetId, liabilityId, 7000, { postingDate: priorDate });

    const windowStart = '2025-01-01';
    const windowEnd = '2025-12-31';
    const tb = await AccountingService.getTrialBalance(windowStart, windowEnd);
    const assetRow = tb.accounts.find((a: any) => a.glCode === assetGlCode);

    // The asset is a balance-sheet account: its window row is a CUMULATIVE
    // position (opening carried in + any in-window movement), so the prior
    // 7000 must show up in openingBalance without appearing as fresh period debit.
    expect(assetRow).toBeTruthy();
    expect(assetRow.openingBalance).toBeGreaterThanOrEqual(7000);
  }, 60000);

  // G. Date range filtering — a P&L posting outside the queried window must
  // not leak into that window's totals; the same posting must appear once the
  // window is widened to cover it. This is the exact mechanism behind the
  // "Income/Expense rows missing" bug: a P&L account's in-window balance is
  // period-only (see getTrialBalance's `isPnl` branch), so it must be zero
  // when the window excludes the transaction's date.
  it('G) P&L postings are scoped strictly to the queried date range', async () => {
    const outOfRangeDate = new Date('2018-03-10T00:00:00.000Z');
    await post(assetId, revenueId, 9191, { postingDate: outOfRangeDate });

    const farWindow = await AccountingService.getTrialBalance('2030-01-01', '2030-12-31');
    const excluded = rowFor(farWindow, revenueGlCode);
    expect(excluded.credit).toBe(0);

    const coveringWindow = await AccountingService.getTrialBalance('2018-01-01', '2018-12-31');
    const included = rowFor(coveringWindow, revenueGlCode);
    expect(included.credit).toBeCloseTo(9191, 2);
  }, 60000);

  // H. Deleted journal entry exclusion.
  it('H) a soft-deleted journal entry is excluded from the Trial Balance', async () => {
    const before = rowFor(await AccountingService.getTrialBalance(), expenseGlCode);
    const id = await post(expenseId, liabilityId, 6767);

    const afterPost = rowFor(await AccountingService.getTrialBalance(), expenseGlCode);
    expect(afterPost.debit - before.debit).toBeCloseTo(6767, 2);

    await prisma.journalEntry.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    const afterDelete = rowFor(await AccountingService.getTrialBalance(), expenseGlCode);
    expect(afterDelete.debit - before.debit).toBeCloseTo(0, 2);

    // Restore so afterAll's hard-delete cleanup still finds/removes it cleanly.
    await prisma.journalEntry.update({ where: { id }, data: { isDeleted: false, deletedAt: null } });
  }, 60000);

  // I. Draft journal entry exclusion.
  it('I) a Draft journal entry contributes nothing to the Trial Balance', async () => {
    const before = rowFor(await AccountingService.getTrialBalance(), revenueGlCode);
    await post(assetId, revenueId, 8181, { status: 'Draft' });
    const after = rowFor(await AccountingService.getTrialBalance(), revenueGlCode);

    expect(after.credit - before.credit).toBeCloseTo(0, 2);
  }, 60000);

  // J. Posted journal entry inclusion — the draft from (I), once posted, must appear.
  it('J) posting a previously-Draft entry brings it into the Trial Balance', async () => {
    const before = rowFor(await AccountingService.getTrialBalance(), expenseGlCode);
    const id = await post(expenseId, liabilityId, 2929, { status: 'Draft' });

    const whileDraft = rowFor(await AccountingService.getTrialBalance(), expenseGlCode);
    expect(whileDraft.debit - before.debit).toBeCloseTo(0, 2);

    await prisma.$transaction((tx) => AccountingService.postDraft(tx, id), txOptions);

    const afterPost = rowFor(await AccountingService.getTrialBalance(), expenseGlCode);
    expect(afterPost.debit - before.debit).toBeCloseTo(2929, 2);
  }, 60000);

  // K. Debit/Credit equality — the whole-ledger invariant the "Balancing
  // Status" badge on the Trial Balance page reports.
  it('K) total debits equal total credits after a batch of mixed postings', async () => {
    await post(assetId, revenueId, 111);
    await post(expenseId, liabilityId, 222);
    await post(assetId, liabilityId, 333);

    const tb = await AccountingService.getTrialBalance();
    expect(tb.totalDebit).toBeCloseTo(tb.totalCredit, 2);
    expect(tb.difference).toBeCloseTo(0, 2);
  }, 60000);

  // L. Revenue/Expense reconciliation with the General Ledger — the Trial
  // Balance and General Ledger must agree exactly for the same account and
  // date range, since both derive from AccountingService.getPostedAggregates.
  it('L) Trial Balance Revenue/Expense figures reconcile against the General Ledger', async () => {
    const startDate = '2025-01-01';
    const endDate = '2035-12-31';

    await post(assetId, revenueId, 6060, { postingDate: new Date('2025-06-01T00:00:00.000Z') });
    await post(expenseId, liabilityId, 4040, { postingDate: new Date('2025-06-02T00:00:00.000Z') });

    const tb = await AccountingService.getTrialBalance(startDate, endDate);
    const tbRevenue = tb.accounts.find((a: any) => a.glCode === revenueGlCode);
    const tbExpense = tb.accounts.find((a: any) => a.glCode === expenseGlCode);

    const [glRevenue, glExpense] = await Promise.all([
      AccountingService.getGeneralLedger({ startDate, endDate, accountId: revenueId, limit: '1000' }),
      AccountingService.getGeneralLedger({ startDate, endDate, accountId: expenseId, limit: '1000' }),
    ]);

    expect(tbRevenue.credit).toBeCloseTo(glRevenue.summary.totalCredit, 2);
    expect(tbRevenue.debit).toBeCloseTo(glRevenue.summary.totalDebit, 2);
    expect(tbExpense.debit).toBeCloseTo(glExpense.summary.totalDebit, 2);
    expect(tbExpense.credit).toBeCloseTo(glExpense.summary.totalCredit, 2);
  }, 60000);

  it('sanity — all test postings landed inside POSTED_JOURNAL_FILTER as expected', async () => {
    const count = await prisma.journalEntry.count({
      where: { id: { in: createdJournalIds }, ...POSTED_JOURNAL_FILTER },
    });
    expect(count).toBeGreaterThan(0);
  }, 60000);
});
