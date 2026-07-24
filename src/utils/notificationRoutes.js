// Maps a notification's `module` (and optional recordId) to the client route
// that should open when the user clicks it in the bell dropdown or the
// full Notifications page. Keep in sync with src/App.jsx.
//
// The mapping is intentionally lenient: modules are matched case-insensitively
// and unknown modules fall through to `/notifications`, which never breaks.

const MODULE_MAP = {
  donations: { base: '/donations', edit: (id) => `/donations/edit/${id}` },
  'donations given': { base: '/donations', edit: (id) => `/donations/edit/${id}` },
  disbursements: { base: '/donations', edit: (id) => `/donations/edit/${id}` },
  aid: { base: '/donations', edit: (id) => `/donations/edit/${id}` },

  'donations received': { base: '/donations-received' },
  'donation received': { base: '/donations-received' },
  income: { base: '/income' },
  revenue: { base: '/income' },
  'revenue collection': { base: '/income' },
  'revenue collections': { base: '/income' },

  expenses: { base: '/expenses' },
  expense: { base: '/expenses' },

  members: { base: '/members', edit: (id) => `/members/${id}` },
  member: { base: '/members', edit: (id) => `/members/${id}` },
  'membership cards': { base: '/membership-cards' },
  'membership fees': { base: '/membership-fees' },

  beneficiaries: { base: '/beneficiaries' },
  welfare: { base: '/beneficiaries' },
  'family tree': { base: '/members' },

  'hall booking': { base: '/hall-bookings', edit: (id) => `/hall-bookings/edit/${id}` },
  'hall bookings': { base: '/hall-bookings', edit: (id) => `/hall-bookings/edit/${id}` },
  bookings: { base: '/hall-bookings', edit: (id) => `/hall-bookings/edit/${id}` },

  zakat: { base: '/zakat-cards' },
  'zakat cards': { base: '/zakat-cards' },
  fitra: { base: '/fitra' },

  invoices: { base: '/invoices', edit: (id) => `/invoices/${id}` },
  customers: { base: '/customers' },
  donors: { base: '/donors' },

  accounting: { base: '/trial-balance-sheet' },
  ledger: { base: '/reports' },
  'general ledger': { base: '/reports' },
  'trial balance': { base: '/trial-balance-sheet' },
  journal: { base: '/bank-vouchers' },
  'journal entries': { base: '/bank-vouchers' },
  voucher: { base: '/bank-vouchers' },
  vouchers: { base: '/bank-vouchers' },
  'bank voucher': { base: '/bank-vouchers' },
  'bank vouchers': { base: '/bank-vouchers' },

  'chart of accounts': { base: '/coa' },
  accounts: { base: '/coa' },
  'revenue heads': { base: '/revenue-heads' },
  'expense heads': { base: '/expense-heads' },
  'reserved codes': { base: '/reserved' },

  auth: { base: '/' },
  authentication: { base: '/' },
  profile: { base: '/' },
  users: { base: '/users' },
  roles: { base: '/roles' },
  system: { base: '/audit-log' },
  audit: { base: '/audit-log' },
};

export function notificationRoute(notification) {
  if (!notification || !notification.module) return '/notifications';
  const key = String(notification.module).toLowerCase().trim();
  const entry = MODULE_MAP[key];
  if (!entry) return '/notifications';

  const actionType = (notification.actionType || '').toUpperCase();
  const rid = notification.recordId;

  // Delete/cancel actions land on the list — the record is gone.
  if (['DELETE', 'CANCEL', 'REJECT'].includes(actionType)) return entry.base;

  if (rid && typeof entry.edit === 'function') return entry.edit(rid);
  return entry.base;
}

// Semantic type derived from actionType — drives icon/color in the UI.
// Backend does not store a `type` column; we compute it client-side to
// avoid a schema migration.
export function notificationType(notification) {
  const action = String(notification?.actionType || '').toUpperCase();
  if (action.includes('ERROR') || action.includes('FAIL')) return 'error';
  if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('REJECT')) return 'warning';
  if (
    action.includes('CREATE') ||
    action.includes('APPROVE') ||
    action.includes('POST') ||
    action.includes('RECEIVED') ||
    action.includes('COMPLETE') ||
    action.includes('GENERATE') ||
    action.includes('PRINT')
  ) {
    return 'success';
  }
  return 'info';
}
