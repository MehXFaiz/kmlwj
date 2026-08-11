// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../api/_prisma.js';
import { AccountingService, POSTED_JOURNAL_FILTER } from '../../api/_services/accounting.service.js';
import { FundValidationService } from '../../api/_services/fund-validation.service.js';
import { serializeMoney, isSaneMoney } from '../../api/_utils/money.js';
import { calculateAccountBalances, validateSufficientFunds } from '../../src/store/journalStore.js';
import { subMoney } from '../../src/utils/money.js';

/**
 * READ-ONLY reconciliation for Cash in Hand (GL 1010103).
 *
 * Requirement: the SAME accounting balance must be produced by the dashboard,
 * the trial balance, the general ledger, the server's fund validation and the
 * transaction form's client-side check. Before the fix the first four agreed on
 * 7,444,213.00 while the form computed -4.86e266, because money reached the
 * browser as JSON strings and `+=` concatenated instead of adding.
 *
 * This suite posts nothing and edits no accounting data. It is not, however,
 * side-effect free: `getFinancialSummary()` is the dashboard's own code path
 * and begins by rebuilding the Account.currentBalance cache from the posted
 * ledger (a set-based UPDATE over every GL/SUBSIDIARY account). That rebuild is
 * idempotent and derives every value from the journal lines, so it cannot alter
 * an accounting result — but it does write, which is why these DB-backed files
 * must not run concurrently against the shared database.
 */

const GL_CODE = '1010103';

describe('Cash in Hand (GL 1010103) — cross-screen reconciliation', () => {
  let accountId: string;
  let ledgerClosing: number;

  beforeAll(async () => {
    const account = await prisma.account.findFirst({ where: { glCode: GL_CODE } });
    if (!account) throw new Error(`Account ${GL_CODE} not found`);
    accountId = account.id;

    const agg = await prisma.journalEntryLine.aggregate({
      where: { accountId, journalEntry: POSTED_JOURNAL_FILTER },
      _sum: { debit: true, credit: true },
    });
    // ASSET is debit-normal: closing = opening + debits - credits
    ledgerClosing = new Prisma.Decimal(account.initialBalance ?? 0)
      .plus(new Prisma.Decimal(agg._sum.debit ?? 0))
      .minus(new Prisma.Decimal(agg._sum.credit ?? 0))
      .toNumber();
  }, 60_000);

  it('the ledger closing balance is a sane, representable number', () => {
    expect(isSaneMoney(ledgerClosing)).toBe(true);
    expect(ledgerClosing).toBeGreaterThanOrEqual(0);
  });

  it('the cached Account.currentBalance matches the posted ledger', async () => {
    const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    expect(new Prisma.Decimal(account.currentBalance).toNumber()).toBe(ledgerClosing);
  }, 60_000);

  it('server fund validation reports the ledger balance', async () => {
    const { availableBalance } = await FundValidationService.getAvailableBalance(prisma, accountId);
    expect(availableBalance).toBe(ledgerClosing);
  }, 60_000);

  it('Trial Balance and General Ledger agree with the ledger for GL 1010103', async () => {
    const [tb, gl] = await Promise.all([
      AccountingService.getTrialBalance(),
      AccountingService.getGeneralLedger({ glCode: GL_CODE }),
    ]);

    const tbAccount = tb.accounts.find((a: any) => a.glCode === GL_CODE);
    const tbBalance = Number(tbAccount?.debit ?? 0) - Number(tbAccount?.credit ?? 0);

    expect(tbBalance, 'Trial Balance Cash in Hand').toBe(ledgerClosing);
    expect(gl.summary.closingBalance, 'General Ledger Cash in Hand').toBe(ledgerClosing);
    expect(gl.summary.openingBalance + gl.summary.totalDebit - gl.summary.totalCredit).toBe(ledgerClosing);
  }, 120_000);

  it('Dashboard and Trial Balance agree on the CASH CATEGORY total', async () => {
    // The dashboard card and the trial balance's cashInHand category are
    // deliberately broader than one account: they total every cash account
    // (Cash in Hand + Petty Cash). They must agree with each other and with the
    // ledger — but not with a single account, which is what the transaction
    // form validates against. Asserting the sum keeps the two scopes distinct
    // instead of silently conflating them.
    const [summary, tb] = await Promise.all([
      AccountingService.getFinancialSummary(),
      AccountingService.getTrialBalance(),
    ]);

    const categoryAccounts = tb.closingBalances.cashInHand.accounts;
    const sumOfAccounts = categoryAccounts.reduce(
      (total: Prisma.Decimal, a: any) => total.plus(new Prisma.Decimal(a.balance)),
      new Prisma.Decimal(0),
    ).toNumber();

    expect(tb.closingBalances.cashInHand.total, 'TB cash category total').toBe(sumOfAccounts);
    expect(summary.cashBalance, 'Dashboard cash total').toBe(sumOfAccounts);

    // …and the category genuinely contains this account at its ledger balance.
    const cashInHand = categoryAccounts.find((a: any) => a.glCode === GL_CODE);
    expect(cashInHand?.balance, 'GL 1010103 inside the cash category').toBe(ledgerClosing);
  }, 120_000);

  it('every money field leaves the API as a JSON number, not a string', async () => {
    const accounts = await prisma.account.findMany({ take: 25, include: { accountType: true } });
    const entries = await prisma.journalEntry.findMany({ take: 25, include: { lines: true } });

    const wire = JSON.parse(JSON.stringify(serializeMoney({ accounts, entries })));

    for (const a of wire.accounts) {
      expect(typeof a.initialBalance, `initialBalance of ${a.glCode}`).toBe('number');
      expect(typeof a.currentBalance, `currentBalance of ${a.glCode}`).toBe('number');
    }
    for (const e of wire.entries) {
      for (const l of e.lines) {
        expect(typeof l.debit, `debit of ${e.voucherNo}`).toBe('number');
        expect(typeof l.credit, `credit of ${e.voucherNo}`).toBe('number');
      }
    }
  }, 120_000);

  describe('transaction form (client-side) against the real ledger', () => {
    let accounts: any[];
    let journals: any[];
    let cashAccount: any;

    beforeAll(async () => {
      // Exactly the payloads api/_v1/accounts.ts and api/_v1/journal-entries.ts
      // return, pushed through the real serialization boundary.
      const dbAccounts = await prisma.account.findMany({ include: { accountType: true, parent: true } });
      const dbEntries = await prisma.journalEntry.findMany({
        where: { isDeleted: false },
        include: { lines: { include: { account: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });

      accounts = JSON.parse(JSON.stringify(serializeMoney(dbAccounts.map((acc) => ({
        id: acc.id,
        code: acc.glCode,
        name: acc.accountName,
        type: acc.accountType ? acc.accountType.name.charAt(0) + acc.accountType.name.slice(1).toLowerCase() : 'Asset',
        detailType: acc.detailType,
        parentCode: acc.parent ? acc.parent.glCode : null,
        subsidiary: acc.subsidiary,
        initialBalance: acc.initialBalance,
      })))));

      journals = JSON.parse(JSON.stringify(serializeMoney(dbEntries.map((je) => ({
        id: je.voucherNo,
        subsidiary: je.subsidiary,
        status: je.status,
        lines: je.lines.map((l) => ({ accountCode: l.account.glCode, debit: l.debit, credit: l.credit })),
      })))));

      cashAccount = accounts.find((a) => a.code === GL_CODE);
    }, 120_000);

    it('computes the same Available Cash as every server-side report', () => {
      const { localBalances, invalidCodes } = calculateAccountBalances(accounts, journals, 'Global');
      expect(invalidCodes).not.toContain(GL_CODE);
      expect(localBalances[GL_CODE]).toBe(ledgerClosing);
    });

    it('ALLOWS Rs 1,000 and leaves the correct remaining balance', () => {
      const res = validateSufficientFunds({ accounts, journals, account: cashAccount, amount: 1000 });
      expect(res.ok).toBe(true);
      expect(res.available).toBe(ledgerClosing);
      expect(subMoney(res.available, 1000)).toBe(ledgerClosing - 1000);
    });

    it('BLOCKS available + 1 with a Rs 1 shortfall', () => {
      const res = validateSufficientFunds({ accounts, journals, account: cashAccount, amount: ledgerClosing + 1 });
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Insufficient Cash Balance');
      expect(res.message).toContain('Shortfall: Rs 1');
    });

    it('handles every magnitude and decimal amounts exactly', () => {
      for (const amount of [1, 10, 100, 1000, 10000, 100000, 1000000, 1000.5]) {
        const res = validateSufficientFunds({ accounts, journals, account: cashAccount, amount });
        expect(res.ok, `Rs ${amount}`).toBe(true);
        expect(subMoney(res.available, amount)).toBe(Number((ledgerClosing - amount).toFixed(2)));
      }
    });

    it('never reports a negative Available Cash while the ledger is positive', () => {
      const res = validateSufficientFunds({ accounts, journals, account: cashAccount, amount: 999_999_999 });
      expect(res.available).toBe(ledgerClosing);
      expect(res.message).not.toContain('-');
    });

    it('validation is read-only — the ledger balance is unchanged afterwards', async () => {
      const after = await FundValidationService.getAvailableBalance(prisma, accountId);
      expect(after.availableBalance).toBe(ledgerClosing);
    }, 60_000);
  });

  it('no account anywhere in the chart produces an uncomputable balance', async () => {
    const dbAccounts = await prisma.account.findMany({ include: { accountType: true, parent: true } });
    const dbEntries = await prisma.journalEntry.findMany({
      where: { isDeleted: false },
      include: { lines: { include: { account: true } } },
      take: 1000,
    });

    const accounts = JSON.parse(JSON.stringify(serializeMoney(dbAccounts.map((acc) => ({
      code: acc.glCode,
      type: acc.accountType ? acc.accountType.name.charAt(0) + acc.accountType.name.slice(1).toLowerCase() : 'Asset',
      parentCode: acc.parent ? acc.parent.glCode : null,
      subsidiary: acc.subsidiary,
      initialBalance: acc.initialBalance,
    })))));
    const journals = JSON.parse(JSON.stringify(serializeMoney(dbEntries.map((je) => ({
      subsidiary: je.subsidiary,
      status: je.status,
      lines: je.lines.map((l) => ({ accountCode: l.account.glCode, debit: l.debit, credit: l.credit })),
    })))));

    const { localBalances, invalidCodes } = calculateAccountBalances(accounts, journals, 'Global');
    expect(invalidCodes).toEqual([]);
    for (const [code, balance] of Object.entries(localBalances)) {
      expect(isSaneMoney(balance), `${code} balance ${balance}`).toBe(true);
    }
  }, 120_000);
});
