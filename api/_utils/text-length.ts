// SQA fix: free-text fields (remarks, bank name, cheque number, descriptions,
// etc.) had no max-length validation anywhere — only the global 500kb JSON
// body-size cap (api/index.ts) bounded them, so a single unconstrained
// String? column could store a very large value well under that cap with no
// complaint, bloating the database. This is a lightweight, shared check
// rather than a schema-level @db.VarChar(n) change, since altering column
// types on live data is its own migration outside this pass's scope.

export function isWithinMaxLength(value: unknown, max: number): boolean {
  if (value === undefined || value === null || value === '') return true;
  return String(value).length <= max;
}

export function maxLengthError(field: string, max: number) {
  return { message: `${field} cannot exceed ${max} characters`, status: 400 };
}
