import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { LedgerWorkflowService } from '../_services/ledger-workflow.service.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const isAdminOrSuperAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin';
  if (!isAdminOrSuperAdmin) {
    return res.status(403).json({
      error: { message: 'Forbidden: Only Admin and Super Admin can Post or Revert ledger entries', status: 403 }
    });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const action = (req.query.action || req.body?.action || 'post') as string;
    const { module, recordId, reason } = req.body || {};

    if (!module || !recordId) {
      return res.status(400).json({
        error: { message: 'Module name and Record ID are required fields', status: 400 }
      });
    }

    try {
      if (action === 'revert' || action === 'revert-ledger') {
        const result = await LedgerWorkflowService.revertPosting({
          module,
          recordId,
          userId: req.user.id,
          reason,
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent']
        });
        return res.status(200).json({
          status: 200,
          message: 'Transaction posting reverted successfully from General Ledger',
          data: result
        });
      } else {
        const result = await LedgerWorkflowService.postToLedger({
          module,
          recordId,
          userId: req.user.id,
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent']
        });
        return res.status(200).json({
          status: 200,
          message: 'Transaction posted successfully to the General Ledger',
          data: result
        });
      }
    } catch (err: any) {
      return res.status(400).json({
        error: { message: err.message || 'Ledger workflow operation failed', status: 400 }
      });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
