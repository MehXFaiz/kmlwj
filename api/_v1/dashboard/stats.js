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
  const postedJournals = await prisma.journalEntry.findMany({
    where: {
      status: "Posted",
      isDeleted: false,
      postingDate: {
        gte: startOfYear,
        lt: endOfYear
      }
    },
    select: {
      postingDate: true,
      lines: {
        select: {
          debit: true,
          credit: true,
          account: {
            select: {
              accountType: { select: { name: true } }
            }
          }
        }
      }
    }
  });
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = months.map((month) => ({ month, Revenue: 0, Expenses: 0 }));
  for (const entry of postedJournals) {
    const monthIndex = entry.postingDate ? entry.postingDate.getMonth() : 0;
    for (const line of entry.lines) {
      const typeName = (line.account?.accountType?.name || "").toUpperCase();
      if (typeName === "REVENUE" || typeName === "INCOME") {
        monthlyData[monthIndex].Revenue += (Number(line.credit) || 0) - (Number(line.debit) || 0);
      } else if (typeName === "EXPENSE" || typeName === "EXPENSES") {
        monthlyData[monthIndex].Expenses += (Number(line.debit) || 0) - (Number(line.credit) || 0);
      }
    }
  }
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
  const currentMonthIdx = (/* @__PURE__ */ new Date()).getMonth();
  const currentMonthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = `${monthNames[currentMonthIdx]} ${currentYear}`;
  const startOfMonth = new Date(currentYear, currentMonthIdx, 1);
  const endOfMonth = new Date(currentYear, currentMonthIdx + 1, 1);
  const pendingDonations = await prisma.donation.count({
    where: { status: "PENDING", isDeleted: false }
  });
  const nonZakatTypes = ["MONTHLY", "GENERAL_DONATION", "CUSTOM", "MARRIAGE", "MEDICAL", "EMERGENCY", "EDUCATION"];
  const monthlyDonationsRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: "APPROVED",
      isDeleted: false,
      donationType: { in: nonZakatTypes },
      OR: [
        { disbursementMonth: currentMonthKey },
        { createdAt: { gte: startOfMonth, lt: endOfMonth } }
      ]
    }
  });
  const monthlyDonations = Number(monthlyDonationsRaw._sum.amount || 0);
  const monthlyZakatRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: "APPROVED",
      isDeleted: false,
      donationType: "ZAKAT",
      OR: [
        { disbursementMonth: currentMonthKey },
        { createdAt: { gte: startOfMonth, lt: endOfMonth } }
      ]
    }
  });
  const monthlyZakat = Number(monthlyZakatRaw._sum.amount || 0);
  const donationsThisMonthRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: "APPROVED",
      isDeleted: false,
      OR: [
        { disbursementMonth: currentMonthKey },
        { createdAt: { gte: startOfMonth, lt: endOfMonth } }
      ]
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
  const donationTotalWhere = { status: "APPROVED", isDeleted: false };
  if (startDate) donationTotalWhere.createdAt = { ...donationTotalWhere.createdAt || {}, gte: new Date(startDate) };
  if (endDate) donationTotalWhere.createdAt = { ...donationTotalWhere.createdAt || {}, lte: new Date(endDate) };
  const donationsTotalRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: donationTotalWhere
  });
  const totalDisbursementsPaid = Number(donationsTotalRaw._sum.amount || 0);
  const totalDonationsPaidRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: { ...donationTotalWhere, donationType: { in: nonZakatTypes } }
  });
  const totalDonationsOnlyPaid = Number(totalDonationsPaidRaw._sum.amount || 0);
  const totalZakatPaidRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: { ...donationTotalWhere, donationType: "ZAKAT" }
  });
  const totalZakatOnlyPaid = Number(totalZakatPaidRaw._sum.amount || 0);
  const donationBankWhere = { status: "APPROVED", isDeleted: false, paymentMethod: { in: ["BANK", "CHEQUE", "ONLINE"] } };
  if (startDate) donationBankWhere.createdAt = { ...donationBankWhere.createdAt || {}, gte: new Date(startDate) };
  if (endDate) donationBankWhere.createdAt = { ...donationBankWhere.createdAt || {}, lte: new Date(endDate) };
  const donationsBankRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: donationBankWhere
  });
  const donationsPaidFromBank = Number(donationsBankRaw._sum.amount || 0);
  const donRecWhere = { isDeleted: false, status: "POSTED" };
  if (startDate) donRecWhere.receiptDate = { ...donRecWhere.receiptDate || {}, gte: new Date(startDate) };
  if (endDate) donRecWhere.receiptDate = { ...donRecWhere.receiptDate || {}, lte: new Date(endDate) };
  const [
    donRecTotalAgg,
    donRecCashAgg,
    donRecBankAgg,
    donRecChequeAgg,
    donRecMonthAgg
  ] = await Promise.all([
    prisma.donationReceived.aggregate({
      where: donRecWhere,
      _sum: { amount: true },
      _count: true
    }),
    prisma.donationReceived.aggregate({
      where: { ...donRecWhere, paymentMethod: "CASH" },
      _sum: { amount: true }
    }),
    prisma.donationReceived.aggregate({
      where: { ...donRecWhere, paymentMethod: { in: ["BANK", "ONLINE"] } },
      _sum: { amount: true }
    }),
    prisma.donationReceived.aggregate({
      where: { ...donRecWhere, paymentMethod: "CHEQUE" },
      _sum: { amount: true }
    }),
    prisma.donationReceived.aggregate({
      where: {
        isDeleted: false,
        status: "POSTED",
        receiptDate: { gte: startOfMonth, lt: endOfMonth }
      },
      _sum: { amount: true },
      _count: true
    })
  ]);
  const totalDonationsReceived = Number(donRecTotalAgg._sum.amount || 0);
  const totalDonationsCount = donRecTotalAgg._count || 0;
  const cashDonationsReceived = Number(donRecCashAgg._sum.amount || 0);
  const bankDonationsReceived = Number(donRecBankAgg._sum.amount || 0);
  const chequeDonationsReceived = Number(donRecChequeAgg._sum.amount || 0);
  const currentMonthDonationsReceived = Number(donRecMonthAgg._sum.amount || 0);
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
      currentMonthName,
      currentMonthKey,
      monthlyDonations,
      monthlyZakat,
      donationsPaid: totalDisbursementsPaid,
      donationsPaidFromBank,
      totalDonationsPaid: totalDonationsOnlyPaid,
      totalZakatPaid: totalZakatOnlyPaid,
      totalDisbursementsPaid,
      donationsThisMonth: donationsThisMonthRaw._count,
      donationsAmountThisMonth: donationsThisMonthRaw._sum.amount || 0,
      totalDonationsReceived,
      totalDonationsCount,
      cashDonationsReceived,
      bankDonationsReceived,
      chequeDonationsReceived,
      currentMonthDonationsReceived,
      hallBookingsThisMonth,
      outstandingInvoices,
      pendingApprovalsList,
      donationBreakdown,
      summary: {
        income: totalRevenue,
        expenses: totalExpense,
        donations: totalDisbursementsPaid,
        cashInHand: cashBalance,
        bankBalance,
        netResult: netIncome,
        totalAssets,
        totalLiabilities,
        netAssets,
        totalEquity: totalEquityWithNetIncome,
        baseEquity,
        totalRevenue,
        totalExpense,
        cashBalance,
        openingCashBalance,
        openingBankBalance,
        netIncome,
        donationsPaid: totalDisbursementsPaid,
        donationsPaidFromBank,
        monthlyDonations,
        monthlyZakat,
        totalDonationsReceived,
        totalDonationsCount,
        cashDonationsReceived,
        bankDonationsReceived,
        chequeDonationsReceived,
        currentMonthDonationsReceived,
        currentMonthName,
        totalDonationsPaid: totalDonationsOnlyPaid,
        totalZakatPaid: totalZakatOnlyPaid,
        isEquationBalanced
      },
      recentTransactions
    }
  });
});
export {
  stats_default as default
};
