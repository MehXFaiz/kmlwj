import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { loadPermissions } from '../_services/permission.service.js';
import { loadIsPrivileged } from '../_middlewares/rbac.middleware.js';
import { PERMS } from '../_constants/permissions.js';
import { SOFT_DELETE_MODELS, softDeleteAsyncContext } from '../_prisma.js';

export { SOFT_DELETE_MODELS };

/**
 * Checks if the authenticated user is a Super Admin.
 * Uses the DB isPrivileged flag first (fastest), then falls back to
 * SYSTEM_SETTINGS permission check for backward compatibility.
 */
export async function isSuperAdmin(req: AuthenticatedRequest): Promise<boolean> {
  if (!req.user) return false;
  const roleStr = String((req.user as any).role || '').trim();
  if (roleStr === 'Super Admin') {
    const privileged = await loadIsPrivileged(req);
    if (privileged) return true;
  }
  const privileged = await loadIsPrivileged(req);
  if (privileged) {
    const perms = await loadPermissions(req);
    return perms.has(PERMS.SYSTEM_SETTINGS);
  }
  return false;
}

/**
 * Checks if the authenticated user holds a privileged (Admin-tier) role.
 */
export async function isAdminOrAbove(req: AuthenticatedRequest): Promise<boolean> {
  if (!req.user?.id) return false;
  return loadIsPrivileged(req);
}

/**
 * Parses `isDeleted` and `includeDeleted` query parameters to build Prisma where clause filter.
 * Defaults to `{ isDeleted: false }` if no explicit filter is provided.
 * When `includeDeleted=true`, returns `{ isDeleted: { in: [true, false] } }` so centralized
 * Prisma query protection recognizes the explicit filter and returns both active and deleted records.
 */
export function getDeletedFilter(query: any): { isDeleted?: any } {
  if (!query) return { isDeleted: false };
  if (query.includeDeleted === 'true' || query.includeDeleted === true) {
    return { isDeleted: { in: [true, false] } };
  }
  if (query.isDeleted === 'true' || query.isDeleted === true) {
    return { isDeleted: true };
  }
  if (query.isDeleted === 'false' || query.isDeleted === false) {
    return { isDeleted: false };
  }
  return { isDeleted: false };
}

/**
 * Runs a callback with centralized soft-delete filtering bypassed (allows querying deleted + active records).
 */
export function runWithDeleted<T>(fn: () => Promise<T>): Promise<T> {
  return softDeleteAsyncContext.run({ includeDeleted: true }, fn);
}

/**
 * Standard payload for marking a record as soft-deleted.
 */
export function buildSoftDeleteData(userId?: string | null) {
  return {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: userId || null,
  };
}

/**
 * Standard payload for restoring a soft-deleted record.
 */
export function buildRestoreData() {
  return {
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
  };
}
