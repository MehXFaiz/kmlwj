import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { loadPermissions } from '../_services/permission.service.js';
import { loadIsPrivileged } from '../_middlewares/rbac.middleware.js';
import { PERMS } from '../_constants/permissions.js';
import { prisma } from '../_prisma.js';

/**
 * Checks if the authenticated user is a Super Admin.
 * Uses the DB isPrivileged flag first (fastest), then falls back to
 * SYSTEM_SETTINGS permission check for backward compatibility.
 */
export async function isSuperAdmin(req: AuthenticatedRequest): Promise<boolean> {
  if (!req.user) return false;
  // Check DB flag first
  const privileged = await loadIsPrivileged(req);
  if (privileged) {
    // Distinguish Super Admin from Admin by SYSTEM_SETTINGS permission
    const perms = await loadPermissions(req);
    return perms.has(PERMS.SYSTEM_SETTINGS);
  }
  return false;
}

/**
 * Checks if the authenticated user holds a privileged (Admin-tier) role.
 *
 * This replaces the old string-based ADMIN_ROLE_NAMES check with a DB-driven
 * flag so a demotion takes effect immediately without waiting for token expiry.
 * Mirrors canUserEditOrDelete() in src/store/authStore.js.
 */
export async function isAdminOrAbove(req: AuthenticatedRequest): Promise<boolean> {
  if (!req.user?.id) return false;
  return loadIsPrivileged(req);
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
