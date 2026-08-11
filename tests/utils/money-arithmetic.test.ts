import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  toPaisa,
  toMoney,
  addMoney,
  subMoney,
  sumMoney,
  isSaneMoney,
  formatMoney,
  BALANCE_ERROR_MESSAGE,
} from '../../src/utils/money.js';
import { calculateAccountBalances, validateSufficientFunds } from '../../src/store/journalStore.js';
import { serializeMoney } from '../../api/_utils/money.js';
import { makeHandler } from '../../api/_utils/handler.js';

/**
 * Regression suite for the corrupted "Available Cash" balance.
 *
 * The bug: money columns are Decimal(18,2); Decimal.toJSON() emits a STRING, so
 * `debits += line.debit` concatenated instead of adding and the transaction form
 * reported "Available Cash: Rs -486,000,366,500,017,900,000,000" for GL 1010103,
 * whose true ledger balance is Rs 7,444,213.
 */

/** Builds a Posted journal entry in the shape api/_v1/journal-entries.ts returns. */
const entry = (lines: Array<{ code: string; debit?: any; credit?: any }>, status = 'Posted') => ({
  id: `JV-${Math.random()}`,
  subsidiary: 'Global',
  status,
  lines: lines.map((l) => ({ accountCode: l.code, debit: l.debit ?? 0, credit: l.credit ?? 0 })),
});

const CASH = { code: '1010103', name: 'Cash in Hand', type: 'Asset', detailType: 'Cash', initialBalance: 0, subsidiary: ['Global'] };

describe('wire format — money must leave the API as JSON numbers', () => {
  it('Prisma Decimal serializes to a string without the fix (the root cause)', () => {
    expect(JSON.parse(JSON.stringify({ debit: new Prisma.Decimal('1000') })).debit).toBe('1000');
  });

  it('serializeMoney converts every nested Decimal to a number', () => {
    const payload = serializeMoney({
      data: [{ initialBalance: new Prisma.Decimal('7444213.00'), lines: [{ debit: new Prisma.Decimal('1000.50'), credit: new Prisma.Decimal(0) }] }],
    });
    const round = JSON.parse(JSON.stringify(payload));
    expect(typeof round.data[0].initialBalance).toBe('number');
    expect(round.data[0].initialBalance).toBe(7444213);
    expect(round.data[0].lines[0].debit).toBe(1000.5);
  });

  it('makeHandler emits numbers for a route that passes Decimals straight through', async () => {
    // api/_v1/journal-entries.ts and api/_v1/accounts.ts hand Prisma Decimals
    // directly to res.json. The wrapper must normalise them, so no route has to
    // remember to call .toNumber().
    const captured: any[] = [];
    const res: any = {
      setHeader: () => {},
      status: () => res,
      end: () => {},
      json: (body: any) => { captured.push(body); return res; },
    };

    const handler = makeHandler(async (_req: any, r: any) =>
      r.status(200).json({
        data: [{
          initialBalance: new Prisma.Decimal('7444213.00'),
          lines: [{ debit: new Prisma.Decimal('1000'), credit: new Prisma.Decimal('0') }],
        }],
      }),
    );

    await handler({ method: 'GET', url: '/api/v1/journal-entries' } as any, res);

    const body = captured[0];
    expect(typeof body.data[0].initialBalance).toBe('number');
    expect(body.data[0].initialBalance).toBe(7444213);
    expect(typeof body.data[0].lines[0].debit).toBe('number');

    // And the values survive JSON transport as numbers, not strings.
    expect(typeof JSON.parse(JSON.stringify(body)).data[0].lines[0].debit).toBe('number');
  });

  it('leaves Dates and non-money values untouched', () => {
    const when = new Date('2026-01-31T00:00:00.000Z');
    const out = serializeMoney({ postingDate: when, voucherNo: 'BP-260131-123456', status: 'Posted', ref: null });
    expect(out.postingDate).toBeInstanceOf(Date);
    expect(out.voucherNo).toBe('BP-260131-123456');
    expect(out.ref).toBeNull();
  });
});

describe('exact monetary arithmetic (no floating point)', () => {
  it('parses to exact paisa without float multiplication', () => {
    expect(toPaisa('1000.50')).toBe(100050);
    expect(toPaisa(1000.5)).toBe(100050);
    expect(toPaisa('0.10')).toBe(10);
  });

  it('keeps 1000.50 exactly 1000.50 — never 100050 or 1000.499999', () => {
    expect(toMoney('1000.50')).toBe(1000.5);
    expect(formatMoney('1000.50')).toBe('1,000.50');
  });

  it('does not drift over repeated addition (0.1 + 0.2 === 0.3)', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(sumMoney(Array(10).fill('0.10'))).toBe(1);
  });

  it('adds string amounts instead of concatenating them', () => {
    // The exact failure mode: "1000" + "2000" === "10002000", not 3000.
    expect(('1000' as any) + ('2000' as any)).toBe('10002000');
    expect(addMoney('1000', '2000')).toBe(3000);
    expect(sumMoney(['1000', '1250', '25000'])).toBe(27250);
  });

  it('rejects display-formatted strings rather than misreading them', () => {
    // parseFloat('Rs 1,000.00') would silently yield 1 — a wrong balance.
    expect(isSaneMoney(toMoney('Rs 1,000.00'))).toBe(false);
    expect(isSaneMoney(toMoney('1,000'))).toBe(false);
    expect(formatMoney('Rs 1,000.00')).toBe('—');
  });

  it('flags NaN, Infinity, null and overflow as insane', () => {
    for (const bad of [NaN, Infinity, -Infinity, 1e300]) expect(isSaneMoney(bad)).toBe(false);
    for (const bad of [null, undefined, '', 'abc']) expect(isSaneMoney(toMoney(bad))).toBe(false);
  });

  it('propagates a bad input instead of silently treating it as zero', () => {
    expect(isSaneMoney(sumMoney(['1000', 'oops', '2000']))).toBe(false);
    expect(isSaneMoney(subMoney('1000', 'oops'))).toBe(false);
  });
});

describe('calculateAccountBalances — Cash in Hand (GL 1010103)', () => {
  // Real ledger totals from the database: debit 21,694,380 / credit 14,250,167.
  const ledger = [
    entry([{ code: '1010103', debit: 21694380 }]),
    entry([{ code: '1010103', credit: 14250167 }]),
  ];

  it('computes closing = opening + debits - credits for a debit-normal asset', () => {
    const { localBalances } = calculateAccountBalances([CASH], ledger, 'Global');
    expect(localBalances['1010103']).toBe(7444213);
  });

  it('produces the SAME balance whether the wire sends numbers or strings', () => {
    const asStrings = [
      entry([{ code: '1010103', debit: '21694380' }]),
      entry([{ code: '1010103', credit: '14250167' }]),
    ];
    const fromNumbers = calculateAccountBalances([CASH], ledger, 'Global').localBalances['1010103'];
    const fromStrings = calculateAccountBalances([CASH], asStrings, 'Global').localBalances['1010103'];
    expect(fromStrings).toBe(fromNumbers);
    expect(fromStrings).toBe(7444213);
  });

  it('never yields the concatenation artefact for many string-valued lines', () => {
    const many = [
      entry([{ code: '1010103', debit: '1000' }]),
      entry([{ code: '1010103', debit: '1250' }]),
      entry([{ code: '1010103', credit: '486000' }]),
      entry([{ code: '1010103', credit: '366500' }]),
    ];
    const balance = calculateAccountBalances([CASH], many, 'Global').localBalances['1010103'];
    expect(balance).toBe(1000 + 1250 - 486000 - 366500);
    expect(Math.abs(balance)).toBeLessThan(1e9);
  });

  it('counts only Posted entries — Draft and Cancelled contribute nothing', () => {
    const mixed = [
      entry([{ code: '1010103', debit: '1000' }]),
      entry([{ code: '1010103', debit: '500' }], 'Draft'),
      entry([{ code: '1010103', debit: '900' }], 'Cancelled'),
    ];
    expect(calculateAccountBalances([CASH], mixed, 'Global').localBalances['1010103']).toBe(1000);
  });

  it('applies credit-normal rules to Revenue/Liability/Equity accounts', () => {
    const revenue = { code: '3020408', name: 'General Donation', type: 'Revenue', initialBalance: 0, subsidiary: ['Global'] };
    const je = [entry([{ code: '1010103', debit: '5000' }, { code: '3020408', credit: '5000' }])];
    const { localBalances } = calculateAccountBalances([CASH, revenue], je, 'Global');
    expect(localBalances['3020408']).toBe(5000);
    expect(localBalances['1010103']).toBe(5000);
  });

  it('keeps total Cash + Bank unchanged across a cash→bank transfer', () => {
    const bank = { code: '1010101', name: 'Bank Al-Habib', type: 'Asset', detailType: 'Bank', initialBalance: 0, subsidiary: ['Global'] };
    const seed = entry([{ code: '1010103', debit: '100000' }]);
    const transfer = entry([{ code: '1010101', debit: '40000' }, { code: '1010103', credit: '40000' }]);
    const { localBalances } = calculateAccountBalances([CASH, bank], [seed, transfer], 'Global');
    expect(localBalances['1010103']).toBe(60000);
    expect(localBalances['1010101']).toBe(40000);
    expect(addMoney(localBalances['1010103'], localBalances['1010101'])).toBe(100000);
  });

  it('reports a malformed amount instead of inventing a balance', () => {
    const corrupt = [entry([{ code: '1010103', debit: 'Rs 1,000' }])];
    const { localBalances, invalidCodes } = calculateAccountBalances([CASH], corrupt, 'Global');
    expect(invalidCodes).toContain('1010103');
    expect(isSaneMoney(localBalances['1010103'])).toBe(false);
  });

  it('rolls a parent up from its children exactly once', () => {
    const parent = { code: '1010100', name: 'Cash & Bank Balances', type: 'Asset', initialBalance: 0, subsidiary: ['Global'] };
    const child = { ...CASH, parentCode: '1010100' };
    const je = [entry([{ code: '1010103', debit: '7444213' }])];
    const { rollupBalances } = calculateAccountBalances([parent, child], je, 'Global');
    expect(rollupBalances['1010100']).toBe(7444213);
  });
});

describe('validateSufficientFunds — the reported scenario', () => {
  const ledger = [
    entry([{ code: '1010103', debit: '21694380' }]),
    entry([{ code: '1010103', credit: '14250167' }]),
  ];
  const check = (amount: any) =>
    validateSufficientFunds({ accounts: [CASH], journals: ledger, account: CASH, amount });

  it('ALLOWS Rs 1,000 against Rs 7,444,213 available', () => {
    const res = check(1000);
    expect(res.ok).toBe(true);
    expect(res.available).toBe(7444213);
    expect(subMoney(res.available, 1000)).toBe(7443213);
  });

  it('BLOCKS Rs 7,444,214 with a Rs 1 shortfall', () => {
    const res = check(7444214);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('Insufficient Cash Balance');
    expect(res.message).toContain('Available Cash: Rs 7,444,213');
    expect(res.message).toContain('Required Amount: Rs 7,444,214');
    expect(res.message).toContain('Shortfall: Rs 1');
  });

  it('ALLOWS the exact available balance (boundary)', () => {
    expect(check(7444213).ok).toBe(true);
  });

  it('allows every magnitude up to the available balance', () => {
    for (const amount of [1, 10, 100, 1000, 10000, 100000, 1000000]) {
      const res = check(amount);
      expect(res.ok, `Rs ${amount} should be allowed`).toBe(true);
      expect(subMoney(res.available, amount)).toBe(7444213 - amount);
    }
  });

  it('handles decimal amounts exactly', () => {
    const res = check('1000.50');
    expect(res.ok).toBe(true);
    expect(subMoney(res.available, '1000.50')).toBe(7443212.5);
  });

  it('never reports a negative Available Cash for a positive ledger balance', () => {
    const res = check(999999999);
    expect(res.ok).toBe(false);
    expect(res.available).toBe(7444213);
    expect(res.message).not.toContain('-');
  });

  it('returns the safe accounting error when the balance cannot be computed', () => {
    const res = validateSufficientFunds({
      accounts: [CASH],
      journals: [entry([{ code: '1010103', debit: 'Rs 1,000' }])],
      account: CASH,
      amount: 1000,
    });
    expect(res.ok).toBe(false);
    expect(res.message).toBe(BALANCE_ERROR_MESSAGE);
    expect(res.message).not.toMatch(/\d{7}/);
  });

  it('is read-only — it does not mutate the accounts or journals it is given', () => {
    const accounts = [{ ...CASH }];
    const journals = JSON.parse(JSON.stringify(ledger));
    const before = JSON.stringify({ accounts, journals });
    validateSufficientFunds({ accounts, journals, account: accounts[0], amount: 1000 });
    validateSufficientFunds({ accounts, journals, account: accounts[0], amount: 1000 });
    expect(JSON.stringify({ accounts, journals })).toBe(before);
  });

  it('does not pre-subtract the amount — repeated calls give the same balance', () => {
    expect(check(1000).available).toBe(7444213);
    expect(check(1000).available).toBe(7444213);
    expect(check(1000).available).toBe(7444213);
  });
});
