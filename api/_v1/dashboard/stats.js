import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
var stats_default = makeHandler(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
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
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const startOfYear = /* @__PURE__ */ new Date(`${currentYear}-01-01T00:00:00Z`);
  const endOfYear = /* @__PURE__ */ new Date(`${currentYear + 1}-01-01T00:00:00Z`);
  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: {
      postingDate: {
        gte: startOfYear,
        lt: endOfYear
      }
    },
    include: {
      account: {
        include: { accountType: true }
      }
    }
  });
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = months.map((month) => ({ month, Revenue: 0, Expenses: 0 }));
  for (const entry of ledgerEntries) {
    const monthIndex = entry.postingDate.getMonth();
    const typeName = entry.account?.accountType?.name;
    if (typeName === "REVENUE") {
      monthlyData[monthIndex].Revenue += entry.credit - entry.debit;
    } else if (typeName === "EXPENSE") {
      monthlyData[monthIndex].Expenses += entry.debit - entry.credit;
    }
  }
  const startOfMonth = new Date(currentYear, (/* @__PURE__ */ new Date()).getMonth(), 1);
  const pendingDonations = await prisma.donation.count({
    where: { status: "PENDING" }
  });
  const donationsThisMonthRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: "APPROVED",
      createdAt: { gte: startOfMonth }
    }
  });
  const hallBookingsThisMonth = await prisma.hallBooking.count({
    where: { createdAt: { gte: startOfMonth } }
  });
  const outstandingInvoices = await prisma.invoice.count({
    where: { status: { in: ["ISSUED", "OVERDUE"] } }
  });
  const pendingApprovalsList = await prisma.donation.findMany({
    where: { status: "PENDING" },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { beneficiary: true }
  });
  const donationBreakdown = await prisma.donation.groupBy({
    by: ["donationType"],
    _sum: { amount: true },
    where: { status: "APPROVED" }
  });
  const rawLogs = await prisma.auditLog.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
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
    user: log.user ? log.user.fullName : "System",
    email: log.user ? log.user.email : null
  }));
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
export {
  stats_default as default
};
