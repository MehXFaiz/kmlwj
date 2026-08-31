import { z } from "zod";
import { makeHandler } from "../../_utils/handler.js";
import { logger } from "../../_utils/logger.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { isAdminOrAbove } from "../../_utils/soft-delete.js";
import { prisma } from "../../_prisma.js";
import { PERMS } from "../../_constants/permissions.js";
import { classifyError, errDetails } from "../../_services/accounting.service.js";
import { getRepairOperation, findOperationForIssueType } from "../../_services/repair-operations.registry.js";
import { applyRepair, RepairInProgressError, RepairNotActionableError } from "../../_services/ai-repair-executor.service.js";
import { idSchema } from "../../_schemas/common.schema.js";
const bodySchema = z.object({
  issueId: idSchema,
  decision: z.enum(["approve", "reject"]),
  notes: z.string().optional()
});
var repair_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.APPLY_AI_REPAIR)) return;
  if (!await isAdminOrAbove(req)) {
    return res.status(403).json({ error: { message: "Applying or rejecting a repair requires an Admin-tier role.", status: 403 } });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const { issueId, decision, notes } = bodySchema.parse(req.body);
  try {
    const issue = await prisma.aiRepairIssue.findUnique({ where: { id: issueId } });
    if (!issue) {
      return res.status(404).json({ error: { message: "Issue not found.", status: 404 } });
    }
    if (!["OPEN", "ANALYZED", "PENDING_APPROVAL"].includes(issue.status)) {
      return res.status(409).json({ error: { message: `Issue is already ${issue.status.toLowerCase()}.`, status: 409 } });
    }
    if (decision === "reject") {
      await prisma.aiRepairIssue.update({ where: { id: issueId }, data: { status: "REJECTED" } });
      await prisma.aiRepairLog.create({
        data: {
          issueId,
          userId: req.user.id,
          action: "REPAIR_REJECTED",
          issueType: issue.type,
          repairType: issue.aiProposedRepairType || "NONE",
          rootCause: issue.aiRootCause,
          riskLevel: issue.aiRiskLevel || "MEDIUM",
          approvalStatus: "REJECTED",
          approvedById: req.user.id,
          rollbackStatus: "NOT_NEEDED",
          success: true,
          errorMessage: notes || null
        }
      });
      return res.status(200).json({ status: 200, message: "Issue rejected \u2014 no data was changed.", data: { issueId, decision } });
    }
    const op = getRepairOperation(issue.aiProposedRepairType) || findOperationForIssueType(issue.type);
    if (!op || !op.execute) {
      await prisma.aiRepairIssue.update({ where: { id: issueId }, data: { status: "RESOLVED", resolvedAt: /* @__PURE__ */ new Date() } });
      await prisma.aiRepairLog.create({
        data: {
          issueId,
          userId: req.user.id,
          action: "MANUAL_REVIEW_ACKNOWLEDGED",
          issueType: issue.type,
          repairType: "NONE",
          rootCause: issue.aiRootCause,
          riskLevel: issue.aiRiskLevel || "CRITICAL",
          approvalStatus: "ADMIN_APPROVED",
          approvedById: req.user.id,
          rollbackStatus: "NOT_NEEDED",
          success: true,
          errorMessage: notes || "Unable to safely auto-repair. Acknowledged for manual handling outside this system."
        }
      });
      return res.status(200).json({
        status: 200,
        message: "Unable to safely auto-repair. Admin review required \u2014 acknowledged, no data was changed.",
        data: { issueId, acknowledged: true }
      });
    }
    const result = await applyRepair(issueId, { approvedById: req.user.id, mode: "manual" });
    return res.status(result.success ? 200 : 422).json({
      status: result.success ? 200 : 422,
      message: result.success ? "Repair applied and validated successfully." : `Repair failed and was rolled back: ${result.errorMessage}`,
      data: result
    });
  } catch (error) {
    if (error instanceof RepairInProgressError) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    if (error instanceof RepairNotActionableError) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    logger.error({ err: errDetails(error) }, "AI Accounting: repair endpoint failed");
    const reason = classifyError(error);
    return res.status(500).json({ error: { message: `Failed to process repair decision: ${reason}`, status: 500 } });
  }
});
export {
  repair_default as default
};
