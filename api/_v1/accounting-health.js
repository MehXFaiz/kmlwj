import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { AccountingIntegrityService } from "../_services/accounting-integrity.service.js";
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
      return res.status(500).json({
        error: {
          message: "Failed to run accounting integrity check",
          details: error?.message,
          status: 500
        }
      });
    }
  }
  if (req.method === "POST") {
    if (!await verifyPermission(req, res, PERMS.UPDATE_ACCOUNT)) return;
    try {
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
          timestamp: repairResult.checkAfter.timestamp
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: {
          message: "Failed to execute accounting integrity repair",
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
