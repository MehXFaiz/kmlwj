/**
 * RBAC Enforcement Middleware
 *
 * Core Business Rule:
 *   isPrivileged roles (Super Admin, Admin) → full CRUD access
 *   All other roles → VIEW + CREATE only (PUT / PATCH / DELETE → 403)
 *
 * This is enforced at the API layer regardless of the frontend state,
 * so a restricted user cannot bypass UI restrictions via Postman, curl, etc.
 */
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from './auth.middleware.js';
import { prisma } from '../_prisma.js';

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
 * authenticated user is a privileged role. If not, sends 403 and returns false.
 * Returns true when the request should proceed.
 *
 * Usage:
 *   if (!await enforceRestrictedRolePolicy(req, res)) return;
 *   // ... route logic
 */
export async function enforceRestrictedRolePolicy(
  req: AuthenticatedRequest,
  res: VercelResponse,
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? '';

  // GET and POST are allowed for all authenticated roles (subject to permission checks).
  // Only PUT, PATCH, DELETE are restricted to privileged roles.
  if (method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return true;
  }

  const privileged = await loadIsPrivileged(req);
  if (privileged) return true;

  res.status(403).json({
    error: {
      message:
        'Forbidden: Edit and Delete operations require Admin or Super Admin role. ' +
        'Your role is restricted to View and Create only.',
      status: 403,
      code: 'RESTRICTED_ROLE',
    },
  });
  return false;
}

/**
 * Express-compatible middleware version (used in the dev server / index.ts).
 *
 * Blocks PUT / PATCH / DELETE for non-privileged roles.
 * Must be placed AFTER requireAuth middleware.
 *
 * Usage:
 *   router.use(enforceRestrictedRolePolicyMiddleware);
 *   // or per-route:
 *   router.put('/donations/:id', requireAuth, enforceRestrictedRolePolicyMiddleware, handler);
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
    .then((privileged) => {
      if (privileged) {
        next();
      } else {
        res.status(403).json({
          error: {
            message:
              'Forbidden: Edit and Delete operations require Admin or Super Admin role. ' +
              'Your role is restricted to View and Create only.',
            status: 403,
            code: 'RESTRICTED_ROLE',
          },
        });
      }
    })
    .catch(next);
}
