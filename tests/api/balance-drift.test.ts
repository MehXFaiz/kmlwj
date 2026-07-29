import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../api/_prisma.js';
import { AccountingService, POSTED_JOURNAL_FILTER } from '../../api/_services/accounting.service.js';

// Same options the accounting routes use — the default 5s interactive
// transaction timeout is too tight for a hosted database.
const txOptions = { maxWait: 10000, timeout: 30000 };

/**
 * Account balance drift regression suite.
 *
 * The invariant under test, after every lifecycle operation:
 *
 *   Account.currentBalance == initialBalance +/- SUM(posted journal lines)
 *
 * where "posted" means POSTED_JOURNAL_FILTER — status 'Posted' AND not
 * soft-deleted. Drift used to appear because the cache was maintained with
 * incremental deltas that some code paths (notably every module's soft-delete)
 * simply never applied, and because the recalculation itself ignored
 * `isDeleted` and so faithfully reproduced the stale figure.
 */
describe('Account balance drift', () => {
  let cashId: string;
  let revenueId: string;
  let expenseId: string;
  const createdJournalIds: string[] = [];

  /** Recomputes an account's balance from the ledger, independently of the cache. */
  async function ledgerBalance(accountId: string): Promise<Prisma.Decimal> {
    const acc = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: { accountType: true },
    });
    const agg = await prisma.journalEntryLine.aggregate({
      where: { accountId, journalEntry: POSTED_JOURNAL_FILTER },
      _sum: { debit: true, credit: true },
    });
    const d = new Prisma.Decimal(agg._sum.debit ?? 0);
    const c = new Prisma.Decimal(agg._sum.credit ?? 0);
    const init = new Prisma.Decimal(acc.initialBalance ?? 0);
    const debitNormal = ['ASSET', 'EXPENSE'].includes((acc.accountType?.name || '').toUpperCase());
    return debitNormal ? init.plus(d).minus(c) : init.plus(c).minus(d);
  }

  async function storedBalance(accountId: string): Promise<Prisma.Decimal> {
    const acc = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    return new Prisma.Decimal(acc.currentBalance ?? 0);
  }

  /** The assertion this whole suite exists for. */
  async function expectNoDrift(label: string) {
    for (const [name, id] of [['cash', cashId], ['revenue', revenueId], ['expense', expenseId]] as const) {
      const stored = await storedBalance(id);
      const ledger = await ledgerBalance(id);
      expect(
        stored.equals(ledger),
        `${label}: ${name} account drifted — stored=${stored.toFixed(2)} ledger=${ledger.toFixed(2)}`
      ).toBe(true);
    }
  }

  /** Posts a balanced entry: debit one account, credit another. */
  async function post(debitAccountId: string, creditAccountId: string, amount: number, status = 'Posted') {
    const je = await prisma.$transaction(async (tx) =>
      AccountingService.postTransaction(tx, {
        module: 'Journal Entries',
        description: `drift-test ${amount}`,
        status,
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

  beforeAll(async () => {
    const pick = async (typeName: string) => {
      const acc = await prisma.account.findFirst({
        where: {
          accountLevel: 'GL',
          isDeleted: false,
          accountType: { name: typeName },
        },
      });
      if (!acc) throw new Error(`No GL account of type ${typeName} to test against`);
      return acc.id;
    };
    cashId = await pick('ASSET');
    revenueId = await pick('REVENUE');
    expenseId = await pick('EXPENSE');
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

  it('starts from a consistent baseline (rebuild clears historical drift)', async () => {
    await AccountingService.recalculateAllBalances();
    await expectNoDrift('after full rebuild');
  }, 60000);

  it('stays consistent after posting a receipt (debit asset / credit revenue)', async () => {
    await post(cashId, revenueId, 45000);
    await expectNoDrift('after receipt posted');
  }, 60000);

  it('stays consistent after posting an expense (debit expense / credit asset)', async () => {
    await post(expenseId, cashId, 3500);
    await expectNoDrift('after expense posted');
  }, 60000);

  it('stays consistent after a soft delete — the original drift bug', async () => {
    const id = await post(cashId, revenueId, 60000);
    await expectNoDrift('after posting entry to be deleted');

    // Exactly what every module's delete handler does.
    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
      await AccountingService.recalculateBalancesForJournalEntry(tx, id);
    }, txOptions);

    await expectNoDrift('after soft delete');
  }, 60000);

  it('stays consistent after restoring a soft-deleted entry', async () => {
    const id = await post(cashId, revenueId, 12000);
    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
      await AccountingService.recalculateBalancesForJournalEntry(tx, id);
    }, txOptions);
    await expectNoDrift('after delete');

    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({ where: { id }, data: { isDeleted: false, deletedAt: null } });
      await AccountingService.recalculateBalancesForJournalEntry(tx, id);
    }, txOptions);
    await expectNoDrift('after restore');
  }, 60000);

  it('stays consistent after reversing a posted entry (credit-normal sign check)', async () => {
    // Revenue is credit-normal — the old reversal applied a raw debit-credit
    // delta here, moving the cached balance the wrong way by twice the amount.
    const id = await post(cashId, revenueId, 25000);
    await prisma.$transaction(async (tx) => {
      await AccountingService.reverseJournalEntry(tx, id, undefined, 'drift test');
    }, txOptions);
    await expectNoDrift('after reversal');

    const je = await prisma.journalEntry.findUniqueOrThrow({ where: { id } });
    expect(je.status).toBe('Cancelled');
  }, 60000);

  it('stays consistent when a draft is posted (drafts must not affect balances first)', async () => {
    const revenueBefore = await storedBalance(revenueId);
    const id = await post(cashId, revenueId, 8000, 'Draft');

    // A draft contributes nothing.
    expect((await storedBalance(revenueId)).equals(revenueBefore)).toBe(true);
    await expectNoDrift('while draft');

    await prisma.$transaction(async (tx) => {
      await AccountingService.postDraft(tx, id, undefined);
    }, txOptions);
    await expectNoDrift('after draft posted');

    // And the credit-normal account moved in the correct direction.
    const revenueAfter = await storedBalance(revenueId);
    expect(revenueAfter.minus(revenueBefore).toFixed(2)).toBe('8000.00');
  }, 60000);

  it('recalculation is idempotent — running it twice changes nothing', async () => {
    await AccountingService.recalculateAllBalances();
    const snapshot = await storedBalance(cashId);
    await AccountingService.recalculateAllBalances();
    expect((await storedBalance(cashId)).equals(snapshot)).toBe(true);
    await expectNoDrift('after repeated rebuild');
  }, 60000);

  it('POST /accounting-health?action=rebuild-balances repairs injected drift', async () => {
    const request = (await import('supertest')).default;
    const jwt = (await import('jsonwebtoken')).default;
    const app = (await import('../../api/index.js')).default;

    const admin = await prisma.user.findFirst({
      where: { role: { name: 'Super Admin' } },
    });
    if (!admin) throw new Error('No Super Admin to authenticate the rebuild endpoint');
    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: 'Super Admin' },
      process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc'
    );

    // Corrupt the cache deliberately, exactly as the old delete paths did.
    await prisma.account.update({
      where: { id: cashId },
      data: { currentBalance: new Prisma.Decimal(-999999) },
    });
    expect((await storedBalance(cashId)).equals(await ledgerBalance(cashId))).toBe(false);

    const res = await request(app)
      .post('/api/v1/accounting-health?action=rebuild-balances')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body?.data?.accountsUpdated).toBeGreaterThan(0);
    await expectNoDrift('after rebuild endpoint');
  }, 120000);

  it('integrity checker reports no cached_balance_drift for the accounts under test', async () => {
    const { AccountingIntegrityService } = await import('../../api/_services/accounting-integrity.service.js');
    await AccountingService.recalculateAllBalances();
    const result = await AccountingIntegrityService.runFullCheck();

    // Scoped to this suite's own accounts on purpose. The other test files run
    // concurrently against the same database and are constantly posting and
    // deleting entries, so a *global* drift assertion here would report their
    // in-flight work rather than a defect. Persistent, whole-ledger consistency
    // is what `npm run db:verify`-style rebuilds cover.
    const ours = new Set([cashId, revenueId, expenseId]);
    const drift = result.issues
      .filter((i: any) => i.type === 'cached_balance_drift' && ours.has(i.item?.id));

    expect(drift.map((d: any) => d.description)).toEqual([]);
  }, 120000);
});
