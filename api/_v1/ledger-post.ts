import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { isPrivilegedUser } from '../_services/permission.service.js';
import { PERMS } from '../_constants/permissions.js';
import { LedgerWorkflowService } from '../_services/ledger-workflow.service.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'POST' || req.method === 'PUT') {
    const action = (req.query.action || req.body?.action || 'post') as string;
    const { module, recordId, reason } = req.body || {};

    if (!module || !recordId) {
      return res.status(400).json({
        error: { message: 'Module name and Record ID are required fields', status: 400 }
      });
    }

    if (action === 'revert' || action === 'revert-ledger') {
      if (!await isPrivilegedUser(req)) {
        return res.status(403).json({
          error: { message: 'Forbidden: Only Admin and Super Admin can revert ledger entries', status: 403 }
        });
      }

      try {
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
      } catch (err: any) {
        const status = err.status || err.statusCode || 400;
        return res.status(status).json({
          error: { message: err.message || 'Ledger workflow operation failed', status }
        });
      }
    } else {
      // POST TO LEDGER: requires module-specific post permission (e.g. donations.post) or global ledger.post
      const moduleStr = typeof module === 'string' ? module.trim() : '';
      const requiredPerms: string[] = [PERMS.POST_LEDGER, 'ledger.post'];
      if (moduleStr) {
        requiredPerms.unshift(`${moduleStr}.post`);
        if (moduleStr.toLowerCase() !== moduleStr) {
          requiredPerms.unshift(`${moduleStr.toLowerCase()}.post`);
        }
      }
      if (!await verifyPermission(req, res, requiredPerms)) return;

      try {
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
      } catch (err: any) {
        const status = err.status || err.statusCode || (err.message?.includes('already posted') ? 409 : 400);
        return res.status(status).json({
          error: { message: err.message || 'Ledger workflow operation failed', status }
        });
      }
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
