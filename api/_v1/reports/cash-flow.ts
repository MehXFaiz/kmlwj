import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { AccountingService } from '../../_services/accounting.service.js';
import { AccountingSyncService } from '../../_services/accounting-sync.service.js';
import { PERMS } from '../../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;

    const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

    try {
      const data = await AccountingService.getCashFlow(startDate, endDate);
      AccountingSyncService.attachSyncHeaders(res);
      return res.status(200).json({
        status: 200,
        data
      });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message, status: 500 } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
