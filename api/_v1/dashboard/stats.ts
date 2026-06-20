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

  // 1. New Business KPIs
  const startOfMonth = new Date(currentYear, new Date().getMonth(), 1);
  
  const pendingDonations = await prisma.donation.count({
    where: { status: 'PENDING' }
  });

  const donationsThisMonthRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: 'APPROVED',
      createdAt: { gte: startOfMonth }
    }
  });
  
  const hallBookingsThisMonth = await prisma.hallBooking.count({
    where: { createdAt: { gte: startOfMonth } }
  });

  const outstandingInvoices = await prisma.invoice.count({
    where: { status: { in: ['ISSUED', 'OVERDUE'] } }
  });

  const pendingApprovalsList = await prisma.donation.findMany({
    where: { status: 'PENDING' },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { beneficiary: true }
  });
  
  const donationBreakdown = await prisma.donation.groupBy({
    by: ['donationType'],
    _sum: { amount: true },
    where: { status: 'APPROVED' }
  });

  // 2. Keep the Revenue vs Expenses Chart Data (this uses the ledgerEntries already fetched)

  // 3. Recent activities from audit logs (keep this but maybe operators want to see recent donations/incomes)
  const rawLogs = await prisma.auditLog.findMany({
    take: 8,
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

  // The original total counts are already fetched at the top of this file.

  return res.status(200).json({
    status: 200,
    data: {
      // old stats
      totalAccounts,
      activeUsers,
      monthlyData,
      recentActivities,
      
      // new business stats
      pendingDonations,
      donationsThisMonth: donationsThisMonthRaw._count,
      donationsAmountThisMonth: donationsThisMonthRaw._sum.amount || 0,
      hallBookingsThisMonth,
      outstandingInvoices,
      pendingApprovalsList,
      donationBreakdown
    }
  });
});
