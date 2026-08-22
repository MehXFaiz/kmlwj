const ACTION_TYPES = ["view", "create", "update", "delete", "post", "approve", "export", "print"];
const ERP_MODULE_DEFINITIONS = [
  // FINANCE
  {
    key: "coa",
    name: "Chart of Accounts",
    category: "FINANCE",
    actions: ["view", "create", "update", "delete", "post"],
    description: "Account hierarchy, GL codes, account types, and ledger locks"
  },
  {
    key: "openingBalances",
    name: "Opening Balances",
    category: "FINANCE",
    actions: ["view", "create", "update", "delete", "post"],
    description: "Fiscal year opening balance batches and ledger initialization"
  },
  {
    key: "revenue",
    name: "Revenue",
    category: "FINANCE",
    actions: ["view", "create", "update", "delete", "post", "print"],
    description: "Revenue heads, simple income, specialized revenue categories and receipts"
  },
  {
    key: "expenses",
    name: "Expenses",
    category: "FINANCE",
    actions: ["view", "create", "update", "delete", "post", "print"],
    description: "Expense heads, simple expense vouchers, disbursements and petty cash"
  },
  {
    key: "generalLedger",
    name: "General Ledger",
    category: "FINANCE",
    actions: ["view", "export", "print"],
    description: "Detailed account transactions, posted ledgers, running balances and filters"
  },
  {
    key: "journalEntries",
    name: "Journal Entries",
    category: "FINANCE",
    actions: ["view", "create", "update", "delete", "post", "print"],
    description: "Manual and automated journal vouchers (JV), debit/credit adjustments"
  },
  // OPERATIONS
  {
    key: "hallBookings",
    name: "Hall Bookings",
    category: "OPERATIONS",
    actions: ["view", "create", "update", "delete", "post", "approve", "export", "print"],
    description: "Community hall bookings, calendar availability, advance payments and status"
  },
  {
    key: "membership",
    name: "Membership",
    category: "OPERATIONS",
    actions: ["view", "create", "update", "delete", "export", "print"],
    description: "Membership cards, QR card issuance, verification, and renewals"
  },
  {
    key: "members",
    name: "Members",
    category: "OPERATIONS",
    actions: ["view", "create", "update", "delete", "export", "print"],
    description: "Jamaat member directory, family relationships and member profiles"
  },
  {
    key: "customers",
    name: "Customers",
    category: "OPERATIONS",
    actions: ["view", "create", "update", "delete", "export", "print"],
    description: "Customer directory, contact profiles, credit limits and outstanding dues"
  },
  {
    key: "invoices",
    name: "Invoices",
    category: "OPERATIONS",
    actions: ["view", "create", "update", "delete", "post", "print"],
    description: "Customer billing invoices, line items, payment tracking and PDF generation"
  },
  // DONATIONS & ZAKAT
  {
    key: "donations",
    name: "Donations",
    category: "DONATIONS & ZAKAT",
    actions: ["view", "create", "update", "delete", "post", "approve", "export", "print"],
    description: "Donations given / welfare disbursements and aid distribution vouchers"
  },
  {
    key: "revenueCollections",
    name: "Collections",
    category: "DONATIONS & ZAKAT",
    actions: ["view", "create", "update", "delete", "post", "print"],
    description: "Donation received receipts, counter collections, bus bookings and fitra"
  },
  {
    key: "donors",
    name: "Donors",
    category: "DONATIONS & ZAKAT",
    actions: ["view", "create", "update", "delete", "export", "print"],
    description: "Donor registry, historical contributions and donor contact records"
  },
  {
    key: "beneficiaries",
    name: "Beneficiaries",
    category: "DONATIONS & ZAKAT",
    actions: ["view", "create", "update", "delete", "export", "print"],
    description: "Welfare aid recipients, family members, eligibility and aid history"
  },
  {
    key: "zakat",
    name: "Zakat",
    category: "DONATIONS & ZAKAT",
    actions: ["view", "create", "update", "delete", "post", "approve", "export", "print"],
    description: "Zakat fund management, disbursement allocations and verification"
  },
  {
    key: "zakatCards",
    name: "Zakat Cards",
    category: "DONATIONS & ZAKAT",
    actions: ["view", "create", "update", "delete", "post", "print"],
    description: "Monthly Zakat ration & relief cards, monthly punch tracking and balance"
  },
  // REPORTING
  {
    key: "reports",
    name: "Reports",
    category: "REPORTING",
    actions: ["view", "export", "print"],
    description: "Trial balance, profit & loss, balance sheet, cash flow statements"
  },
  {
    key: "audit",
    name: "Audit Trail",
    category: "REPORTING",
    actions: ["view", "export", "print"],
    description: "System activity logs, change history, and automated AI health diagnostic logs"
  },
  // ADMINISTRATION
  {
    key: "users",
    name: "Users",
    category: "ADMINISTRATION",
    actions: ["view", "create", "update", "delete"],
    description: "User accounts, credential provisioning, activation, and role assignments"
  },
  {
    key: "roles",
    name: "Roles & Permissions",
    category: "ADMINISTRATION",
    actions: ["view", "create", "update", "delete"],
    description: "Dynamic roles creation, custom permission assignments and access locks"
  },
  {
    key: "settings",
    name: "Settings",
    category: "ADMINISTRATION",
    actions: ["view", "create", "update", "delete"],
    description: "System configurations, fiscal year management, reserved GL code ranges"
  }
];
const ERP_MODULES_MAP = ERP_MODULE_DEFINITIONS.reduce(
  (acc, mod) => {
    acc[mod.key] = mod;
    return acc;
  },
  {}
);
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
  // ── AI Accounting Health & Auto-Repair (Admin+, see isPrivilegedRole gate) ─
  RUN_AI_AUDIT: "RUN_AI_AUDIT",
  // trigger AI analysis of detected issues
  APPLY_AI_REPAIR: "APPLY_AI_REPAIR",
  // approve/apply or auto-run AI-proposed repairs
  // ── Journal / GL posting ───────────────────────────────────────────────────
  POST_LEDGER: "ledger.post",
  // post approved transactions to General Ledger
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
  // ── Donations (granular — replaces MANAGE_DONATIONS) ──────────────────────
  VIEW_DONATIONS: "VIEW_DONATIONS",
  CREATE_DONATION: "CREATE_DONATION",
  UPDATE_DONATION: "UPDATE_DONATION",
  DELETE_DONATION: "DELETE_DONATION",
  MANAGE_DONATIONS: "MANAGE_DONATIONS",
  // ── Invoices (granular — replaces MANAGE_INVOICES) ────────────────────────
  VIEW_INVOICES: "VIEW_INVOICES",
  CREATE_INVOICE: "CREATE_INVOICE",
  UPDATE_INVOICE: "UPDATE_INVOICE",
  DELETE_INVOICE: "DELETE_INVOICE",
  MANAGE_INVOICES: "MANAGE_INVOICES",
  // ── Hall Bookings (granular — replaces MANAGE_HALL_BOOKINGS) ──────────────
  VIEW_HALL_BOOKINGS: "VIEW_HALL_BOOKINGS",
  CREATE_HALL_BOOKING: "CREATE_HALL_BOOKING",
  UPDATE_HALL_BOOKING: "UPDATE_HALL_BOOKING",
  DELETE_HALL_BOOKING: "DELETE_HALL_BOOKING",
  MANAGE_HALL_BOOKINGS: "MANAGE_HALL_BOOKINGS",
  // ── Revenue Collections (granular — replaces MANAGE_REVENUE_COLLECTIONS) ──
  VIEW_REVENUE_COLLECTIONS: "VIEW_REVENUE_COLLECTIONS",
  CREATE_REVENUE_COLLECTION: "CREATE_REVENUE_COLLECTION",
  UPDATE_REVENUE_COLLECTION: "UPDATE_REVENUE_COLLECTION",
  DELETE_REVENUE_COLLECTION: "DELETE_REVENUE_COLLECTION",
  MANAGE_REVENUE_COLLECTIONS: "MANAGE_REVENUE_COLLECTIONS",
  // ── Zakat Cards (granular — replaces MANAGE_ZAKAT_CARDS) ──────────────────
  VIEW_ZAKAT_CARDS: "VIEW_ZAKAT_CARDS",
  CREATE_ZAKAT_CARD: "CREATE_ZAKAT_CARD",
  UPDATE_ZAKAT_CARD: "UPDATE_ZAKAT_CARD",
  DELETE_ZAKAT_CARD: "DELETE_ZAKAT_CARD",
  MANAGE_ZAKAT_CARDS: "MANAGE_ZAKAT_CARDS",
  // ── Donors (granular — replaces MANAGE_DONORS) ────────────────────────────
  VIEW_DONORS: "VIEW_DONORS",
  CREATE_DONOR: "CREATE_DONOR",
  UPDATE_DONOR: "UPDATE_DONOR",
  DELETE_DONOR: "DELETE_DONOR",
  MANAGE_DONORS: "MANAGE_DONORS",
  // ── Customers (granular — replaces MANAGE_CUSTOMERS) ─────────────────────
  VIEW_CUSTOMERS: "VIEW_CUSTOMERS",
  CREATE_CUSTOMER: "CREATE_CUSTOMER",
  UPDATE_CUSTOMER: "UPDATE_CUSTOMER",
  DELETE_CUSTOMER: "DELETE_CUSTOMER",
  MANAGE_CUSTOMERS: "MANAGE_CUSTOMERS",
  // ── Donations Received ────────────────────────────────────────────────────
  VIEW_DONATIONS_RECEIVED: "VIEW_DONATIONS_RECEIVED",
  CREATE_DONATION_RECEIVED: "CREATE_DONATION_RECEIVED",
  UPDATE_DONATION_RECEIVED: "UPDATE_DONATION_RECEIVED",
  DELETE_DONATION_RECEIVED: "DELETE_DONATION_RECEIVED",
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
  PERMS.MANAGE_ROLES,
  "users.create",
  "users.update",
  "users.delete",
  "roles.create",
  "roles.update",
  "roles.delete",
  "settings.create",
  "settings.update",
  "settings.delete"
];
const PRIVILEGED_ROLE_NAMES = ["Super Admin", "Admin"];
export {
  ACTION_TYPES,
  ERP_MODULES_MAP,
  ERP_MODULE_DEFINITIONS,
  PERMS,
  PRIVILEGED_ROLE_NAMES,
  SECURITY_PERMISSIONS
};
