import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { loadPermissions } from '../_services/permission.service.js';
import { PERMS } from '../_constants/permissions.js';

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
