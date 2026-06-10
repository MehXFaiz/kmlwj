import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

// Add Express interface extension for typing support
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Serverless helper to authenticate requests.
 * Modifies the request object to include 'user' if successful, or returns false (and sends 401).
 */
export async function verifyAuth(req: AuthenticatedRequest, res: VercelResponse): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        message: 'Authorization token required',
        status: 401,
      },
    });
    return false;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  try {
    const payload = jwt.verify(token, secret) as { sub: string; email: string; role: string };
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return true;
  } catch (error) {
    res.status(401).json({
      error: {
        message: 'Invalid or expired authorization token',
        status: 401,
      },
    });
    return false;
  }
}

/**
 * Express-compatible middleware for authentication (used in dev server).
 */
export function requireAuth(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        message: 'Authorization token required',
        status: 401,
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_sign_key_123_abc';

  try {
    const payload = jwt.verify(token, secret) as { sub: string; email: string; role: string };
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error) {
    res.status(401).json({
      error: {
        message: 'Invalid or expired authorization token',
        status: 401,
      },
    });
  }
}

/**
 * Express-compatible role checker middleware.
 */
export function requireRole(roles: string[]) {
  return (req: any, res: any, next: any): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          message: 'Authentication required',
          status: 401,
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          message: 'Forbidden: Insufficient privileges',
          status: 403,
        },
      });
      return;
    }

    next();
  };
}
