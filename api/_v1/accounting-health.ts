
import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { logger } from '../_utils/logger.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { AccountingIntegrityService } from '../_services/accounting-integrity.service.js';
import { AccountingService, classifyError, errDetails } from '../_services/accounting.service.js';
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
      logger.error({ err: errDetails(error) }, 'Accounting Health Check: runFullCheck failed');
      const reason = classifyError(error);
      return res.status(500).json({
        error: {
          message: `Failed to run accounting integrity check: ${reason}`,
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

    const action = (req.query?.action || req.body?.action) as string;

    try {
      if (action === 'sync-all' || action === 'sync' || action === 'sync-modules') {
        const syncResult = await AccountingService.syncAllModulesToLedger(prisma);
        return res.status(200).json({
          status: 200,
          message: 'All operational modules synchronized to General Ledger successfully',
          data: syncResult
        });
      }

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
          // Richer fields the Health Check API now returns (accounts
          // checked/repaired/skipped, warnings fixed, execution time, and
          // the structured per-item repaired/skipped lists) — the current
          // page only renders actionsTaken/issuesBefore/issuesAfter, but the
          // API contract carries the full detail for any future UI, and it's
          // already folded into actionsTaken as readable strings today.
          accountsChecked: repairResult.accountsChecked,
          accountsRepaired: repairResult.accountsRepaired,
          accountsUpdated: repairResult.accountsUpdated,
          accountsSkipped: repairResult.accountsSkipped,
          warningsFixed: repairResult.warningsFixed,
          executionTimeMs: repairResult.executionTimeMs,
          repairedItems: repairResult.repairedItems,
          skippedItems: repairResult.skippedItems,
          timestamp: repairResult.checkAfter.timestamp
        },
      });
    } catch (error: any) {
      // Every item-level failure inside repairAll() is already caught,
      // logged, and recorded in skippedItems — reaching here means a total
      // infrastructure failure (DB connection drop, etc.), not a single bad
      // account. Still never a generic message: classify it and log the full
      // SQL/Prisma error, code, meta, and stack before responding.
      logger.error({ err: errDetails(error) }, 'Accounting Health Check: repairAll failed entirely');
      const reason = classifyError(error);
      return res.status(500).json({
        error: {
          message: `Failed to execute accounting integrity repair: ${reason}. See server logs for full details.`,
          details: error?.message,
          status: 500,
        },
      });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
