import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { AccountingService } from "../../_services/accounting.service.js";
import { PERMS } from "../../_constants/permissions.js";
var stats_default = makeHandler(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;
  const { startDate, endDate } = req.query || {};
  const totalAccounts = await prisma.account.count({ where: { isDeleted: false } });
  const revenueHeads = await prisma.revenueHead.count({ where: { isDeleted: false } });
  const expenseHeads = await prisma.expenseHead.count({ where: { isDeleted: false } });
  const totalJournalEntries = await prisma.journalEntry.count({ where: { isDeleted: false } });
  const lockedAccounts = await prisma.account.count({
    where: { isLocked: true, isDeleted: false }
  });
  const activeUsers = await prisma.user.count({
    where: { isActive: true, isDeleted: false }
  });
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const chartYear = startDate ? new Date(startDate).getFullYear() : currentYear;
  const startOfYear = /* @__PURE__ */ new Date(`${chartYear}-01-01T00:00:00Z`);
  const endOfYear = /* @__PURE__ */ new Date(`${chartYear + 1}-01-01T00:00:00Z`);
  const postedLines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: "Posted",
        isDeleted: false,
        postingDate: {
          gte: startOfYear,
          lt: endOfYear
        }
      }
    },
    include: {
      account: {
        include: { accountType: true }
      },
      journalEntry: {
        select: { postingDate: true }
      }
    }
  });
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = months.map((month) => ({ month, Revenue: 0, Expenses: 0 }));
  for (const entry of postedLines) {
    const monthIndex = entry.journalEntry.postingDate.getMonth();
    const typeName = (entry.account?.accountType?.name || "").toUpperCase();
    if (typeName === "REVENUE" || typeName === "INCOME") {
      monthlyData[monthIndex].Revenue += (Number(entry.credit) || 0) - (Number(entry.debit) || 0);
    } else if (typeName === "EXPENSE" || typeName === "EXPENSES") {
      monthlyData[monthIndex].Expenses += (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
    }
  }
  await AccountingService.ensureLeafPostingsAndBalances(prisma).catch((err) => {
    console.error("Error in ensureLeafPostingsAndBalances:", err);
  });
  const { result: summaryResult, ledgerVersion } = await AccountingService.computeWithLedgerVersion(
    () => AccountingService.getFinancialSummary(startDate, endDate)
  );
  const totalAssets = summaryResult.totalAssets;
  const totalLiabilities = summaryResult.totalLiabilities;
  const totalRevenue = summaryResult.totalRevenue;
  const totalExpense = summaryResult.totalExpense;
  const cashBalance = summaryResult.cashBalance;
  const bankBalance = summaryResult.bankBalance;
  const openingCashBalance = summaryResult.openingCashBalance ?? cashBalance;
  const openingBankBalance = summaryResult.openingBankBalance ?? bankBalance;
  const netAssets = summaryResult.netAssets ?? totalAssets - totalLiabilities;
  const netIncome = summaryResult.netPeriodIncome;
  const baseEquity = summaryResult.totalEquity - netIncome;
  const totalEquityWithNetIncome = summaryResult.totalEquity;
  const isEquationBalanced = totalAssets === totalLiabilities + totalEquityWithNetIncome;
  const recentJournalsRaw = await prisma.journalEntry.findMany({
    where: { isDeleted: false },
    take: 8,
    orderBy: { postingDate: "desc" },
    include: {
      lines: true
    }
  });
  const recentTransactions = recentJournalsRaw.map((je) => {
    const total = je.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    return {
      id: je.voucherNo || je.id.slice(0, 8),
      dbId: je.id,
      date: je.postingDate ? new Date(je.postingDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
      reference: je.reference || je.description || "Journal Entry",
      description: je.description,
      status: je.status || "Posted",
      amount: total,
      voucherType: je.voucherType || "JV"
    };
  });
  const startOfMonth = new Date(currentYear, (/* @__PURE__ */ new Date()).getMonth(), 1);
  const pendingDonations = await prisma.donation.count({
    where: { status: "PENDING", isDeleted: false }
  });
  const donationsThisMonthRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: "APPROVED",
      isDeleted: false,
      createdAt: { gte: startOfMonth }
    }
  });
  const hallBookingsThisMonth = await prisma.hallBooking.count({
    where: { createdAt: { gte: startOfMonth }, isDeleted: false }
  });
  const hbTotalWhere = { isDeleted: false };
  if (startDate) hbTotalWhere.createdAt = { ...hbTotalWhere.createdAt || {}, gte: new Date(startDate) };
  if (endDate) hbTotalWhere.createdAt = { ...hbTotalWhere.createdAt || {}, lte: new Date(endDate) };
  const hallBookingTotalRaw = await prisma.hallBooking.aggregate({
    _sum: { netAmount: true },
    where: hbTotalWhere
  });
  const totalHallBookingAmount = Number(hallBookingTotalRaw._sum.netAmount || 0);
  const hbCashWhere = { isDeleted: false, receivedAmount: { gt: 0 } };
  if (startDate) hbCashWhere.createdAt = { ...hbCashWhere.createdAt || {}, gte: new Date(startDate) };
  if (endDate) hbCashWhere.createdAt = { ...hbCashWhere.createdAt || {}, lte: new Date(endDate) };
  hbCashWhere.paymentMethod = "CASH";
  const hallBookingReceivedCashRaw = await prisma.hallBooking.aggregate({
    _sum: { receivedAmount: true },
    where: hbCashWhere
  });
  const totalHallBookingReceivedCash = Number(hallBookingReceivedCashRaw._sum.receivedAmount || 0);
  const outstandingInvoices = await prisma.invoice.count({
    where: { status: { in: ["ISSUED", "OVERDUE"] }, isDeleted: false }
  });
  const pendingApprovalsList = await prisma.donation.findMany({
    where: { status: "PENDING", isDeleted: false },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { beneficiary: true }
  });
  const donationBreakdown = await prisma.donation.groupBy({
    by: ["donationType"],
    _sum: { amount: true },
    where: { status: "APPROVED", isDeleted: false }
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
      ledgerVersion,
      reportPeriod: { startDate: startDate ?? null, endDate: endDate ?? null },
      totalAccounts,
      totalJournalEntries,
      revenueHeads,
      expenseHeads,
      activeUsers,
      monthlyData,
      recentActivities,
      pendingDonations,
      donationsThisMonth: donationsThisMonthRaw._count,
      donationsAmountThisMonth: donationsThisMonthRaw._sum.amount || 0,
      hallBookingsThisMonth,
      outstandingInvoices,
      pendingApprovalsList,
      donationBreakdown,
      summary: {
        totalAssets,
        totalLiabilities,
        netAssets,
        totalEquity: totalEquityWithNetIncome,
        baseEquity,
        totalRevenue,
        totalExpense,
        hallBookingReceivedCash: totalHallBookingReceivedCash,
        hallBookingTotal: totalHallBookingAmount,
        cashBalance,
        bankBalance,
        openingCashBalance,
        openingBankBalance,
        netIncome,
        isEquationBalanced
      },
      recentTransactions
    }
  });
});
export {
  stats_default as default
};
