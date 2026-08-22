// Request-scoped permission loader. Fetches live from DB on first call per request,
// then serves from a req-attached cache — no stale data between requests.
import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';

const CACHE_KEY = '__permissionSet';
const PRIV_CACHE_KEY = '__isPrivileged';

export const PERMISSION_EXPANSIONS: Record<string, string[]> = {
  // ── Chart of Accounts ───────────────────────────────────────────────────────
  CREATE_ACCOUNT: ['coa.create', 'coa.view'],
  UPDATE_ACCOUNT: ['coa.update', 'coa.view'],
  DELETE_ACCOUNT: ['coa.delete'],
  LOCK_ACCOUNT: ['coa.update'],
  'coa.view': ['VIEW_REPORTS', 'coa.view'],
  'coa.create': ['CREATE_ACCOUNT', 'coa.view'],
  'coa.update': ['UPDATE_ACCOUNT', 'LOCK_ACCOUNT', 'coa.view'],
  'coa.delete': ['DELETE_ACCOUNT'],
  'coa.post': ['ledger.post', 'POST_JOURNAL'],

  // ── Opening Balances ────────────────────────────────────────────────────────
  'openingBalances.view': ['VIEW_REPORTS', 'openingBalances.view'],
  'openingBalances.create': ['POST_JOURNAL', 'openingBalances.create'],
  'openingBalances.update': ['POST_JOURNAL', 'openingBalances.update'],
  'openingBalances.delete': ['POST_JOURNAL', 'openingBalances.delete'],
  'openingBalances.post': ['ledger.post', 'POST_JOURNAL'],

  // ── Reports & Audit ────────────────────────────────────────────────────────
  VIEW_REPORTS: [
    'reports.view',
    'reports.export',
    'reports.print',
    'generalLedger.view',
    'generalLedger.export',
    'generalLedger.print',
  ],
  VIEW_AUDIT: ['audit.view', 'audit.export', 'audit.print'],
  VIEW_JOURNALS: ['journalEntries.view', 'journalEntries.print'],
  'reports.view': ['VIEW_REPORTS'],
  'reports.export': ['VIEW_REPORTS'],
  'reports.print': ['VIEW_REPORTS'],
  'audit.view': ['VIEW_AUDIT'],
  'audit.export': ['VIEW_AUDIT'],
  'audit.print': ['VIEW_AUDIT'],
  'generalLedger.view': ['VIEW_REPORTS', 'generalLedger.view'],
  'generalLedger.export': ['VIEW_REPORTS', 'generalLedger.export'],
  'generalLedger.print': ['VIEW_REPORTS', 'generalLedger.print'],

  // ── Journals & Ledger ──────────────────────────────────────────────────────
  POST_JOURNAL: ['ledger.post', 'journalEntries.post', 'journalEntries.create', 'journalEntries.update'],
  'ledger.post': [
    'POST_JOURNAL',
    'donations.post',
    'revenueCollections.post',
    'hallBookings.post',
    'invoices.post',
    'revenue.post',
    'expenses.post',
    'zakatCards.post',
    'zakat.post',
    'coa.post',
    'openingBalances.post',
    'journalEntries.post',
  ],
  'journalEntries.view': ['VIEW_JOURNALS', 'journalEntries.view'],
  'journalEntries.create': ['POST_JOURNAL', 'journalEntries.create'],
  'journalEntries.update': ['POST_JOURNAL', 'journalEntries.update'],
  'journalEntries.delete': ['POST_JOURNAL', 'journalEntries.delete'],
  'journalEntries.post': ['ledger.post', 'POST_JOURNAL'],

  // ── Income / Revenue ───────────────────────────────────────────────────────
  RECORD_INCOME: [
    'revenue.view',
    'revenue.create',
    'revenue.update',
    'revenueCollections.view',
    'revenueCollections.create',
    'revenueCollections.update',
  ],
  'revenue.view': ['RECORD_INCOME', 'revenue.view'],
  'revenue.create': ['RECORD_INCOME', 'revenue.create'],
  'revenue.update': ['RECORD_INCOME', 'revenue.update'],
  'revenue.delete': ['RECORD_INCOME', 'revenue.delete'],
  'revenue.post': ['ledger.post', 'POST_JOURNAL'],

  // ── Expense ────────────────────────────────────────────────────────────────
  RECORD_EXPENSE: ['expenses.view', 'expenses.create', 'expenses.update'],
  'expenses.view': ['RECORD_EXPENSE', 'expenses.view'],
  'expenses.create': ['RECORD_EXPENSE', 'expenses.create'],
  'expenses.update': ['RECORD_EXPENSE', 'expenses.update'],
  'expenses.delete': ['RECORD_EXPENSE', 'expenses.delete'],
  'expenses.post': ['ledger.post', 'POST_JOURNAL'],

  // ── Members & Membership ───────────────────────────────────────────────────
  VIEW_MEMBERS: ['members.view', 'membership.view'],
  CREATE_MEMBER: ['members.create', 'membership.create'],
  UPDATE_MEMBER: ['members.update', 'membership.update'],
  DELETE_MEMBER: ['members.delete', 'membership.delete'],
  'members.view': ['VIEW_MEMBERS', 'members.view'],
  'members.create': ['CREATE_MEMBER', 'members.create'],
  'members.update': ['UPDATE_MEMBER', 'members.update'],
  'members.delete': ['DELETE_MEMBER', 'members.delete'],
  'membership.view': ['VIEW_MEMBERS', 'membership.view'],
  'membership.create': ['CREATE_MEMBER', 'membership.create'],
  'membership.update': ['UPDATE_MEMBER', 'membership.update'],
  'membership.delete': ['DELETE_MEMBER', 'membership.delete'],

  // ── Beneficiaries ──────────────────────────────────────────────────────────
  VIEW_BENEFICIARIES: ['beneficiaries.view'],
  CREATE_BENEFICIARY: ['beneficiaries.create'],
  UPDATE_BENEFICIARY: ['beneficiaries.update'],
  DELETE_BENEFICIARY: ['beneficiaries.delete'],
  'beneficiaries.view': ['VIEW_BENEFICIARIES', 'beneficiaries.view'],
  'beneficiaries.create': ['CREATE_BENEFICIARY', 'beneficiaries.create'],
  'beneficiaries.update': ['UPDATE_BENEFICIARY', 'beneficiaries.update'],
  'beneficiaries.delete': ['DELETE_BENEFICIARY', 'beneficiaries.delete'],

  // ── Donations & Received ───────────────────────────────────────────────────
  VIEW_DONATIONS: ['donations.view'],
  CREATE_DONATION: ['donations.create'],
  UPDATE_DONATION: ['donations.update'],
  DELETE_DONATION: ['donations.delete'],
  VIEW_DONATIONS_RECEIVED: ['donations.view', 'revenueCollections.view'],
  CREATE_DONATION_RECEIVED: ['donations.create', 'revenueCollections.create'],
  UPDATE_DONATION_RECEIVED: ['donations.update', 'revenueCollections.update'],
  DELETE_DONATION_RECEIVED: ['donations.delete', 'revenueCollections.delete'],
  MANAGE_DONATIONS: [
    'VIEW_DONATIONS',
    'CREATE_DONATION',
    'UPDATE_DONATION',
    'DELETE_DONATION',
    'VIEW_DONATIONS_RECEIVED',
    'CREATE_DONATION_RECEIVED',
    'UPDATE_DONATION_RECEIVED',
    'DELETE_DONATION_RECEIVED',
    'donations.view',
    'donations.create',
    'donations.update',
    'donations.delete',
    'donations.post',
    'donations.approve',
    'donations.export',
    'donations.print',
  ],
  'donations.view': ['VIEW_DONATIONS', 'VIEW_DONATIONS_RECEIVED', 'donations.view'],
  'donations.create': ['CREATE_DONATION', 'CREATE_DONATION_RECEIVED', 'donations.create'],
  'donations.update': ['UPDATE_DONATION', 'UPDATE_DONATION_RECEIVED', 'donations.update'],
  'donations.delete': ['DELETE_DONATION', 'DELETE_DONATION_RECEIVED', 'donations.delete'],
  'donations.post': ['ledger.post', 'POST_JOURNAL'],
  'donations.approve': ['ledger.post', 'POST_JOURNAL', 'donations.approve'],

  // ── Invoices ───────────────────────────────────────────────────────────────
  VIEW_INVOICES: ['invoices.view'],
  CREATE_INVOICE: ['invoices.create'],
  UPDATE_INVOICE: ['invoices.update'],
  DELETE_INVOICE: ['invoices.delete'],
  MANAGE_INVOICES: [
    'VIEW_INVOICES',
    'CREATE_INVOICE',
    'UPDATE_INVOICE',
    'DELETE_INVOICE',
    'invoices.view',
    'invoices.create',
    'invoices.update',
    'invoices.delete',
    'invoices.post',
    'invoices.print',
  ],
  'invoices.view': ['VIEW_INVOICES', 'invoices.view'],
  'invoices.create': ['CREATE_INVOICE', 'invoices.create'],
  'invoices.update': ['UPDATE_INVOICE', 'invoices.update'],
  'invoices.delete': ['DELETE_INVOICE', 'invoices.delete'],
  'invoices.post': ['ledger.post', 'POST_JOURNAL'],

  // ── Hall Bookings ──────────────────────────────────────────────────────────
  VIEW_HALL_BOOKINGS: ['hallBookings.view'],
  CREATE_HALL_BOOKING: ['hallBookings.create'],
  UPDATE_HALL_BOOKING: ['hallBookings.update'],
  DELETE_HALL_BOOKING: ['hallBookings.delete'],
  MANAGE_HALL_BOOKINGS: [
    'VIEW_HALL_BOOKINGS',
    'CREATE_HALL_BOOKING',
    'UPDATE_HALL_BOOKING',
    'DELETE_HALL_BOOKING',
    'hallBookings.view',
    'hallBookings.create',
    'hallBookings.update',
    'hallBookings.delete',
    'hallBookings.post',
    'hallBookings.approve',
  ],
  'hallBookings.view': ['VIEW_HALL_BOOKINGS', 'hallBookings.view'],
  'hallBookings.create': ['CREATE_HALL_BOOKING', 'hallBookings.create'],
  'hallBookings.update': ['UPDATE_HALL_BOOKING', 'hallBookings.update'],
  'hallBookings.delete': ['DELETE_HALL_BOOKING', 'hallBookings.delete'],
  'hallBookings.post': ['ledger.post', 'POST_JOURNAL'],
  'hallBookings.approve': ['ledger.post', 'POST_JOURNAL', 'hallBookings.approve'],

  // ── Revenue Collections ────────────────────────────────────────────────────
  VIEW_REVENUE_COLLECTIONS: ['revenueCollections.view'],
  CREATE_REVENUE_COLLECTION: ['revenueCollections.create'],
  UPDATE_REVENUE_COLLECTION: ['revenueCollections.update'],
  DELETE_REVENUE_COLLECTION: ['revenueCollections.delete'],
  MANAGE_REVENUE_COLLECTIONS: [
    'VIEW_REVENUE_COLLECTIONS',
    'CREATE_REVENUE_COLLECTION',
    'UPDATE_REVENUE_COLLECTION',
    'DELETE_REVENUE_COLLECTION',
    'revenueCollections.view',
    'revenueCollections.create',
    'revenueCollections.update',
    'revenueCollections.delete',
    'revenueCollections.post',
  ],
  'revenueCollections.view': ['VIEW_REVENUE_COLLECTIONS', 'revenueCollections.view'],
  'revenueCollections.create': ['CREATE_REVENUE_COLLECTION', 'revenueCollections.create'],
  'revenueCollections.update': ['UPDATE_REVENUE_COLLECTION', 'revenueCollections.update'],
  'revenueCollections.delete': ['DELETE_REVENUE_COLLECTION', 'revenueCollections.delete'],
  'revenueCollections.post': ['ledger.post', 'POST_JOURNAL'],

  // ── Zakat & Zakat Cards ────────────────────────────────────────────────────
  VIEW_ZAKAT_CARDS: ['zakatCards.view', 'zakat.view'],
  CREATE_ZAKAT_CARD: ['zakatCards.create', 'zakat.create'],
  UPDATE_ZAKAT_CARD: ['zakatCards.update', 'zakat.update'],
  DELETE_ZAKAT_CARD: ['zakatCards.delete', 'zakat.delete'],
  MANAGE_ZAKAT_CARDS: [
    'VIEW_ZAKAT_CARDS',
    'CREATE_ZAKAT_CARD',
    'UPDATE_ZAKAT_CARD',
    'DELETE_ZAKAT_CARD',
    'zakatCards.view',
    'zakatCards.create',
    'zakatCards.update',
    'zakatCards.delete',
    'zakatCards.post',
    'zakat.view',
    'zakat.create',
    'zakat.update',
    'zakat.delete',
    'zakat.post',
    'zakat.approve',
  ],
  'zakatCards.view': ['VIEW_ZAKAT_CARDS', 'zakatCards.view'],
  'zakatCards.create': ['CREATE_ZAKAT_CARD', 'zakatCards.create'],
  'zakatCards.update': ['UPDATE_ZAKAT_CARD', 'zakatCards.update'],
  'zakatCards.delete': ['DELETE_ZAKAT_CARD', 'zakatCards.delete'],
  'zakatCards.post': ['ledger.post', 'POST_JOURNAL'],
  'zakat.view': ['VIEW_ZAKAT_CARDS', 'zakat.view'],
  'zakat.create': ['CREATE_ZAKAT_CARD', 'zakat.create'],
  'zakat.update': ['UPDATE_ZAKAT_CARD', 'zakat.update'],
  'zakat.delete': ['DELETE_ZAKAT_CARD', 'zakat.delete'],
  'zakat.post': ['ledger.post', 'POST_JOURNAL'],
  'zakat.approve': ['ledger.post', 'POST_JOURNAL', 'zakat.approve'],

  // ── Donors ─────────────────────────────────────────────────────────────────
  VIEW_DONORS: ['donors.view'],
  CREATE_DONOR: ['donors.create'],
  UPDATE_DONOR: ['donors.update'],
  DELETE_DONOR: ['donors.delete'],
  MANAGE_DONORS: [
    'VIEW_DONORS',
    'CREATE_DONOR',
    'UPDATE_DONOR',
    'DELETE_DONOR',
    'donors.view',
    'donors.create',
    'donors.update',
    'donors.delete',
  ],
  'donors.view': ['VIEW_DONORS', 'donors.view'],
  'donors.create': ['CREATE_DONOR', 'donors.create'],
  'donors.update': ['UPDATE_DONOR', 'donors.update'],
  'donors.delete': ['DELETE_DONOR', 'donors.delete'],

  // ── Customers ──────────────────────────────────────────────────────────────
  VIEW_CUSTOMERS: ['customers.view'],
  CREATE_CUSTOMER: ['customers.create'],
  UPDATE_CUSTOMER: ['customers.update'],
  DELETE_CUSTOMER: ['customers.delete'],
  MANAGE_CUSTOMERS: [
    'VIEW_CUSTOMERS',
    'CREATE_CUSTOMER',
    'UPDATE_CUSTOMER',
    'DELETE_CUSTOMER',
    'customers.view',
    'customers.create',
    'customers.update',
    'customers.delete',
  ],
  'customers.view': ['VIEW_CUSTOMERS', 'customers.view'],
  'customers.create': ['CREATE_CUSTOMER', 'customers.create'],
  'customers.update': ['UPDATE_CUSTOMER', 'customers.update'],
  'customers.delete': ['DELETE_CUSTOMER', 'customers.delete'],

  // ── Security / Settings / Users / Roles ────────────────────────────────────
  MANAGE_USERS: ['users.view', 'users.create', 'users.update', 'users.delete'],
  MANAGE_ROLES: ['roles.view', 'roles.create', 'roles.update', 'roles.delete'],
  SYSTEM_SETTINGS: [
    'settings.view',
    'settings.create',
    'settings.update',
    'settings.delete',
    'MANAGE_RESERVED_CODES',
    'MANAGE_REVENUE_HEADS',
    'MANAGE_EXPENSE_HEADS',
  ],
  'users.view': ['MANAGE_USERS', 'users.view'],
  'users.create': ['MANAGE_USERS', 'users.create'],
  'users.update': ['MANAGE_USERS', 'users.update'],
  'users.delete': ['MANAGE_USERS', 'users.delete'],
  'roles.view': ['MANAGE_ROLES', 'roles.view'],
  'roles.create': ['MANAGE_ROLES', 'roles.create'],
  'roles.update': ['MANAGE_ROLES', 'roles.update'],
  'roles.delete': ['MANAGE_ROLES', 'roles.delete'],
  'settings.view': ['SYSTEM_SETTINGS', 'settings.view'],
  'settings.create': ['SYSTEM_SETTINGS', 'settings.create'],
  'settings.update': ['SYSTEM_SETTINGS', 'settings.update'],
  'settings.delete': ['SYSTEM_SETTINGS', 'settings.delete'],
};

/**
 * Returns the Set<string> of permission names for the authenticated user.
 * The set is computed from the DB on the first call and cached on req so
 * subsequent checks in the same handler are free.
 */
export async function loadPermissions(req: AuthenticatedRequest): Promise<Set<string>> {
  if ((req as any)[CACHE_KEY]) return (req as any)[CACHE_KEY] as Set<string>;
  if (!req.user?.id) return new Set();

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      role: {
        select: {
          isPrivileged: true,
          rolePermissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  });

  const rawPerms = user?.role?.rolePermissions?.map((rp) => rp.permission.name) ?? [];
  const perms = new Set<string>(rawPerms);

  // Expand canonical and legacy composite permissions
  for (const perm of rawPerms) {
    const expansions = PERMISSION_EXPANSIONS[perm];
    if (expansions) {
      for (const exp of expansions) {
        perms.add(exp);
      }
    }
  }

  (req as any)[CACHE_KEY] = perms;
  if (user?.role) {
    (req as any)[PRIV_CACHE_KEY] = user.role.isPrivileged === true;
  }

  return perms;
}

/**
 * Returns whether the authenticated user holds a privileged role (Super Admin / Admin).
 */
export async function isPrivilegedUser(req: AuthenticatedRequest): Promise<boolean> {
  if ((req as any)[PRIV_CACHE_KEY] !== undefined) {
    return (req as any)[PRIV_CACHE_KEY] as boolean;
  }
  if (!req.user?.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      role: {
        select: {
          isPrivileged: true,
        },
      },
    },
  });

  const isPrivileged = user?.role?.isPrivileged === true;
  (req as any)[PRIV_CACHE_KEY] = isPrivileged;
  return isPrivileged;
}

/** Boolean check without sending a response — supports single permission or array of aliases. */
export async function checkPermission(
  req: AuthenticatedRequest,
  permission: string | string[]
): Promise<boolean> {
  const perms = await loadPermissions(req);
  if (Array.isArray(permission)) {
    return permission.some((p) => perms.has(p));
  }
  return perms.has(permission);
}
