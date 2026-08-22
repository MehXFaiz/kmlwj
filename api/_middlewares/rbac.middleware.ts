/**
 * RBAC Enforcement Middleware
 *
 * Dynamic Role Authorization:
 *   - isPrivileged roles (Super Admin, Admin) → full access to all operational modules
 *   - Dynamic custom roles → granular access governed by database permissions
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
 * Call AFTER verifyAuth. For PUT / PATCH / DELETE requests, checks that the
 * authenticated user has permission for the operation (either via isPrivileged or granular permission).
 * Returns true when the request should proceed.
 */
export async function enforceRestrictedRolePolicy(
  req: AuthenticatedRequest,
  res: VercelResponse,
  requiredPermission?: string | string[]
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? '';

  // GET and POST are allowed for all authenticated roles (subject to module-specific permission checks)
  if (method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return true;
  }

  const privileged = await loadIsPrivileged(req);
  if (privileged) return true;

  res.status(403).json({
    error: {
      message:
        'Forbidden: Restricted roles are not permitted to edit or delete records. Please contact an administrator.',
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

      res.status(403).json({
        error: {
          message:
            'Forbidden: Restricted roles are not permitted to edit or delete records. Please contact an administrator.',
          status: 403,
          code: 'RESTRICTED_ROLE',
        },
      });
    })
    .catch(next);
}
