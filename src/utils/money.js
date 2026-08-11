/**
 * Exact monetary arithmetic for the client.
 *
 * Two rules, both of which were being broken and produced the corrupted
 * "Available Cash" balance on the transaction forms:
 *
 *  1. NEVER add values straight off the wire. Money columns are Decimal(18,2);
 *     before the fix in api/_utils/money.ts they arrived as JSON strings, so
 *     `0 + "1000" + "1250"` produced the string "010001250" instead of 2250,
 *     and `initial + debits - credits` then produced -4.86e266 for an account
 *     whose real ledger balance is 7,444,213.00.
 *
 *  2. NEVER accumulate money in floating point. `0.1 + 0.2 !== 0.3`, so a long
 *     run of additions drifts. Everything here works in integer PAISA (minor
 *     units) and converts back to rupees only at the end, which keeps
 *     1000.50 exactly 1000.50 rather than 1000.499999999.
 *
 * The API now sends numbers, so the coercion below is defence in depth: if a
 * malformed value ever reaches the client it yields NaN and is caught by
 * `isSaneMoney` — it is never silently turned into a plausible-looking wrong
 * number, and never rendered as a giant corrupted figure.
 */

/**
 * Ceiling for a legitimate monetary value — mirrors MAX_SAFE_MONEY in
 * api/_utils/money.ts. Beyond this a value is malformed data, not a balance.
 */
export const MAX_SAFE_MONEY = 1_000_000_000_000_000; // 1e15

/** True only for a finite number inside the representable money range. */
export const isSaneMoney = (value) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_SAFE_MONEY;

/** The single user-facing message for a balance that cannot be computed. */
export const BALANCE_ERROR_MESSAGE =
  'Unable to calculate account balance. Please verify the account ledger.';

/**
 * Parses any wire representation of money into integer paisa.
 *
 * Parsing is STRICT on purpose: a display string such as "Rs 1,000.00" is
 * rejected (NaN) rather than read by parseFloat as 1. Accounting math must
 * never run on formatted strings, so such a value has to surface as an error
 * instead of quietly becoming a wrong balance.
 *
 * @returns integer paisa, or NaN when the input is not a valid amount.
 */
export const toPaisa = (value) => {
  if (value === null || value === undefined || value === '') return NaN;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return NaN;
    const paisa = Math.round(value * 100);
    return Number.isSafeInteger(paisa) ? paisa : NaN;
  }

  // Decimal-like objects (defensive — should not reach the client any more).
  const raw = typeof value === 'object' && typeof value.toFixed === 'function'
    ? value.toFixed(2)
    : String(value).trim();

  if (!/^-?\d+(\.\d+)?$/.test(raw)) return NaN;

  // Split rather than multiply, so no float ever touches the value.
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = (negative ? raw.slice(1) : raw).split('.');
  let paisa = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (fraction.length > 2 && Number(fraction[2]) >= 5) paisa += 1; // round half-up
  if (!Number.isSafeInteger(paisa)) return NaN;

  return negative ? -paisa : paisa;
};

/** Converts integer paisa back to rupees, exact to 2 decimal places. */
export const fromPaisa = (paisa) =>
  Number.isSafeInteger(paisa) ? paisa / 100 : NaN;

/**
 * Coerces a single wire value to an exact rupee number.
 * Returns NaN for anything unparseable — check with `isSaneMoney`.
 */
export const toMoney = (value) => fromPaisa(toPaisa(value));

/**
 * Coerces a value to a rupee number, falling back to 0 when it is not a valid
 * amount. Use ONLY where a missing value legitimately means zero (e.g. an
 * absent optional field) — never to paper over a balance that failed to
 * compute, which must be reported via `isSaneMoney` instead.
 */
export const toMoneyOr0 = (value) => {
  const n = toMoney(value);
  return isSaneMoney(n) ? n : 0;
};

/** Exact addition. NaN propagates so a bad input can never be lost. */
export const addMoney = (a, b) => fromPaisa(toPaisa(a) + toPaisa(b));

/** Exact subtraction. NaN propagates so a bad input can never be lost. */
export const subMoney = (a, b) => fromPaisa(toPaisa(a) - toPaisa(b));

/**
 * Exact sum over a list, accumulating in paisa.
 * @param items list to total
 * @param pick  optional accessor returning the money value for an item
 */
export const sumMoney = (items, pick = (item) => item) => {
  let paisa = 0;
  for (const item of items ?? []) {
    const value = toPaisa(pick(item));
    if (!Number.isFinite(value)) return NaN;
    paisa += value;
    if (!Number.isSafeInteger(paisa)) return NaN;
  }
  return fromPaisa(paisa);
};

/**
 * Formats money for DISPLAY ONLY — the final stage, never an input to further
 * arithmetic. Returns a marker for values that failed to compute so a corrupted
 * figure is never shown as if it were a real balance.
 */
export const formatMoney = (value, { decimals } = {}) => {
  const n = toMoney(value);
  if (!isSaneMoney(n)) return '—';
  const fractionDigits = decimals ?? (Number.isInteger(n) ? 0 : 2);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  });
};
