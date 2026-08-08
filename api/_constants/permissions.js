const PERMS = {
  // ── Chart of Accounts ──────────────────────────────────────────────────────
  CREATE_ACCOUNT: "CREATE_ACCOUNT",
  UPDATE_ACCOUNT: "UPDATE_ACCOUNT",
  DELETE_ACCOUNT: "DELETE_ACCOUNT",
  LOCK_ACCOUNT: "LOCK_ACCOUNT",
  // ── Financial Reports & Audit ──────────────────────────────────────────────
  VIEW_REPORTS: "VIEW_REPORTS",
  // trial balance, IS, BS, cash flow, GL, dashboard
  VIEW_AUDIT: "VIEW_AUDIT",
  // audit log access
  VIEW_JOURNALS: "VIEW_JOURNALS",
  // read journal entries
  // ── AI Accounting Health & Auto-Repair (Admin+, see isAdminOrAbove gate) ───
  RUN_AI_AUDIT: "RUN_AI_AUDIT",
  // trigger AI analysis of detected issues
  APPLY_AI_REPAIR: "APPLY_AI_REPAIR",
  // approve/apply or auto-run AI-proposed repairs
  // ── Journal / GL posting ───────────────────────────────────────────────────
  POST_JOURNAL: "POST_JOURNAL",
  // post, reverse, restore journal entries
  // ── Income & Expense ───────────────────────────────────────────────────────
  RECORD_INCOME: "RECORD_INCOME",
  // simple income, revenue collections
  RECORD_EXPENSE: "RECORD_EXPENSE",
  // simple expense, donations given
  // ── Members ────────────────────────────────────────────────────────────────
  VIEW_MEMBERS: "VIEW_MEMBERS",
  CREATE_MEMBER: "CREATE_MEMBER",
  UPDATE_MEMBER: "UPDATE_MEMBER",
  DELETE_MEMBER: "DELETE_MEMBER",
  // ── Beneficiaries ──────────────────────────────────────────────────────────
  VIEW_BENEFICIARIES: "VIEW_BENEFICIARIES",
  CREATE_BENEFICIARY: "CREATE_BENEFICIARY",
  UPDATE_BENEFICIARY: "UPDATE_BENEFICIARY",
  DELETE_BENEFICIARY: "DELETE_BENEFICIARY",
  // ── Operational modules ────────────────────────────────────────────────────
  MANAGE_DONATIONS: "MANAGE_DONATIONS",
  MANAGE_INVOICES: "MANAGE_INVOICES",
  MANAGE_HALL_BOOKINGS: "MANAGE_HALL_BOOKINGS",
  MANAGE_REVENUE_COLLECTIONS: "MANAGE_REVENUE_COLLECTIONS",
  MANAGE_ZAKAT_CARDS: "MANAGE_ZAKAT_CARDS",
  MANAGE_DONORS: "MANAGE_DONORS",
  MANAGE_CUSTOMERS: "MANAGE_CUSTOMERS",
  // ── Configuration (Admin+) ─────────────────────────────────────────────────
  MANAGE_EXPENSE_HEADS: "MANAGE_EXPENSE_HEADS",
  MANAGE_REVENUE_HEADS: "MANAGE_REVENUE_HEADS",
  MANAGE_RESERVED_CODES: "MANAGE_RESERVED_CODES",
  // ── Security (Super Admin only) ────────────────────────────────────────────
  SYSTEM_SETTINGS: "SYSTEM_SETTINGS",
  // fiscal year, DB restore, system config
  MANAGE_USERS: "MANAGE_USERS",
  // create / edit / delete users
  MANAGE_ROLES: "MANAGE_ROLES"
  // role & permission management
};
const SECURITY_PERMISSIONS = [
  PERMS.SYSTEM_SETTINGS,
  PERMS.MANAGE_USERS,
  PERMS.MANAGE_ROLES
];
export {
  PERMS,
  SECURITY_PERMISSIONS
};
