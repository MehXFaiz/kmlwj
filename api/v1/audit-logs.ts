import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;

  // Enforce VIEW_REPORTS permission for audit logs
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const isSuperAdmin = user?.role.name === 'Super Admin';

  const checkPerm = (perm: string) => {
    if (isSuperAdmin) return true;
    return userPerms.includes(perm);
  };

  if (!checkPerm('VIEW_REPORTS')) {
    return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
  }

  if (method === 'GET') {
    const dbLogs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { fullName: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent 100 logs
    });

    const formatted = dbLogs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      action: log.action,
      details: `${log.module}: ${log.action} performed. IP: ${log.ipAddress || 'unknown'}.`,
      user: log.user ? log.user.fullName : 'System',
      email: log.user ? log.user.email : null,
      ipAddress: log.ipAddress,
    }));

    return res.status(200).json({ status: 200, data: formatted });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
