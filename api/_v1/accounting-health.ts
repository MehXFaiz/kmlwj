
import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { AccountingIntegrityService } from '../_services/accounting-integrity.service.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const isSuperAdmin = user?.role.name === 'Super Admin';
  if (!isSuperAdmin && !userPerms.includes('VIEW_REPORTS') && !userPerms.includes('MANAGE_USERS')) {
    return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
  }

  try {
    const result = await AccountingIntegrityService.runFullCheck();
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      error: {
        message: 'Failed to run accounting integrity check',
        details: error?.message,
        status: 500,
      },
    });
  }
});
