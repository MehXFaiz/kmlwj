import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { PERMS } from '../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;

  if (!await verifyPermission(req, res, PERMS.VIEW_AUDIT)) return;

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
      module: log.module || 'SYSTEM',
      details: `${log.module}: ${log.action} performed. IP: ${log.ipAddress || 'unknown'}.`,
      user: log.user ? log.user.fullName : 'System',
      email: log.user ? log.user.email : null,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
      oldValues: log.oldValues || null,
      newValues: log.newValues || null,
    }));

    return res.status(200).json({ status: 200, data: formatted });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
