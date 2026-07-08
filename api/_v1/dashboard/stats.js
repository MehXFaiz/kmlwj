import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { AccountingService } from "../../_services/accounting.service.js";
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
    const typeName = (entry.account?.accountType?.name || "").toUpperCase();
    if (typeName === "REVENUE" || typeName === "INCOME") {
      monthlyData[monthIndex].Revenue += (Number(entry.credit) || 0) - (Number(entry.debit) || 0);
    } else if (typeName === "EXPENSE" || typeName === "EXPENSES") {
      monthlyData[monthIndex].Expenses += (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
    }
  }
  await AccountingService.ensureLeafPostingsAndBalances(prisma);
  const allAccounts = await prisma.account.findMany({
    include: { accountType: true }
  });
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let totalRevenue = 0;
  let totalExpense = 0;
  let cashBalance = 0;
  let bankBalance = 0;
  for (const acc of allAccounts) {
    const typeName = (acc.accountType?.name || "").toUpperCase();
    const bal = Number(acc.currentBalance) || 0;
    const nameLower = (acc.accountName || "").toLowerCase();
    const detailType = (acc.detailType || "").toLowerCase();
    const isLeaf = !allAccounts.some((a) => a.parentId === acc.id);
    if (isLeaf) {
      if (typeName === "ASSET" || typeName === "ASSETS") {
        totalAssets += bal;
        if (detailType === "bank" || nameLower.includes("bank") || nameLower.includes("al-habib") || nameLower.includes("meezan") || nameLower.includes("hbl") || nameLower.includes("mcb") || nameLower.includes("ubl") || nameLower.includes("allied") || nameLower.includes("faysal")) {
          bankBalance += bal;
        } else if (detailType === "cash" || nameLower.includes("cash") || nameLower.includes("till") || nameLower.includes("petty") || nameLower.includes("hand")) {
          cashBalance += bal;
        }
      } else if (typeName === "LIABILITY" || typeName === "LIABILITIES") {
        totalLiabilities += bal < 0 ? Math.abs(bal) : bal;
      } else if (typeName === "EQUITY") {
        totalEquity += bal < 0 ? Math.abs(bal) : bal;
      } else if (typeName === "REVENUE" || typeName === "INCOME") {
        totalRevenue += bal < 0 ? Math.abs(bal) : bal;
      } else if (typeName === "EXPENSE" || typeName === "EXPENSES") {
        totalExpense += bal;
      }
    }
  }
  const netIncome = totalRevenue - totalExpense;
  const totalEquityWithNetIncome = totalEquity + netIncome;
  const isEquationBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquityWithNetIncome)) < 0.01;
  const recentJournalsRaw = await prisma.journalEntry.findMany({
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
      date: je.postingDate ? new Date(je.postingDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
      reference: je.reference || je.description || "Journal Entry",
      description: je.description,
      status: je.status || "Posted",
      amount: total,
      voucherType: je.voucherType || "JV"
    };
  });
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
      totalAccounts,
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
        totalEquity,
        totalRevenue,
        totalExpense,
        cashBalance,
        bankBalance,
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
