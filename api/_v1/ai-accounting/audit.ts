import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { logger } from '../../_utils/logger.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { PERMS } from '../../_constants/permissions.js';
import { classifyError, errDetails } from '../../_services/accounting.service.js';
import { AiReconciliationService } from '../../_services/ai-reconciliation.service.js';

/**
 * "Run Full Audit" — runs the deterministic reconciliation engine (legacy 10
 * checks + the new expanded checks) and persists the result into
 * AiRepairIssue. Purely deterministic; no AI involved at this step.
 */
export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!(await verifyPermission(req, res, PERMS.VIEW_AUDIT))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  try {
    const result = await AiReconciliationService.runFullReconciliation();
    return res.status(200).json({ status: 200, message: 'Full accounting reconciliation audit completed', data: result });
  } catch (error: any) {
    logger.error({ err: errDetails(error) }, 'AI Accounting: runFullReconciliation failed');
    const reason = classifyError(error);
    return res.status(500).json({ error: { message: `Failed to run accounting audit: ${reason}`, status: 500 } });
  }
});
