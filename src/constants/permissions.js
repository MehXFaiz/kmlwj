/**
 * Granular Dynamic Roles & Permissions Definition
 *
 * Defines ERP module groupings, allowed actions per module,
 * access level presets, and canonical dot-notation permissions.
 */

export const ACTION_LABELS = {
  view: 'View',
  create: 'Add',
  update: 'Edit',
  delete: 'Delete',
  post: 'Post to Ledger',
  approve: 'Approve',
  export: 'Export',
  print: 'Print',
};

export const ACCESS_LEVELS = [
  'No Access',
  'View Only',
  'Data Entry',
  'Editor',
  'Manager',
  'Full Access',
  'Custom',
];

export const SENSITIVE_MODULE_KEYS = ['users', 'roles', 'settings'];

export const ERP_MODULE_GROUPS = [
  {
    name: 'FINANCE',
    description: 'General ledger, charts of accounts, revenue, expenses and journal entries',
    modules: [
      {
        key: 'coa',
        name: 'Chart of Accounts',
        description: 'Account hierarchy, GL codes, account types, and ledger locks',
        actions: ['view', 'create', 'update', 'delete', 'post'],
      },
      {
        key: 'openingBalances',
        name: 'Opening Balances',
        description: 'Fiscal year opening balance batches and ledger initialization',
        actions: ['view', 'create', 'update', 'delete', 'post'],
      },
      {
        key: 'revenue',
        name: 'Revenue',
        description: 'Revenue heads, simple income, specialized revenue categories and receipts',
        actions: ['view', 'create', 'update', 'delete', 'post', 'print'],
      },
      {
        key: 'expenses',
        name: 'Expenses',
        description: 'Expense heads, simple expense vouchers, disbursements and petty cash',
        actions: ['view', 'create', 'update', 'delete', 'post', 'print'],
      },
      {
        key: 'generalLedger',
        name: 'General Ledger',
        description: 'Detailed account transactions, posted ledgers, running balances and filters',
        actions: ['view', 'export', 'print'],
      },
      {
        key: 'journalEntries',
        name: 'Journal Entries',
        description: 'Manual and automated journal vouchers (JV), debit/credit adjustments',
        actions: ['view', 'create', 'update', 'delete', 'post', 'print'],
      },
    ],
  },
  {
    name: 'OPERATIONS',
    description: 'Hall reservations, billing, invoices, customers, and community members',
    modules: [
      {
        key: 'hallBookings',
        name: 'Hall Bookings',
        description: 'Community hall bookings, calendar availability, advance payments and status',
        actions: ['view', 'create', 'update', 'delete', 'post', 'approve', 'export', 'print'],
      },
      {
        key: 'membership',
        name: 'Membership',
        description: 'Membership cards, QR card issuance, verification, and renewals',
        actions: ['view', 'create', 'update', 'delete', 'export', 'print'],
      },
      {
        key: 'members',
        name: 'Members',
        description: 'Jamaat member directory, family relationships and member profiles',
        actions: ['view', 'create', 'update', 'delete', 'export', 'print'],
      },
      {
        key: 'customers',
        name: 'Customers',
        description: 'Customer directory, contact profiles, credit limits and outstanding dues',
        actions: ['view', 'create', 'update', 'delete', 'export', 'print'],
      },
      {
        key: 'invoices',
        name: 'Invoices',
        description: 'Customer billing invoices, line items, payment tracking and PDF generation',
        actions: ['view', 'create', 'update', 'delete', 'post', 'print'],
      },
    ],
  },
  {
    name: 'DONATIONS & ZAKAT',
    description: 'Welfare disbursements, donations received, donors, beneficiaries and Zakat cards',
    modules: [
      {
        key: 'donations',
        name: 'Donations',
        description: 'Donations given / welfare disbursements and aid distribution vouchers',
        actions: ['view', 'create', 'update', 'delete', 'post', 'approve', 'export', 'print'],
      },
      {
        key: 'revenueCollections',
        name: 'Collections',
        description: 'Donation received receipts, counter collections, bus bookings and fitra',
        actions: ['view', 'create', 'update', 'delete', 'post', 'print'],
      },
      {
        key: 'donors',
        name: 'Donors',
        description: 'Donor registry, historical contributions and donor contact records',
        actions: ['view', 'create', 'update', 'delete', 'export', 'print'],
      },
      {
        key: 'beneficiaries',
        name: 'Beneficiaries',
        description: 'Welfare aid recipients, family members, eligibility and aid history',
        actions: ['view', 'create', 'update', 'delete', 'export', 'print'],
      },
      {
        key: 'zakat',
        name: 'Zakat',
        description: 'Zakat fund management, disbursement allocations and verification',
        actions: ['view', 'create', 'update', 'delete', 'post', 'approve', 'export', 'print'],
      },
      {
        key: 'zakatCards',
        name: 'Zakat Cards',
        description: 'Monthly Zakat ration & relief cards, monthly punch tracking and balance',
        actions: ['view', 'create', 'update', 'delete', 'post', 'print'],
      },
    ],
  },
  {
    name: 'REPORTING',
    description: 'Financial balance sheet, income statement, trial balance and audit trails',
    modules: [
      {
        key: 'reports',
        name: 'Reports',
        description: 'Trial balance, profit & loss, balance sheet, cash flow statements',
        actions: ['view', 'export', 'print'],
      },
      {
        key: 'audit',
        name: 'Audit Trail',
        description: 'System activity logs, change history, and automated AI health diagnostic logs',
        actions: ['view', 'export', 'print'],
      },
    ],
  },
  {
    name: 'ADMINISTRATION',
    description: 'User access accounts, role definitions, security policies and system configuration',
    modules: [
      {
        key: 'users',
        name: 'Users',
        description: 'User accounts, credential provisioning, activation, and role assignments',
        actions: ['view', 'create', 'update', 'delete'],
      },
      {
        key: 'roles',
        name: 'Roles & Permissions',
        description: 'Dynamic roles creation, custom permission assignments and access locks',
        actions: ['view', 'create', 'update', 'delete'],
      },
      {
        key: 'settings',
        name: 'Settings',
        description: 'System configurations, fiscal year management, reserved GL code ranges',
        actions: ['view', 'create', 'update', 'delete'],
      },
    ],
  },
];

// Flat lookup map of all modules
export const ERP_MODULES_MAP = ERP_MODULE_GROUPS.flatMap((g) => g.modules).reduce((acc, mod) => {
  acc[mod.key] = mod;
  return acc;
}, {});

export const ALL_MODULE_KEYS = Object.keys(ERP_MODULES_MAP);

/**
 * Computes actions map based on selected Access Level preset.
 */
export function getActionsForAccessLevel(moduleKey, accessLevel) {
  const mod = ERP_MODULES_MAP[moduleKey];
  if (!mod) return {};

  const allowed = mod.actions;
  const result = {};
  allowed.forEach((act) => { result[act] = false; });

  switch (accessLevel) {
    case 'No Access':
      return result;

    case 'View Only':
      if (allowed.includes('view')) result.view = true;
      return result;

    case 'Data Entry':
      if (allowed.includes('view')) result.view = true;
      if (allowed.includes('create')) result.create = true;
      return result;

    case 'Editor':
      if (allowed.includes('view')) result.view = true;
      if (allowed.includes('create')) result.create = true;
      if (allowed.includes('update')) result.update = true;
      return result;

    case 'Manager':
      if (allowed.includes('view')) result.view = true;
      if (allowed.includes('create')) result.create = true;
      if (allowed.includes('update')) result.update = true;
      if (allowed.includes('approve')) result.approve = true;
      if (allowed.includes('post')) result.post = true;
      return result;

    case 'Full Access':
      allowed.forEach((act) => { result[act] = true; });
      return result;

    case 'Custom':
    default:
      return result;
  }
}

/**
 * Deduces which preset matches a set of action booleans, or returns 'Custom'.
 */
export function getAccessLevelFromActions(moduleKey, actionsObj = {}) {
  const mod = ERP_MODULES_MAP[moduleKey];
  if (!mod) return 'No Access';

  const allowed = mod.actions;
  const activeCount = allowed.filter((act) => !!actionsObj[act]).length;

  if (activeCount === 0) return 'No Access';

  // Check Full Access
  if (allowed.every((act) => !!actionsObj[act])) {
    return 'Full Access';
  }

  // Check Manager
  const managerActions = allowed.filter((act) => ['view', 'create', 'update', 'approve', 'post'].includes(act));
  const managerMatches = managerActions.every((act) => !!actionsObj[act]) &&
    allowed.filter((act) => !managerActions.includes(act)).every((act) => !actionsObj[act]);
  if (managerMatches && (allowed.includes('approve') || allowed.includes('post'))) {
    return 'Manager';
  }

  // Check Editor
  const editorActions = allowed.filter((act) => ['view', 'create', 'update'].includes(act));
  const editorMatches = editorActions.every((act) => !!actionsObj[act]) &&
    allowed.filter((act) => !editorActions.includes(act)).every((act) => !actionsObj[act]);
  if (editorMatches && allowed.includes('update')) {
    return 'Editor';
  }

  // Check Data Entry
  const dataEntryActions = allowed.filter((act) => ['view', 'create'].includes(act));
  const dataEntryMatches = dataEntryActions.every((act) => !!actionsObj[act]) &&
    allowed.filter((act) => !dataEntryActions.includes(act)).every((act) => !actionsObj[act]);
  if (dataEntryMatches && allowed.includes('create')) {
    return 'Data Entry';
  }

  // Check View Only
  if (actionsObj.view && activeCount === 1) {
    return 'View Only';
  }

  return 'Custom';
}

/**
 * Builds a canonical permission string e.g. "donations.view"
 */
export function toPermissionName(moduleKey, action) {
  return `${moduleKey}.${action}`;
}

/**
 * Parses canonical permission string into { module, action }
 */
export function parsePermissionName(name) {
  const [module, action] = name.split('.');
  return { module, action };
}
