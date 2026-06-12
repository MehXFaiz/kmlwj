import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: { message: 'User not found', status: 404 } });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: { message: 'This account has been deactivated', status: 403 } });
  }

  // Compile permissions list
  const permissions = user.role.rolePermissions.map((rp) => rp.permission.name);

  return res.status(200).json({
    status: 200,
    data: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      permissions,
    },
  });
});
