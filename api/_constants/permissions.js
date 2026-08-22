const PERMS = {
  // ── Chart of Accounts ──────────────────────────────────────────────────────
  CREATE_ACCOUNT: "CREATE_ACCOUNT",
  UPDATE_ACCOUNT: "UPDATE_ACCOUNT",
  DELETE_ACCOUNT: "DELETE_ACCOUNT",
  LOCK_ACCOUNT: "LOCK_ACCOUNT",
  // ── Financial Reports & Audit ──────────────────────────────────────────────
  VIEW_REPORTS: "VIEW_REPORTS",
  VIEW_AUDIT: "VIEW_AUDIT",
  VIEW_JOURNALS: "VIEW_JOURNALS",
  // ── AI Accounting Health & Auto-Repair ─────────────────────────────────────
  RUN_AI_AUDIT: "RUN_AI_AUDIT",
  APPLY_AI_REPAIR: "APPLY_AI_REPAIR",
  // ── Journal / GL posting ───────────────────────────────────────────────────
  POST_JOURNAL: "POST_JOURNAL",
  // ── Income & Expense ───────────────────────────────────────────────────────
  RECORD_INCOME: "RECORD_INCOME",
  RECORD_EXPENSE: "RECORD_EXPENSE",
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
  // ── Donations (Granular) ───────────────────────────────────────────────────
  VIEW_DONATIONS: "VIEW_DONATIONS",
  CREATE_DONATION: "CREATE_DONATION",
  MANAGE_DONATIONS: "MANAGE_DONATIONS",
  // ── Donations Received ─────────────────────────────────────────────────────
  VIEW_DONATIONS_RECEIVED: "VIEW_DONATIONS_RECEIVED",
  CREATE_DONATION_RECEIVED: "CREATE_DONATION_RECEIVED",
  // ── Invoices ───────────────────────────────────────────────────────────────
  VIEW_INVOICES: "VIEW_INVOICES",
  CREATE_INVOICE: "CREATE_INVOICE",
  MANAGE_INVOICES: "MANAGE_INVOICES",
  // ── Hall Bookings ──────────────────────────────────────────────────────────
  VIEW_HALL_BOOKINGS: "VIEW_HALL_BOOKINGS",
  CREATE_HALL_BOOKING: "CREATE_HALL_BOOKING",
  MANAGE_HALL_BOOKINGS: "MANAGE_HALL_BOOKINGS",
  // ── Revenue Collections ────────────────────────────────────────────────────
  VIEW_REVENUE_COLLECTIONS: "VIEW_REVENUE_COLLECTIONS",
  CREATE_REVENUE_COLLECTION: "CREATE_REVENUE_COLLECTION",
  MANAGE_REVENUE_COLLECTIONS: "MANAGE_REVENUE_COLLECTIONS",
  // ── Zakat Cards ────────────────────────────────────────────────────────────
  VIEW_ZAKAT_CARDS: "VIEW_ZAKAT_CARDS",
  CREATE_ZAKAT_CARD: "CREATE_ZAKAT_CARD",
  MANAGE_ZAKAT_CARDS: "MANAGE_ZAKAT_CARDS",
  // ── Donors ─────────────────────────────────────────────────────────────────
  VIEW_DONORS: "VIEW_DONORS",
  CREATE_DONOR: "CREATE_DONOR",
  MANAGE_DONORS: "MANAGE_DONORS",
  // ── Customers ──────────────────────────────────────────────────────────────
  VIEW_CUSTOMERS: "VIEW_CUSTOMERS",
  CREATE_CUSTOMER: "CREATE_CUSTOMER",
  MANAGE_CUSTOMERS: "MANAGE_CUSTOMERS",
  // ── Configuration (Admin+) ─────────────────────────────────────────────────
  MANAGE_EXPENSE_HEADS: "MANAGE_EXPENSE_HEADS",
  MANAGE_REVENUE_HEADS: "MANAGE_REVENUE_HEADS",
  MANAGE_RESERVED_CODES: "MANAGE_RESERVED_CODES",
  // ── Security (Super Admin only) ────────────────────────────────────────────
  SYSTEM_SETTINGS: "SYSTEM_SETTINGS",
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_ROLES: "MANAGE_ROLES"
};
const SECURITY_PERMISSIONS = [
  PERMS.SYSTEM_SETTINGS,
  PERMS.MANAGE_USERS,
  PERMS.MANAGE_ROLES
];
const PRIVILEGED_ROLE_NAMES = ["Super Admin", "Admin"];
export {
  PERMS,
  SECURITY_PERMISSIONS,
  PRIVILEGED_ROLE_NAMES
};
