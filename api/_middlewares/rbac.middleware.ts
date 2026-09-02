/**
 * RBAC Enforcement Middleware
 *
 * Dynamic Role Authorization:
 *   - isPrivileged roles (Super Admin, Admin) → full access to all operational modules
 *   - Dynamic custom roles → granular access governed by database permissions
 *   - Non-privileged roles → read and create only; PUT/PATCH/DELETE strictly rejected with HTTP 403
 */
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from './auth.middleware.js';
import { prisma } from '../_prisma.js';
import { loadPermissions, checkPermission } from '../_services/permission.service.js';

// Cache key on req to avoid double DB round-trips within one request
const PRIV_CACHE_KEY = '__isPrivileged';

/**
 * Reads the user's isPrivileged flag live from the database.
 * Cached on req so subsequent calls in the same handler are free.
 */
export async function loadIsPrivileged(req: AuthenticatedRequest): Promise<boolean> {
  if ((req as any)[PRIV_CACHE_KEY] !== undefined) {
    return (req as any)[PRIV_CACHE_KEY] as boolean;
  }
  if (!req.user?.id) {
    (req as any)[PRIV_CACHE_KEY] = false;
    return false;
  }

  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(req.user.id);
  if (!isUuid) {
    (req as any)[PRIV_CACHE_KEY] = false;
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: { select: { isPrivileged: true } } },
  });

  const result = user?.role?.isPrivileged === true;
  (req as any)[PRIV_CACHE_KEY] = result;
  return result;
}

/**
 * Vercel/serverless version.
 *
 * Call AFTER verifyAuth. For PUT / PATCH / DELETE requests:
 * - Privileged users (Super Admin, Admin) are allowed (optionally checking specific permission if supplied).
 * - Non-privileged users are strictly rejected with HTTP 403.
 * Returns true when the request should proceed.
 */
export async function enforceRestrictedRolePolicy(
  req: AuthenticatedRequest,
  res: VercelResponse,
  requiredPermission?: string | string[]
): Promise<boolean> {
  const method = (req.method ?? '').toUpperCase();

  // GET and POST are allowed for all authenticated roles (subject to module-specific permission checks)
  if (method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return true;
  }

  const privileged = await loadIsPrivileged(req);
  if (privileged) {
    if (requiredPermission) {
      const hasPerm = await checkPermission(req, requiredPermission);
      if (!hasPerm) {
        const message = method === 'DELETE'
          ? 'You do not have permission to delete this record.'
          : `Forbidden: '${Array.isArray(requiredPermission) ? requiredPermission.join(' or ') : requiredPermission}' permission required`;
        res.status(403).json({
          success: false,
          message,
          error: {
            message,
            status: 403,
            code: 'RESTRICTED_ROLE',
          },
        });
        return false;
      }
    }
    return true;
  }

  // Allow Accountant role for PUT/PATCH if permitted or performing accounting status/posting
  if (method === 'PUT' || method === 'PATCH') {
    const userRole = (req.user as any)?.role || '';
    const isAccountant = userRole === 'Accountant' || userRole.toLowerCase().includes('accountant');
    if (isAccountant) {
      if (requiredPermission) {
        const hasPerm = await checkPermission(req, requiredPermission);
        if (hasPerm) return true;
      } else {
        return true;
      }
    }
  }

  // Non-privileged roles are strictly forbidden from EDIT (PUT/PATCH) and DELETE
  const message =
    method === 'DELETE'
      ? 'You do not have permission to delete this record.'
      : 'Forbidden: You do not have permission to edit this record. Please contact an administrator.';

  res.status(403).json({
    success: false,
    message,
    error: {
      message,
      status: 403,
      code: 'RESTRICTED_ROLE',
    },
  });
  return false;
}

/**
 * Express-compatible middleware version (used in the dev server / index.ts).
 */
export function enforceRestrictedRolePolicyMiddleware(
  req: any,
  res: any,
  next: any,
): void {
  const method = (req.method ?? '').toUpperCase();

  if (method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    next();
    return;
  }

  loadIsPrivileged(req as AuthenticatedRequest)
    .then(async (privileged) => {
      if (privileged) {
        next();
        return;
      }

      if (method === 'PUT' || method === 'PATCH') {
        const userRole = (req.user as any)?.role || '';
        const isAccountant = userRole === 'Accountant' || userRole.toLowerCase().includes('accountant');
        if (isAccountant) {
          next();
          return;
        }
      }

      const message =
        method === 'DELETE'
          ? 'You do not have permission to delete this record.'
          : 'Forbidden: You do not have permission to edit this record. Please contact an administrator.';

      res.status(403).json({
        success: false,
        message,
        error: {
          message,
          status: 403,
          code: 'RESTRICTED_ROLE',
        },
      });
    })
    .catch((err) => {
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: { message: err.message || 'Internal Server Error', status: 500 },
      });
    });
}
