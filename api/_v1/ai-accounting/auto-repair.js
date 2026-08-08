import { makeHandler } from "../../_utils/handler.js";
import { logger } from "../../_utils/logger.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { isAdminOrAbove } from "../../_utils/soft-delete.js";
import { prisma } from "../../_prisma.js";
import { PERMS } from "../../_constants/permissions.js";
import { classifyError, errDetails } from "../../_services/accounting.service.js";
import { getRepairOperation, findOperationForIssueType } from "../../_services/repair-operations.registry.js";
import { applyRepair, RepairInProgressError } from "../../_services/ai-repair-executor.service.js";
var auto_repair_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.APPLY_AI_REPAIR)) return;
  if (!await isAdminOrAbove(req)) {
    return res.status(403).json({ error: { message: "Auto-repair requires an Admin-tier role.", status: 403 } });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  try {
    const candidates = await prisma.aiRepairIssue.findMany({
      where: { status: { in: ["OPEN", "ANALYZED", "PENDING_APPROVAL"] } }
    });
    const eligible = candidates.filter((issue) => {
      const op = getRepairOperation(issue.aiProposedRepairType) || findOperationForIssueType(issue.type);
      return op?.autoExecutable && op.maxRiskLevel === "LOW";
    });
    const applied = [];
    const failed = [];
    for (const issue of eligible) {
      if (!issue.aiProposedRepairType) {
        const fallback = findOperationForIssueType(issue.type);
        if (fallback) {
          await prisma.aiRepairIssue.update({ where: { id: issue.id }, data: { aiProposedRepairType: fallback.key } });
        }
      }
      const result = await applyRepair(issue.id, { mode: "auto" });
      if (result.success) applied.push(issue.id);
      else failed.push({ id: issue.id, error: result.errorMessage || "Repair failed" });
    }
    return res.status(200).json({
      status: 200,
      message: `Safe auto-repair applied ${applied.length} of ${eligible.length} eligible issue(s).`,
      data: { totalOpenIssues: candidates.length, eligibleCount: eligible.length, applied, failed }
    });
  } catch (error) {
    if (error instanceof RepairInProgressError) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    logger.error({ err: errDetails(error) }, "AI Accounting: auto-repair failed");
    const reason = classifyError(error);
    return res.status(500).json({ error: { message: `Failed to run safe auto-repair: ${reason}`, status: 500 } });
  }
});
export {
  auto_repair_default as default
};
