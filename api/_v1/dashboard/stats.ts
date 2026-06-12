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

  // 1. Counts from database
  const totalAccounts = await prisma.account.count();
  
  const revenueAccounts = await prisma.account.count({
    where: {
      accountType: { name: 'REVENUE' }
    }
  });

  const expenseAccounts = await prisma.account.count({
    where: {
      accountType: { name: 'EXPENSE' }
    }
  });

  const lockedAccounts = await prisma.account.count({
    where: { isLocked: true }
  });

  const activeUsers = await prisma.user.count({
    where: { isActive: true }
  });

  // 2. Recent activities from audit logs
  const rawLogs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { fullName: true, email: true }
      }
    }
  });

  const recentActivities = rawLogs.map((log) => ({
    id: log.id,
    timestamp: log.createdAt,
    action: log.action,
    details: `${log.module}: ${log.action} performed.`,
    user: log.user ? log.user.fullName : 'System',
    email: log.user ? log.user.email : null,
  }));

  return res.status(200).json({
    status: 200,
    data: {
      totalAccounts,
      revenueAccounts,
      expenseAccounts,
      lockedAccounts,
      activeUsers,
      recentActivities,
    }
  });
});
