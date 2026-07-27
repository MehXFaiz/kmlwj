import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { AccountingService } from '../../_services/accounting.service.js';
import { PERMS } from '../../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;

    // Optional date range filter
    const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

    try {
      const pnl = await AccountingService.getIncomeStatement(startDate, endDate);

      return res.status(200).json({
        status: 200,
        data: {
          revenues: pnl.revenues,
          expenses: pnl.expenses,
          summary: {
            totalRevenue: pnl.totalRevenue,
            totalExpense: pnl.totalExpense,
            netIncome: pnl.netProfit,
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
