import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';
import { AccountingService } from '../../_services/accounting.service.js';
import { PERMS } from '../../_constants/permissions.js';

export interface DashboardSummaryResponse {
  income: number;
  expenses: number;
  donations: number;
  donationDisbursed: number;
  totalDonationsReceived: number;
  cashInHand: number;
  bankBalance: number;
  netResult: number;
  monthlyDonations: number;
  monthlyZakat: number;
  currentMonthName: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isEquationBalanced: boolean;
  currency: string;
  reportPeriod: {
    startDate: string | null;
    endDate: string | null;
  };
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;

  const { startDate, endDate, fiscalYear } = (req.query || {}) as {
    startDate?: string;
    endDate?: string;
    fiscalYear?: string;
  };

  // 1. Resolve date range boundaries
  let effectiveStartDate = startDate;
  let effectiveEndDate = endDate;
  if (!effectiveStartDate && fiscalYear) {
    effectiveStartDate = `${fiscalYear}-01-01`;
    effectiveEndDate = `${fiscalYear}-12-31`;
  }

  // 2. Fetch live General Ledger financial summary directly from database
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
  const netResult = Number(summaryResult.netPeriodIncome ?? (totalRevenue - totalExpense));
  const isEquationBalanced = summaryResult.isEquationBalanced ?? (Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01);

  // 3. Current calendar month boundary for monthly donations received
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonthName = `${monthNames[currentMonthIdx]} ${currentYear}`;
  const startOfMonth = new Date(currentYear, currentMonthIdx, 1);
  const endOfMonth = new Date(currentYear, currentMonthIdx + 1, 1);

  // 4. Monthly Donations RECEIVED during current calendar month (Single Source: DonationReceived)
  const monthlyDonationsReceivedRaw = await prisma.donationReceived.aggregate({
    _sum: { amount: true },
    where: {
      isDeleted: false,
      status: 'POSTED',
      receiptDate: { gte: startOfMonth, lt: endOfMonth }
    }
  });
  const monthlyDonations = Number(monthlyDonationsReceivedRaw._sum.amount || 0);

  // 5. Monthly Zakat RECEIVED during current calendar month
  const monthlyZakatReceivedRaw = await prisma.donationReceived.aggregate({
    _sum: { amount: true },
    where: {
      isDeleted: false,
      status: 'POSTED',
      donationType: 'ZAKAT',
      receiptDate: { gte: startOfMonth, lt: endOfMonth }
    }
  });
  const monthlyZakat = Number(monthlyZakatReceivedRaw._sum.amount || 0);

  // 6. Total donations received in requested reporting period
  const donRecPeriodWhere: any = { isDeleted: false, status: 'POSTED' };
  if (effectiveStartDate) donRecPeriodWhere.receiptDate = { ...(donRecPeriodWhere.receiptDate || {}), gte: new Date(effectiveStartDate) };
  if (effectiveEndDate) {
    const end = new Date(effectiveEndDate);
    end.setHours(23, 59, 59, 999);
    donRecPeriodWhere.receiptDate = { ...(donRecPeriodWhere.receiptDate || {}), lte: end };
  }

  const donationsReceivedPeriodRaw = await prisma.donationReceived.aggregate({
    _sum: { amount: true },
    where: donRecPeriodWhere
  });
  const totalDonationsReceived = Number(donationsReceivedPeriodRaw._sum.amount || 0);

  // 7. Total aid/welfare donations disbursed in requested period (Disbursements to Beneficiaries)
  const donationDisbPeriodWhere: any = { status: 'APPROVED', isDeleted: false };
  if (effectiveStartDate) donationDisbPeriodWhere.createdAt = { ...(donationDisbPeriodWhere.createdAt || {}), gte: new Date(effectiveStartDate) };
  if (effectiveEndDate) {
    const end = new Date(effectiveEndDate);
    end.setHours(23, 59, 59, 999);
    donationDisbPeriodWhere.createdAt = { ...(donationDisbPeriodWhere.createdAt || {}), lte: end };
  }

  const donationsDisbPeriodRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: donationDisbPeriodWhere
  });
  const totalDonationsDisbursed = Number(donationsDisbPeriodRaw._sum.amount || 0);

  const payload: DashboardSummaryResponse = {
    income: totalRevenue,
    expenses: totalExpense,
    donations: totalDonationsDisbursed,
    donationDisbursed: totalDonationsDisbursed,
    totalDonationsReceived: totalDonationsReceived,
    cashInHand: cashBalance,
    bankBalance: bankBalance,
    netResult: netResult,
    monthlyDonations: monthlyDonations,
    monthlyZakat: monthlyZakat,
    currentMonthName: currentMonthName,
    totalAssets: totalAssets,
    totalLiabilities: totalLiabilities,
    totalEquity: totalEquity,
    isEquationBalanced: isEquationBalanced,
    currency: 'PKR',
    reportPeriod: {
      startDate: effectiveStartDate ?? null,
      endDate: effectiveEndDate ?? null,
    }
  };

  return res.status(200).json({
    status: 200,
    data: payload
  });
});
