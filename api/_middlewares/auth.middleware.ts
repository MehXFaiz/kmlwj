import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { loadPermissions, isPrivilegedUser } from '../_services/permission.service.js';

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string;
    email: string;
    /** Display-only — never use for authorization. Call verifyPermission() instead. */
    role: string;
  };
}

/**
 * Validates the JWT and populates req.user.
 * Does NOT enforce any permissions — call verifyPermission() for each operation.
 */
export async function verifyAuth(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Authorization token required', status: 401 } });
    return false;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');

  try {
    const payload = jwt.verify(token, secret) as { sub: string; email: string; role: string };
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return true;
  } catch {
    res.status(401).json({
      error: { message: 'Invalid or expired authorization token', status: 401 },
    });
    return false;
  }
}

/**
 * Checks that req.user holds the given permission, loaded live from the database.
 * Sends 403 and returns false if denied; returns true if allowed.
 *
 * Usage:
 *   if (!await verifyPermission(req, res, PERMS.RECORD_INCOME)) return;
 */
export async function verifyPermission(
  req: AuthenticatedRequest,
  res: VercelResponse,
  permission: string
): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Authentication required', status: 401 } });
    return false;
  }
  const perms = await loadPermissions(req);
  if (perms.has(permission)) return true;

  // Privileged roles (Super Admin, Admin) have unrestricted access to all operational modules
  const isSecurityPerm = permission === 'SYSTEM_SETTINGS' || permission === 'MANAGE_USERS' || permission === 'MANAGE_ROLES';
  if (!isSecurityPerm && await isPrivilegedUser(req)) {
    return true;
  }

  res.status(403).json({
    error: { message: `Forbidden: '${permission}' permission required`, status: 403 },
  });
  return false;
}

/**
 * Express-compatible authentication middleware (used in dev server).
 * Populates req.user from the JWT. No permission check — call requirePermission() after.
 */
export function requireAuth(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Authorization token required', status: 401 } });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');

  try {
    const payload = jwt.verify(token, secret) as { sub: string; email: string; role: string };
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    res.status(401).json({
      error: { message: 'Invalid or expired authorization token', status: 401 },
    });
  }
}

/**
 * Express-compatible permission middleware factory (used in dev server).
 * Requires requireAuth() to have run first.
 *
 * Usage: router.post('/income', requireAuth, requirePermission(PERMS.RECORD_INCOME), handler)
 */
export function requirePermission(permission: string) {
  return async (req: any, res: any, next: any): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: { message: 'Authentication required', status: 401 } });
      return;
    }
    const perms = await loadPermissions(req);
    if (!perms.has(permission)) {
      res.status(403).json({
        error: { message: `Forbidden: '${permission}' permission required`, status: 403 },
      });
      return;
    }
    next();
  };
}
