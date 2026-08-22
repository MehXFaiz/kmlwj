// Canonical permission constants — every API route declares its required permission
// from this list. Never check role names; always check permissions loaded live from DB.
//
// RBAC RULE:
//   isPrivileged roles (Super Admin, Admin): full CRUD — enforced by rbac.middleware.ts
//   All other roles: VIEW + CREATE only — PUT/PATCH/DELETE always returns 403

export const PERMS = {
  // ── Chart of Accounts ──────────────────────────────────────────────────────
  CREATE_ACCOUNT:  'CREATE_ACCOUNT',
  UPDATE_ACCOUNT:  'UPDATE_ACCOUNT',
  DELETE_ACCOUNT:  'DELETE_ACCOUNT',
  LOCK_ACCOUNT:    'LOCK_ACCOUNT',

  // ── Financial Reports & Audit ──────────────────────────────────────────────
  VIEW_REPORTS:    'VIEW_REPORTS',    // trial balance, IS, BS, cash flow, GL, dashboard
  VIEW_AUDIT:      'VIEW_AUDIT',      // audit log access
  VIEW_JOURNALS:   'VIEW_JOURNALS',   // read journal entries

  // ── AI Accounting Health & Auto-Repair (Admin+, see isPrivilegedRole gate) ─
  RUN_AI_AUDIT:      'RUN_AI_AUDIT',      // trigger AI analysis of detected issues
  APPLY_AI_REPAIR:   'APPLY_AI_REPAIR',   // approve/apply or auto-run AI-proposed repairs

  // ── Journal / GL posting ───────────────────────────────────────────────────
  POST_JOURNAL:    'POST_JOURNAL',    // post, reverse, restore journal entries

  // ── Income & Expense ───────────────────────────────────────────────────────
  RECORD_INCOME:   'RECORD_INCOME',   // simple income, revenue collections
  RECORD_EXPENSE:  'RECORD_EXPENSE',  // simple expense, donations given

  // ── Members ────────────────────────────────────────────────────────────────
  VIEW_MEMBERS:    'VIEW_MEMBERS',
  CREATE_MEMBER:   'CREATE_MEMBER',
  UPDATE_MEMBER:   'UPDATE_MEMBER',
  DELETE_MEMBER:   'DELETE_MEMBER',

  // ── Beneficiaries ──────────────────────────────────────────────────────────
  VIEW_BENEFICIARIES:   'VIEW_BENEFICIARIES',
  CREATE_BENEFICIARY:   'CREATE_BENEFICIARY',
  UPDATE_BENEFICIARY:   'UPDATE_BENEFICIARY',
  DELETE_BENEFICIARY:   'DELETE_BENEFICIARY',

  // ── Donations (granular — replaces MANAGE_DONATIONS) ──────────────────────
  VIEW_DONATIONS:    'VIEW_DONATIONS',
  CREATE_DONATION:   'CREATE_DONATION',
  // Legacy alias — still accepted by DB, mapped by routes/seed
  /** @deprecated Use VIEW_DONATIONS + CREATE_DONATION instead */
  MANAGE_DONATIONS:  'MANAGE_DONATIONS',

  // ── Invoices (granular — replaces MANAGE_INVOICES) ────────────────────────
  VIEW_INVOICES:   'VIEW_INVOICES',
  CREATE_INVOICE:  'CREATE_INVOICE',
  /** @deprecated Use VIEW_INVOICES + CREATE_INVOICE instead */
  MANAGE_INVOICES: 'MANAGE_INVOICES',

  // ── Hall Bookings (granular — replaces MANAGE_HALL_BOOKINGS) ──────────────
  VIEW_HALL_BOOKINGS:    'VIEW_HALL_BOOKINGS',
  CREATE_HALL_BOOKING:   'CREATE_HALL_BOOKING',
  /** @deprecated Use VIEW_HALL_BOOKINGS + CREATE_HALL_BOOKING instead */
  MANAGE_HALL_BOOKINGS:  'MANAGE_HALL_BOOKINGS',

  // ── Revenue Collections (granular — replaces MANAGE_REVENUE_COLLECTIONS) ──
  VIEW_REVENUE_COLLECTIONS:    'VIEW_REVENUE_COLLECTIONS',
  CREATE_REVENUE_COLLECTION:   'CREATE_REVENUE_COLLECTION',
  /** @deprecated Use VIEW_REVENUE_COLLECTIONS + CREATE_REVENUE_COLLECTION */
  MANAGE_REVENUE_COLLECTIONS:  'MANAGE_REVENUE_COLLECTIONS',

  // ── Zakat Cards (granular — replaces MANAGE_ZAKAT_CARDS) ──────────────────
  VIEW_ZAKAT_CARDS:    'VIEW_ZAKAT_CARDS',
  CREATE_ZAKAT_CARD:   'CREATE_ZAKAT_CARD',
  /** @deprecated Use VIEW_ZAKAT_CARDS + CREATE_ZAKAT_CARD instead */
  MANAGE_ZAKAT_CARDS:  'MANAGE_ZAKAT_CARDS',

  // ── Donors (granular — replaces MANAGE_DONORS) ────────────────────────────
  VIEW_DONORS:    'VIEW_DONORS',
  CREATE_DONOR:   'CREATE_DONOR',
  /** @deprecated Use VIEW_DONORS + CREATE_DONOR instead */
  MANAGE_DONORS:  'MANAGE_DONORS',

  // ── Customers (granular — replaces MANAGE_CUSTOMERS) ─────────────────────
  VIEW_CUSTOMERS:    'VIEW_CUSTOMERS',
  CREATE_CUSTOMER:   'CREATE_CUSTOMER',
  /** @deprecated Use VIEW_CUSTOMERS + CREATE_CUSTOMER instead */
  MANAGE_CUSTOMERS:  'MANAGE_CUSTOMERS',

  // ── Donations Received ────────────────────────────────────────────────────
  VIEW_DONATIONS_RECEIVED:   'VIEW_DONATIONS_RECEIVED',
  CREATE_DONATION_RECEIVED:  'CREATE_DONATION_RECEIVED',

  // ── Configuration (Admin+) ─────────────────────────────────────────────────
  MANAGE_EXPENSE_HEADS:    'MANAGE_EXPENSE_HEADS',
  MANAGE_REVENUE_HEADS:    'MANAGE_REVENUE_HEADS',
  MANAGE_RESERVED_CODES:   'MANAGE_RESERVED_CODES',

  // ── Security (Super Admin only) ────────────────────────────────────────────
  SYSTEM_SETTINGS:   'SYSTEM_SETTINGS',  // fiscal year, DB restore, system config
  MANAGE_USERS:      'MANAGE_USERS',     // create / edit / delete users
  MANAGE_ROLES:      'MANAGE_ROLES',     // role & permission management
} as const;

export type Permission = (typeof PERMS)[keyof typeof PERMS];

// Permissions that must never be assignable except by someone who already holds
// SYSTEM_SETTINGS. These define the "Super Admin" security boundary.
export const SECURITY_PERMISSIONS: string[] = [
  PERMS.SYSTEM_SETTINGS,
  PERMS.MANAGE_USERS,
  PERMS.MANAGE_ROLES,
];

/**
 * The two system role names that are privileged (full CRUD access).
 * Used only for seed/schema bootstrapping and the isPrivileged DB flag.
 * Authorization logic must check role.isPrivileged from DB — never these strings.
 */
export const PRIVILEGED_ROLE_NAMES = ['Super Admin', 'Admin'] as const;
