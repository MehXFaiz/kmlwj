// Request-scoped permission loader. Fetches live from DB on first call per request,
// then serves from a req-attached cache — no stale data between requests.
import type { AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';

const CACHE_KEY = '__permissionSet';

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
          rolePermissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  });

  const perms = new Set<string>(
    user?.role.rolePermissions.map((rp) => rp.permission.name) ?? []
  );
  (req as any)[CACHE_KEY] = perms;
  return perms;
}

/** Boolean check without sending a response — use for inline conditions. */
export async function checkPermission(
  req: AuthenticatedRequest,
  permission: string
): Promise<boolean> {
  const perms = await loadPermissions(req);
  return perms.has(permission);
}
