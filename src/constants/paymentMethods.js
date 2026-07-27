// Single source of truth for Payment Method codes and their display labels.
// Every receipt, voucher, slip, print view and PDF export must render the payment
// method through paymentMethodLabel() so the printed value always matches the
// exact method saved on the transaction record — never a hardcoded guess.
//
// Canonical mapping (per business rules):
//   CASH   → "Cash"
//   BANK   → "Bank Transfer"
//   CHEQUE → "Cheque"
//   ONLINE → "Online Transfer"
export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ONLINE', label: 'Online Transfer' },
];

const PAYMENT_METHOD_LABELS = PAYMENT_METHODS.reduce((acc, m) => {
  acc[m.value] = m.label;
  return acc;
}, {});

/**
 * Maps a stored payment-method code to its human-readable label.
 * Returns '—' when the value is missing so a receipt NEVER falls back to an
 * incorrect default like "Bank Transfer". If an unknown/legacy value is stored,
 * it is displayed verbatim (already-labelled values pass through unchanged).
 */
export function paymentMethodLabel(method) {
  if (method === null || method === undefined || method === '') return '—';
  const code = String(method).trim().toUpperCase();
  if (PAYMENT_METHOD_LABELS[code]) return PAYMENT_METHOD_LABELS[code];
  // Value is already a friendly label (e.g. "Bank Transfer") — pass through.
  return String(method);
}
