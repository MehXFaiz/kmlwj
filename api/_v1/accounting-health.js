import { makeHandler } from "../_utils/handler.js";
import { logger } from "../_utils/logger.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { AccountingIntegrityService } from "../_services/accounting-integrity.service.js";
import { AccountingService, classifyError, errDetails } from "../_services/accounting.service.js";
import { prisma } from "../_prisma.js";
import { PERMS } from "../_constants/permissions.js";
var accounting_health_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    if (!await verifyPermission(req, res, PERMS.VIEW_AUDIT)) return;
    try {
      const result = await AccountingIntegrityService.runFullCheck();
      return res.status(200).json(result);
    } catch (error) {
      logger.error({ err: errDetails(error) }, "Accounting Health Check: runFullCheck failed");
      const reason = classifyError(error);
      return res.status(500).json({
        error: {
          message: `Failed to run accounting integrity check: ${reason}`,
          details: error?.message,
          status: 500
        }
      });
    }
  }
  if (req.method === "POST") {
    if (!await verifyPermission(req, res, PERMS.UPDATE_ACCOUNT)) return;
    const action = req.query?.action || req.body?.action;
    try {
      if (action === "sync-all" || action === "sync" || action === "sync-modules") {
        const syncResult = await AccountingService.syncAllModulesToLedger(prisma);
        return res.status(200).json({
          status: 200,
          message: "All operational modules synchronized to General Ledger successfully",
          data: syncResult
        });
      }
      const repairResult = await AccountingIntegrityService.repairAll();
      return res.status(200).json({
        status: 200,
        message: "Complete accounting system integrity repair executed successfully",
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
        }
      });
    } catch (error) {
      logger.error({ err: errDetails(error) }, "Accounting Health Check: repairAll failed entirely");
      const reason = classifyError(error);
      return res.status(500).json({
        error: {
          message: `Failed to execute accounting integrity repair: ${reason}. See server logs for full details.`,
          details: error?.message,
          status: 500
        }
      });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  accounting_health_default as default
};
