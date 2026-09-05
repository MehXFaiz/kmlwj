import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { AccountingService } from "../../_services/accounting.service.js";
import { PERMS } from "../../_constants/permissions.js";
var summary_default = makeHandler(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;
  const { startDate, endDate, fiscalYear } = req.query || {};
  let effectiveStartDate = startDate;
  let effectiveEndDate = endDate;
  if (!effectiveStartDate && fiscalYear) {
    effectiveStartDate = `${fiscalYear}-01-01`;
    effectiveEndDate = `${fiscalYear}-12-31`;
  }
  const { result: summaryResult } = await AccountingService.computeWithLedgerVersion(
    () => AccountingService.getFinancialSummary(effectiveStartDate, effectiveEndDate)
  );
  const totalRevenue = Number(summaryResult.totalRevenue || 0);
  const totalExpense = Number(summaryResult.totalExpense || 0);
  const totalAssets = Number(summaryResult.totalAssets || 0);
  const totalLiabilities = Number(summaryResult.totalLiabilities || 0);
  const totalEquity = Number(summaryResult.totalEquity || 0);
  const cashBalance = Number(summaryResult.cashBalance || 0);
  const bankBalance = Number(summaryResult.bankBalance || 0);
  const netResult = Number(summaryResult.netPeriodIncome ?? totalRevenue - totalExpense);
  const isEquationBalanced = summaryResult.isEquationBalanced ?? Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
  const monthlyDonations = Number(summaryResult.monthlyDonations || 0);
  const monthlyZakat = Number(summaryResult.monthlyZakat || 0);
  const currentMonthName = summaryResult.currentMonthName || "Current Month";
  const donRecPeriodWhere = { isDeleted: false, status: "POSTED" };
  if (effectiveStartDate) donRecPeriodWhere.receiptDate = { ...donRecPeriodWhere.receiptDate || {}, gte: new Date(effectiveStartDate) };
  if (effectiveEndDate) {
    const end = new Date(effectiveEndDate);
    end.setHours(23, 59, 59, 999);
    donRecPeriodWhere.receiptDate = { ...donRecPeriodWhere.receiptDate || {}, lte: end };
  }
  const donationsReceivedPeriodRaw = await prisma.donationReceived.aggregate({
    _sum: { amount: true },
    where: donRecPeriodWhere
  });
  const totalDonationsReceived = Number(donationsReceivedPeriodRaw._sum.amount || 0);
  const donationDisbPeriodWhere = { status: "APPROVED", isDeleted: false };
  if (effectiveStartDate) donationDisbPeriodWhere.createdAt = { ...donationDisbPeriodWhere.createdAt || {}, gte: new Date(effectiveStartDate) };
  if (effectiveEndDate) {
    const end = new Date(effectiveEndDate);
    end.setHours(23, 59, 59, 999);
    donationDisbPeriodWhere.createdAt = { ...donationDisbPeriodWhere.createdAt || {}, lte: end };
  }
  const donationsDisbPeriodRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: donationDisbPeriodWhere
  });
  const totalDonationsDisbursed = Number(donationsDisbPeriodRaw._sum.amount || 0);
  const payload = {
    income: totalRevenue,
    expenses: totalExpense,
    donations: totalDonationsDisbursed,
    donationDisbursed: totalDonationsDisbursed,
    totalDonationsReceived,
    cashInHand: cashBalance,
    bankBalance,
    netResult,
    monthlyDonations,
    monthlyZakat,
    currentMonthName,
    totalAssets,
    totalLiabilities,
    totalEquity,
    isEquationBalanced,
    currency: "PKR",
    reportPeriod: {
      startDate: effectiveStartDate ?? null,
      endDate: effectiveEndDate ?? null
    },
    // 13 Unified Core Financial Metrics
    incomeYtd: totalRevenue,
    expensesYtd: totalExpense,
    hallBookingIncome: Number(summaryResult.hallBookingIncome || 0),
    donationIncome: Number(summaryResult.donationIncome || 0),
    zakatIncome: Number(summaryResult.zakatIncome || 0),
    otherIncome: Number(summaryResult.otherIncome || 0),
    donationDistribution: Number(summaryResult.donationDistribution || 0),
    zakatDistribution: Number(summaryResult.zakatDistribution || 0),
    otherExpenses: Number(summaryResult.otherExpenses || 0)
  };
  return res.status(200).json({
    status: 200,
    data: payload
  });
});
export {
  summary_default as default
};
