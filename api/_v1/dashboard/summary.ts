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
  cashInHand: number;
  bankBalance: number;
  netResult: number;
  monthlyDonations: number;
  monthlyZakat: number;
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

  // 3. Current month key for monthly disbursement KPIs
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const currentMonthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
  const startOfMonth = new Date(currentYear, currentMonthIdx, 1);
  const endOfMonth = new Date(currentYear, currentMonthIdx + 1, 1);

  // 4. Monthly Donations (Non-Zakat) from actual database records
  const nonZakatTypes = ['MONTHLY', 'GENERAL_DONATION', 'CUSTOM', 'MARRIAGE', 'MEDICAL', 'EMERGENCY', 'EDUCATION'] as any;
  const monthlyDonationsRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: {
      status: 'APPROVED',
      isDeleted: false,
      donationType: { in: nonZakatTypes },
      OR: [
        { disbursementMonth: currentMonthKey },
        { createdAt: { gte: startOfMonth, lt: endOfMonth } }
      ]
    }
  });
  const monthlyDonations = Number(monthlyDonationsRaw._sum.amount || 0);

  // 5. Monthly Zakat from actual database records
  const monthlyZakatRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: {
      status: 'APPROVED',
      isDeleted: false,
      donationType: 'ZAKAT',
      OR: [
        { disbursementMonth: currentMonthKey },
        { createdAt: { gte: startOfMonth, lt: endOfMonth } }
      ]
    }
  });
  const monthlyZakat = Number(monthlyZakatRaw._sum.amount || 0);

  // 6. Total approved donations in requested period
  const donationPeriodWhere: any = { status: 'APPROVED', isDeleted: false };
  if (effectiveStartDate) donationPeriodWhere.createdAt = { ...(donationPeriodWhere.createdAt || {}), gte: new Date(effectiveStartDate) };
  if (effectiveEndDate) {
    const end = new Date(effectiveEndDate);
    end.setHours(23, 59, 59, 999);
    donationPeriodWhere.createdAt = { ...(donationPeriodWhere.createdAt || {}), lte: end };
  }

  const donationsPeriodRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: donationPeriodWhere
  });
  const totalDonations = Number(donationsPeriodRaw._sum.amount || 0);

  const payload: DashboardSummaryResponse = {
    income: totalRevenue,
    expenses: totalExpense,
    donations: totalDonations,
    cashInHand: cashBalance,
    bankBalance: bankBalance,
    netResult: netResult,
    monthlyDonations: monthlyDonations,
    monthlyZakat: monthlyZakat,
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
