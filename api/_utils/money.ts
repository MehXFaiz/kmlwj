import { Prisma } from '@prisma/client';
import { logger } from './logger.js';

/**
 * SQA fix — corrupted balances caused by money crossing the API as STRINGS.
 *
 * Every money column in the schema is `Decimal(18,2)`, so Prisma hands back a
 * `Prisma.Decimal` instance. `JSON.stringify` honours `Decimal.prototype
 * .toJSON()`, which emits a *string* — so `res.json({ debit: line.debit })`
 * put `"1000"` on the wire, not `1000`.
 *
 * Any consumer that then accumulated those values with `+` got string
 * concatenation instead of addition:
 *
 *     0 + "1000" + "1250"  ===  "010001250"          (not 2250)
 *
 * and the eventual `initial + debits - credits` produced an astronomically
 * wrong number (observed: -4.86e266 for GL 1010103 Cash in Hand, whose real
 * ledger balance is 7,444,213.00).
 *
 * The fix is applied at the ONE place every response passes through
 * (`makeHandler` → `serializeMoney`), so money is a JSON *number* on every
 * endpoint — existing and future — rather than each route remembering to call
 * `.toNumber()`. Server-side arithmetic still runs on `Prisma.Decimal`
 * throughout; this only governs the wire format at the final boundary.
 */

/**
 * Ceiling for a legitimate monetary value. `Decimal(18,2)` permits values up to
 * ~1e16, which is past `Number.MAX_SAFE_INTEGER` (9.007e15) and therefore not
 * representable exactly as a JS number. Nothing in this ERP legitimately
 * approaches it — a single transaction is capped at 100 million by
 * `validateAmount` — so anything beyond this is malformed data, not a real
 * balance, and is reported rather than silently rounded.
 */
export const MAX_SAFE_MONEY = 1_000_000_000_000_000; // 1e15

/** True only for a finite JS number inside the representable money range. */
export function isSaneMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_SAFE_MONEY;
}

/**
 * Converts a Decimal to a JS number for transport, flagging (never hiding) any
 * value that cannot be represented exactly. The value is still returned so a
 * single bad row cannot take down an entire response; callers that must not
 * proceed on bad data use `isSaneMoney` on the result.
 */
export function decimalToNumber(value: Prisma.Decimal): number {
  const n = value.toNumber();
  if (!isSaneMoney(n)) {
    logger.error({ raw: value.toString(), asNumber: n }, 'Money value outside representable range — possible data corruption');
  }
  return n;
}

/**
 * Coerces any wire/DB representation of money to an exact `Prisma.Decimal`.
 *
 * Parsing is deliberately STRICT: a display-formatted string such as
 * `"Rs 1,000.00"` is rejected rather than silently read by `parseFloat` as
 * `1`. Accounting arithmetic must never run on formatted strings, so a
 * formatted value reaching this function is a bug that has to surface.
 */
export function toDecimal(value: unknown): Prisma.Decimal {
  if (value === null || value === undefined || value === '') return new Prisma.Decimal(0);
  if (Prisma.Decimal.isDecimal(value)) return value as Prisma.Decimal;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Invalid monetary value: ${value}`);
    return new Prisma.Decimal(value);
  }
  const s = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Invalid monetary value: '${s}'. Amounts must be unformatted numeric values.`);
  }
  return new Prisma.Decimal(s);
}

/**
 * Deep-converts every `Prisma.Decimal` in a response payload to a JS number so
 * `JSON.stringify` emits numbers instead of strings.
 *
 * Non-plain objects (`Date`, `Buffer`, class instances) are passed through
 * untouched so their own serialization is preserved, and a `WeakSet` guards
 * against cycles.
 */
export function serializeMoney<T>(payload: T): T {
  return walk(payload, new WeakSet()) as T;
}

function walk(value: any, seen: WeakSet<object>): any {
  if (value === null || typeof value !== 'object') return value;

  if (Prisma.Decimal.isDecimal(value)) return decimalToNumber(value as Prisma.Decimal);
  if (value instanceof Date || Buffer.isBuffer(value)) return value;

  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => walk(item, seen));

  // Only plain objects (Prisma model results, response literals) are rewritten.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;

  const out: Record<string, any> = {};
  for (const key of Object.keys(value)) out[key] = walk(value[key], seen);
  return out;
}
