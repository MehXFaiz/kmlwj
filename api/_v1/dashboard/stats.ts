import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';
import { AccountingService } from '../../_services/accounting.service.js';
import { PERMS } from '../../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;
  const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

  // 1. KPI Counts from database
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

  // 2. Monthly Revenue vs Expenses Chart Data
  const currentYear = new Date().getFullYear();
  const chartYear = startDate ? new Date(startDate).getFullYear() : currentYear;
  const startOfYear = new Date(`${chartYear}-01-01T00:00:00Z`);
  const endOfYear = new Date(`${chartYear + 1}-01-01T00:00:00Z`);

  // Single source of truth: posted journal entry lines
  const postedJournals = await prisma.journalEntry.findMany({
    where: {
      status: 'Posted',
      isDeleted: false,
      postingDate: {
        gte: startOfYear,
        lt: endOfYear,
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

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = months.map(month => ({ month, Revenue: 0, Expenses: 0 }));

  for (const entry of postedJournals) {
    const monthIndex = entry.postingDate ? entry.postingDate.getMonth() : 0;
    for (const line of entry.lines) {
      const typeName = (line.account?.accountType?.name || '').toUpperCase();
      if (typeName === 'REVENUE' || typeName === 'INCOME') {
        monthlyData[monthIndex].Revenue += (Number(line.credit) || 0) - (Number(line.debit) || 0);
      } else if (typeName === 'EXPENSE' || typeName === 'EXPENSES') {
        monthlyData[monthIndex].Expenses += (Number(line.debit) || 0) - (Number(line.credit) || 0);
      }
    }
  }

  // Migrate any accidentally posted header lines to leaf accounts and recalculate
  // balances. This is a WRITER, so it must finish before the summary is read —
  // Calculate live financial summary using AccountingService, stamped with the
  // ledger version it was computed from so the client can tell a genuine
  // Dashboard-vs-Trial-Balance discrepancy apart from two responses that simply
  // observed the ledger at different instants.
  const { result: summaryResult, ledgerVersion } = await AccountingService.computeWithLedgerVersion(
    () => AccountingService.getFinancialSummary(startDate, endDate)
  );

  const totalAssets = summaryResult.totalAssets;
  const totalLiabilities = summaryResult.totalLiabilities;
  const totalRevenue = summaryResult.totalRevenue;
  const totalExpense = summaryResult.totalExpense;
  const cashBalance = summaryResult.cashBalance;
  const bankBalance = summaryResult.bankBalance;
  // Opening balances (as of the fiscal year's start) — lets the Dashboard show
  // Cash in Hand as "Opening + this period's movement" instead of a single
  // cumulative figure with nothing to reconcile it against Net Surplus.
  const openingCashBalance = summaryResult.openingCashBalance ?? cashBalance;
  const openingBankBalance = summaryResult.openingBankBalance ?? bankBalance;
  const netAssets = summaryResult.netAssets ?? (totalAssets - totalLiabilities);
  const netIncome = summaryResult.netPeriodIncome;
  const baseEquity = summaryResult.totalEquity - netIncome;
  const totalEquityWithNetIncome = summaryResult.totalEquity;
  const isEquationBalanced = totalAssets === totalLiabilities + totalEquityWithNetIncome;


  // Recent posted transactions
  const recentJournalsRaw = await prisma.journalEntry.findMany({
    where: { isDeleted: false },
    take: 8,
    orderBy: { postingDate: 'desc' },
    include: {
      lines: true
    }
  });

  const recentTransactions = recentJournalsRaw.map(je => {
    const total = je.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    return {
      id: je.voucherNo || je.id.slice(0, 8),
      dbId: je.id,
      date: je.postingDate ? new Date(je.postingDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
      reference: je.reference || je.description || 'Journal Entry',
      description: je.description,
      status: je.status || 'Posted',
      amount: total,
      voucherType: je.voucherType || 'JV'
    };
  });

  // 1. New Business KPIs
  const currentMonthIdx = new Date().getMonth();
  const currentMonthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonthName = `${monthNames[currentMonthIdx]} ${currentYear}`;
  const startOfMonth = new Date(currentYear, currentMonthIdx, 1);
  const endOfMonth = new Date(currentYear, currentMonthIdx + 1, 1);
  
  const pendingDonations = await prisma.donation.count({
    where: { status: 'PENDING', isDeleted: false }
  });

  // Monthly Donations (excluding Zakat) for current month
  const nonZakatTypes = ['MONTHLY', 'GENERAL_DONATION', 'CUSTOM', 'MARRIAGE', 'MEDICAL', 'EMERGENCY', 'EDUCATION'] as any;
  const monthlyDonationsRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
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

  // Monthly Zakat for current month
  const monthlyZakatRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
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

  const donationsThisMonthRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: 'APPROVED',
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

  // Total net amount for hall bookings in the requested period (whole booking amount)
  const hbTotalWhere: any = { isDeleted: false };
  if (startDate) hbTotalWhere.createdAt = { ...(hbTotalWhere.createdAt || {}), gte: new Date(startDate) };
  if (endDate) hbTotalWhere.createdAt = { ...(hbTotalWhere.createdAt || {}), lte: new Date(endDate) };

  const hallBookingTotalRaw = await prisma.hallBooking.aggregate({
    _sum: { netAmount: true },
    where: hbTotalWhere
  });
  const totalHallBookingAmount = Number(hallBookingTotalRaw._sum.netAmount || 0);

  // Total received amount for hall bookings paid in cash in the requested period
  const hbCashWhere: any = { isDeleted: false, receivedAmount: { gt: 0 } };
  if (startDate) hbCashWhere.createdAt = { ...(hbCashWhere.createdAt || {}), gte: new Date(startDate) };
  if (endDate) hbCashWhere.createdAt = { ...(hbCashWhere.createdAt || {}), lte: new Date(endDate) };
  hbCashWhere.paymentMethod = 'CASH';

  const hallBookingReceivedCashRaw = await prisma.hallBooking.aggregate({
    _sum: { receivedAmount: true },
    where: hbCashWhere
  });
  const totalHallBookingReceivedCash = Number(hallBookingReceivedCashRaw._sum.receivedAmount || 0);

  const outstandingInvoices = await prisma.invoice.count({
    where: { status: { in: ['ISSUED', 'OVERDUE'] }, isDeleted: false }
  });

  const pendingApprovalsList = await prisma.donation.findMany({
    where: { status: 'PENDING', isDeleted: false },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { beneficiary: true }
  });
  
  const donationBreakdown = await prisma.donation.groupBy({
    by: ['donationType'],
    _sum: { amount: true },
    where: { status: 'APPROVED', isDeleted: false }
  });

  // 3. Recent activities from audit logs
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

  // Total donations paid/disbursed in the requested period (or overall if no period specified)
  const donationTotalWhere: any = { status: 'APPROVED', isDeleted: false };
  if (startDate) donationTotalWhere.createdAt = { ...(donationTotalWhere.createdAt || {}), gte: new Date(startDate) };
  if (endDate) donationTotalWhere.createdAt = { ...(donationTotalWhere.createdAt || {}), lte: new Date(endDate) };

  const donationsTotalRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: donationTotalWhere
  });
  const totalDisbursementsPaid = Number(donationsTotalRaw._sum.amount || 0);

  // Split into Donations vs Zakat for the period
  const totalDonationsPaidRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: { ...donationTotalWhere, donationType: { in: nonZakatTypes } }
  });
  const totalDonationsOnlyPaid = Number(totalDonationsPaidRaw._sum.amount || 0);

  const totalZakatPaidRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: { ...donationTotalWhere, donationType: 'ZAKAT' }
  });
  const totalZakatOnlyPaid = Number(totalZakatPaidRaw._sum.amount || 0);

  const donationBankWhere: any = { status: 'APPROVED', isDeleted: false, paymentMethod: { in: ['BANK', 'CHEQUE', 'ONLINE'] } };
  if (startDate) donationBankWhere.createdAt = { ...(donationBankWhere.createdAt || {}), gte: new Date(startDate) };
  if (endDate) donationBankWhere.createdAt = { ...(donationBankWhere.createdAt || {}), lte: new Date(endDate) };

  const donationsBankRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    where: donationBankWhere
  });
  const donationsPaidFromBank = Number(donationsBankRaw._sum.amount || 0);

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
        currentMonthName,
        totalDonationsPaid: totalDonationsOnlyPaid,
        totalZakatPaid: totalZakatOnlyPaid,
        isEquationBalanced
      },
      recentTransactions
    }
  });
});
