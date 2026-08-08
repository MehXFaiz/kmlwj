import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { logger } from '../../_utils/logger.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { isAdminOrAbove } from '../../_utils/soft-delete.js';
import { prisma } from '../../_prisma.js';
import { PERMS } from '../../_constants/permissions.js';
import { classifyError, errDetails } from '../../_services/accounting.service.js';
import { getRepairOperation, findOperationForIssueType } from '../../_services/repair-operations.registry.js';
import { applyRepair, RepairInProgressError } from '../../_services/ai-repair-executor.service.js';

/**
 * "Safe Auto-Repair" — applies only operations whose registry ceiling is
 * LOW risk + autoExecutable, regardless of whether AI has analyzed the issue
 * yet (the issue TYPE alone is enough to resolve an eligible operation for
 * these five deterministic operations). Every issue type without such an
 * operation is left untouched — never silently "fixed."
 */
export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!(await verifyPermission(req, res, PERMS.APPLY_AI_REPAIR))) return;
  if (!(await isAdminOrAbove(req))) {
    return res.status(403).json({ error: { message: 'Auto-repair requires an Admin-tier role.', status: 403 } });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  try {
    const candidates = await prisma.aiRepairIssue.findMany({
      where: { status: { in: ['OPEN', 'ANALYZED', 'PENDING_APPROVAL'] } },
    });

    const eligible = candidates.filter((issue) => {
      const op = getRepairOperation(issue.aiProposedRepairType) || findOperationForIssueType(issue.type);
      return op?.autoExecutable && op.maxRiskLevel === 'LOW';
    });

    const applied: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const issue of eligible) {
      // Ensure the issue actually carries a resolvable repair type before
      // handing it to the executor (auto-repair may be reaching an issue
      // that was never analyzed, so backfill from the type-level fallback).
      if (!issue.aiProposedRepairType) {
        const fallback = findOperationForIssueType(issue.type);
        if (fallback) {
          await prisma.aiRepairIssue.update({ where: { id: issue.id }, data: { aiProposedRepairType: fallback.key } });
        }
      }
      const result = await applyRepair(issue.id, { mode: 'auto' });
      if (result.success) applied.push(issue.id);
      else failed.push({ id: issue.id, error: result.errorMessage || 'Repair failed' });
    }

    return res.status(200).json({
      status: 200,
      message: `Safe auto-repair applied ${applied.length} of ${eligible.length} eligible issue(s).`,
      data: { totalOpenIssues: candidates.length, eligibleCount: eligible.length, applied, failed },
    });
  } catch (error: any) {
    if (error instanceof RepairInProgressError) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    logger.error({ err: errDetails(error) }, 'AI Accounting: auto-repair failed');
    const reason = classifyError(error);
    return res.status(500).json({ error: { message: `Failed to run safe auto-repair: ${reason}`, status: 500 } });
  }
});
