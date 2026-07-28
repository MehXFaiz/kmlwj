import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { loadPermissions } from '../_services/permission.service.js';
import { PERMS } from '../_constants/permissions.js';
import { prisma } from '../_prisma.js';

/**
 * Checks if the authenticated user is a Super Admin.
 * Returns true if role is 'Super Admin' or user possesses SYSTEM_SETTINGS permission.
 */
export async function isSuperAdmin(req: AuthenticatedRequest): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'Super Admin') return true;
  const perms = await loadPermissions(req);
  return perms.has(PERMS.SYSTEM_SETTINGS);
}

const ADMIN_ROLE_NAMES = new Set(['admin', 'super admin', 'administrator']);

/**
 * Checks if the authenticated user holds an Admin-tier role (Admin / Super Admin).
 *
 * Destructive *bulk* operations are restricted to this tier even when the module
 * permission itself is broader — e.g. Manager and Operator both hold MANAGE_DONORS,
 * but neither may wipe out a whole page of donors in one request. The role name is
 * read live from the database rather than from the JWT, so a demotion takes effect
 * immediately instead of when the token expires. Mirrors canUserEditOrDelete() in
 * src/store/authStore.js so the UI gate and the API gate never disagree.
 */
export async function isAdminOrAbove(req: AuthenticatedRequest): Promise<boolean> {
  if (!req.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: { select: { name: true } } },
  });
  if (ADMIN_ROLE_NAMES.has(String(user?.role?.name || '').toLowerCase().trim())) return true;
  const perms = await loadPermissions(req);
  return perms.has(PERMS.SYSTEM_SETTINGS);
}

/**
 * Parses `isDeleted` and `includeDeleted` query parameters to build Prisma where clause filter.
 * Defaults to `{ isDeleted: false }` if no explicit filter is provided.
 */
export function getDeletedFilter(query: any): { isDeleted?: boolean } {
  if (query.includeDeleted === 'true' || query.includeDeleted === true) {
    return {};
  }
  if (query.isDeleted === 'true' || query.isDeleted === true) {
    return { isDeleted: true };
  }
  if (query.isDeleted === 'false' || query.isDeleted === false) {
    return { isDeleted: false };
  }
  return { isDeleted: false };
}
