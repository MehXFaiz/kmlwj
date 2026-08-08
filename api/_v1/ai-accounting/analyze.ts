import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { logger } from '../../_utils/logger.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { isAdminOrAbove } from '../../_utils/soft-delete.js';
import { prisma } from '../../_prisma.js';
import { PERMS } from '../../_constants/permissions.js';
import { classifyError, errDetails } from '../../_services/accounting.service.js';
import { getAiProvider } from '../../_services/ai-provider.service.js';
import { getRepairOperation } from '../../_services/repair-operations.registry.js';

const MAX_PER_CALL = 25;

/**
 * "AI Analyze Issues" — sends up to MAX_PER_CALL open issues to the AI
 * provider for root-cause explanation, confidence, risk classification, and
 * a proposed repair type (constrained to the fixed operation registry). The
 * AI never writes financial data — only these advisory fields on the issue.
 */
export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!(await verifyPermission(req, res, PERMS.RUN_AI_AUDIT))) return;
  if (!(await isAdminOrAbove(req))) {
    return res.status(403).json({ error: { message: 'AI analysis requires an Admin-tier role.', status: 403 } });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const provider = getAiProvider();
  if (!provider) {
    return res.status(200).json({
      status: 200,
      message: 'AI provider not configured — set OPENROUTER_API_KEY to enable AI analysis.',
      data: { configured: false, analyzed: [], failed: [] },
    });
  }

  try {
    const body = (req.body || {}) as { issueIds?: string[] };
    const where: any = Array.isArray(body.issueIds) && body.issueIds.length > 0
      ? { id: { in: body.issueIds } }
      : { status: 'OPEN' };

    const issues = await prisma.aiRepairIssue.findMany({ where, take: MAX_PER_CALL, orderBy: { detectedAt: 'desc' } });

    const analyzed: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const issue of issues) {
      try {
        const analysis = await provider.analyzeIssue({
          type: issue.type,
          severity: issue.severity,
          description: issue.description,
          entityRef: issue.entityRef,
          currentValue: issue.currentValue ? Number(issue.currentValue) : null,
          expectedValue: issue.expectedValue ? Number(issue.expectedValue) : null,
          difference: issue.difference ? Number(issue.difference) : null,
          affectedRecords: issue.affectedRecords,
        });

        const op = getRepairOperation(analysis.proposedRepairType);
        const nextStatus = op && !op.autoExecutable ? 'PENDING_APPROVAL' : 'ANALYZED';

        await prisma.aiRepairIssue.update({
          where: { id: issue.id },
          data: {
            aiRootCause: analysis.rootCause,
            aiExplanation: analysis.explanation,
            aiConfidence: analysis.confidence,
            aiRiskLevel: analysis.riskLevel,
            aiProposedRepairType: op ? analysis.proposedRepairType : null,
            aiProposedChange: { description: analysis.proposedChangeDescription } as any,
            aiModel: analysis.model,
            aiAnalyzedAt: new Date(),
            status: nextStatus,
          },
        });
        analyzed.push(issue.id);
      } catch (err: any) {
        logger.error({ err: errDetails(err) }, `AI Accounting: analyze failed for issue ${issue.id}`);
        failed.push({ id: issue.id, error: err?.message || 'AI analysis failed' });
      }
    }

    return res.status(200).json({
      status: 200,
      message: `Analyzed ${analyzed.length} of ${issues.length} issue(s).`,
      data: { configured: true, analyzed, failed, totalCandidates: issues.length },
    });
  } catch (error: any) {
    logger.error({ err: errDetails(error) }, 'AI Accounting: analyze endpoint failed');
    const reason = classifyError(error);
    return res.status(500).json({ error: { message: `Failed to run AI analysis: ${reason}`, status: 500 } });
  }
});
