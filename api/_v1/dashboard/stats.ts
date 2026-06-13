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

  // 1. KPI Counts from database
  const totalAccounts = await prisma.account.count();
  
  const revenueHeads = await prisma.revenueHead.count();

  const expenseHeads = await prisma.expenseHead.count();
  
  const totalJournalEntries = await prisma.journalEntry.count();

  const lockedAccounts = await prisma.account.count({
    where: { isLocked: true }
  });

  const activeUsers = await prisma.user.count({
    where: { isActive: true }
  });

  // 2. Monthly Revenue vs Expenses Chart Data
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(`${currentYear}-01-01T00:00:00Z`);
  const endOfYear = new Date(`${currentYear + 1}-01-01T00:00:00Z`);

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: {
      postingDate: {
        gte: startOfYear,
        lt: endOfYear,
      }
    },
    include: {
      account: {
        include: { accountType: true }
      }
    }
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = months.map(month => ({ month, Revenue: 0, Expenses: 0 }));

  for (const entry of ledgerEntries) {
    const monthIndex = entry.postingDate.getMonth();
    const typeName = entry.account?.accountType?.name;

    if (typeName === 'REVENUE') {
      // Revenue increases with credit
      monthlyData[monthIndex].Revenue += (entry.credit - entry.debit);
    } else if (typeName === 'EXPENSE') {
      // Expense increases with debit
      monthlyData[monthIndex].Expenses += (entry.debit - entry.credit);
    }
  }

  // 3. Recent activities from audit logs
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
      revenueHeads,
      expenseHeads,
      totalJournalEntries,
      lockedAccounts,
      activeUsers,
      monthlyData,
      recentActivities,
    }
  });
});
