
import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { AccountingIntegrityService } from '../_services/accounting-integrity.service.js';
import { PERMS } from '../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  if (!await verifyPermission(req, res, PERMS.VIEW_AUDIT)) return;

  try {
    const result = await AccountingIntegrityService.runFullCheck();
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      error: {
        message: 'Failed to run accounting integrity check',
        details: error?.message,
        status: 500,
      },
    });
  }
});
