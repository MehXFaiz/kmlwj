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

  // Single source of truth: posted journal entry lines (same source as every
  // financial report — see AccountingService.getPostedAggregates)
  const postedLines = await prisma.journalEntryLine.findMany({
    where: {
      journalEntry: {
        status: 'Posted',
        isDeleted: false,
        postingDate: {
          gte: startOfYear,
          lt: endOfYear,
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

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = months.map(month => ({ month, Revenue: 0, Expenses: 0 }));

  for (const entry of postedLines) {
    const monthIndex = entry.journalEntry.postingDate.getMonth();
    const typeName = (entry.account?.accountType?.name || '').toUpperCase();

    if (typeName === 'REVENUE' || typeName === 'INCOME') {
      monthlyData[monthIndex].Revenue += (Number(entry.credit) || 0) - (Number(entry.debit) || 0);
    } else if (typeName === 'EXPENSE' || typeName === 'EXPENSES') {
      monthlyData[monthIndex].Expenses += (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
    }
  }

  // Migrate any accidentally posted header lines to leaf accounts and recalculate
  // balances. This is a WRITER, so it must finish before the summary is read —
  // firing it un-awaited let it re-point journal lines and rewrite balances
  // *while* this very response was being computed, so the totals returned here
  // could describe a ledger state that no longer existed by the time the client
  // received them (and never matched what /reports/trial-balance, which awaits
  // its own healer, computed for the same period).
  await AccountingService.ensureLeafPostingsAndBalances(prisma).catch((err) => {
    console.error("Error in ensureLeafPostingsAndBalances:", err);
  });

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
  const startOfMonth = new Date(currentYear, new Date().getMonth(), 1);
  
  const pendingDonations = await prisma.donation.count({
    where: { status: 'PENDING', isDeleted: false }
  });

  const donationsThisMonthRaw = await prisma.donation.aggregate({
    _sum: { amount: true },
    _count: true,
    where: {
      status: 'APPROVED',
      isDeleted: false,
      createdAt: { gte: startOfMonth }
    }
  });
  
  const hallBookingsThisMonth = await prisma.hallBooking.count({
    where: { createdAt: { gte: startOfMonth }, isDeleted: false }
  });

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
