// Request-scoped permission loader. Fetches live from DB on first call per request,
// then serves from a req-attached cache — no stale data between requests.
import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';

const CACHE_KEY = '__permissionSet';
const PRIV_CACHE_KEY = '__isPrivileged';

const LEGACY_PERMISSION_EXPANSIONS: Record<string, string[]> = {
  MANAGE_DONATIONS: ['VIEW_DONATIONS', 'CREATE_DONATION', 'VIEW_DONATIONS_RECEIVED', 'CREATE_DONATION_RECEIVED'],
  MANAGE_INVOICES: ['VIEW_INVOICES', 'CREATE_INVOICE'],
  MANAGE_HALL_BOOKINGS: ['VIEW_HALL_BOOKINGS', 'CREATE_HALL_BOOKING'],
  MANAGE_REVENUE_COLLECTIONS: ['VIEW_REVENUE_COLLECTIONS', 'CREATE_REVENUE_COLLECTION'],
  MANAGE_ZAKAT_CARDS: ['VIEW_ZAKAT_CARDS', 'CREATE_ZAKAT_CARD'],
  MANAGE_DONORS: ['VIEW_DONORS', 'CREATE_DONOR'],
  MANAGE_CUSTOMERS: ['VIEW_CUSTOMERS', 'CREATE_CUSTOMER'],
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

  const rawPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) ?? [];
  const perms = new Set<string>(rawPerms);

  // Expand legacy/composite permissions so existing roles in DB work seamlessly
  for (const perm of rawPerms) {
    const expansions = LEGACY_PERMISSION_EXPANSIONS[perm];
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

/** Boolean check without sending a response — use for inline conditions. */
export async function checkPermission(
  req: AuthenticatedRequest,
  permission: string
): Promise<boolean> {
  const perms = await loadPermissions(req);
  return perms.has(permission);
}
