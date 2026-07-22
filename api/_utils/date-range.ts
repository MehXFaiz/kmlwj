// SQA fix: transaction dates (donation/revenue event dates, receipt dates)
// previously had no range validation anywhere — a date decades in the past
// or years in the future would be accepted and posted to the ledger
// unchecked. Shared by every endpoint that accepts a user-supplied
// transaction date.

const MIN_TRANSACTION_DATE = new Date('1980-01-01'); // earliest plausible record date

export function isValidTransactionDate(d: Date): boolean {
  if (isNaN(d.getTime())) return false;
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  return d >= MIN_TRANSACTION_DATE && d <= oneYearFromNow;
}
