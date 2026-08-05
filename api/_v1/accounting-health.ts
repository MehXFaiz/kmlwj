
import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { AccountingIntegrityService } from '../_services/accounting-integrity.service.js';
import { AccountingService } from '../_services/accounting.service.js';
import { prisma } from '../_prisma.js';
import { PERMS } from '../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
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
  }

  /**
   * POST ?action=rebuild-balances — the "Rebuild Account Balances" / "Repair"
   * action behind the System Integrity page.
   *
   * Recomputes Account.currentBalance for every posting account straight from
   * the posted journal lines, so any historical drift is erased in one pass.
   * The whole rebuild runs in a single transaction: either every account ends
   * up consistent with the ledger or nothing changes.
   *
   * Pass ?accountId=<id> to repair a single drifted account instead of all.
   */
  if (req.method === 'POST') {
    if (!await verifyPermission(req, res, PERMS.UPDATE_ACCOUNT)) return;

    try {
      const repairResult = await AccountingIntegrityService.repairAll();

      return res.status(200).json({
        status: 200,
        message: 'Complete accounting system integrity repair executed successfully',
        data: {
          success: repairResult.success,
          actionsTaken: repairResult.actionsTaken,
          issuesBefore: repairResult.checkBefore.totalIssues,
          issuesAfter: repairResult.checkAfter.totalIssues,
          criticalBefore: repairResult.checkBefore.criticalCount,
          criticalAfter: repairResult.checkAfter.criticalCount,
          warningBefore: repairResult.checkBefore.warningCount,
          warningAfter: repairResult.checkAfter.warningCount,
          timestamp: repairResult.checkAfter.timestamp
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        error: {
          message: 'Failed to execute accounting integrity repair',
          details: error?.message,
          status: 500,
        },
      });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
