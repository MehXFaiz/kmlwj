// SQA fix: multiple money-entry endpoints validated amounts with a bare
// `amount <= 0` (or `Number(amount) <= 0`) check. In JavaScript, a non-numeric
// value coerces to NaN, and any comparison against NaN is false — so
// `"abc" <= 0` is false, silently passing validation. The NaN then flows into
// ledger posting, either corrupting the entry or throwing an unhandled Prisma
// type error. There was also no upper bound anywhere, letting an absurd value
// (e.g. 999999999999999.99) get posted and corrupt dashboard/report totals.
// This single helper is now shared by every money-entry endpoint so the fix
// (and any future adjustment to the cap) lives in exactly one place.

export const MAX_TRANSACTION_AMOUNT = 100_000_000; // PKR 100 million per transaction

export type AmountValidationResult =
  | { valid: true; amount: number }
  | { valid: false; message: string };

export function validateAmount(raw: unknown): AmountValidationResult {
  const amount = typeof raw === 'number' ? raw : parseFloat(String(raw));

  if (raw === undefined || raw === null || raw === '' || isNaN(amount)) {
    return { valid: false, message: 'Amount must be a valid number' };
  }
  if (amount <= 0) {
    return { valid: false, message: 'Amount must be greater than 0' };
  }
  if (amount > MAX_TRANSACTION_AMOUNT) {
    return { valid: false, message: `Amount cannot exceed ${MAX_TRANSACTION_AMOUNT.toLocaleString('en-US')}` };
  }
  // Normalize to 2 decimal places to avoid floating-point noise (e.g. 12.1 + 0.2).
  return { valid: true, amount: Math.round(amount * 100) / 100 };
}
