import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';
import { AccountingService } from '../../_services/accounting.service.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    // Enforce VIEW_REPORTS permission
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
    const isSuperAdmin = user?.role.name === 'Super Admin';

    if (!isSuperAdmin && !userPerms.includes('VIEW_REPORTS')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    // Optional date range filter
    const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

    try {
      const bs = await AccountingService.getBalanceSheet(startDate, endDate);

      // Filter out any virtual accounts we added in AccountingService so we can build them in the exact format expected by the frontend
      const equityFiltered = bs.equity.filter(eq => eq.id !== 'retained-earnings-net' && eq.id !== 'retained-earnings-opening-diff');

      const netIncome = bs.netPeriodIncome;
      const openingRetainedEarnings = bs.openingRetainedEarnings;

      if (openingRetainedEarnings !== 0) {
        equityFiltered.push({
          id: 'virtual-opening-retained-earnings',
          glCode: '-',
          accountName: startDate
            ? `Opening Retained Earnings (before ${startDate})`
            : 'Opening Retained Earnings',
          balance: Math.abs(openingRetainedEarnings),
          isRetainedEarnings: true,
          sign: openingRetainedEarnings >= 0 ? 1 : -1
        });
      }

      if (netIncome !== 0) {
        equityFiltered.push({
          id: 'virtual-net-income',
          glCode: '-',
          accountName: startDate || endDate
            ? `Net Income (${startDate || ''}${startDate && endDate ? ' to ' : ''}${endDate || ''})`
            : 'Current Period Net Income',
          balance: Math.abs(netIncome),
          isNetIncome: true,
          sign: netIncome >= 0 ? 1 : -1
        });
      }

      return res.status(200).json({
        status: 200,
        data: {
          assets: bs.assets,
          liabilities: bs.liabilities,
          equity: equityFiltered,
          summary: {
            totalAssets: bs.totalAssets,
            totalLiabilities: bs.totalLiabilities,
            totalEquity: bs.totalEquity,
            totalLiabilitiesAndEquity: bs.totalLiabilitiesAndEquity,
            isBalanced: Math.abs(bs.totalAssets - bs.totalLiabilitiesAndEquity) < 0.001,
            periodLabel: startDate && endDate
              ? `${startDate} to ${endDate}`
              : startDate
              ? `From ${startDate}`
              : endDate
              ? `Up to ${endDate}`
              : 'All Time'
          }
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message, status: 500 } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
