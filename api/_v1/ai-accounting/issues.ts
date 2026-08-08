import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { logger } from '../../_utils/logger.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';
import { PERMS } from '../../_constants/permissions.js';
import { classifyError, errDetails } from '../../_services/accounting.service.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!(await verifyPermission(req, res, PERMS.VIEW_AUDIT))) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  try {
    const { status, severity, type, limit = '100', page = '1' } = req.query as any;
    const limitNum = Math.min(parseInt(limit) || 100, 500);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = { in: String(status).split(',') };
    else where.status = { in: ['OPEN', 'ANALYZED', 'PENDING_APPROVAL'] };
    if (severity) where.severity = { in: String(severity).split(',') };
    if (type) where.type = { in: String(type).split(',') };

    const [issues, total] = await Promise.all([
      prisma.aiRepairIssue.findMany({ where, skip, take: limitNum, orderBy: [{ detectedAt: 'desc' }] }),
      prisma.aiRepairIssue.count({ where }),
    ]);

    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    issues.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return res.status(200).json({
      status: 200,
      data: issues,
      meta: { total, page: pageNum, limit: limitNum },
    });
  } catch (error: any) {
    logger.error({ err: errDetails(error) }, 'AI Accounting: failed to list issues');
    const reason = classifyError(error);
    return res.status(500).json({ error: { message: `Failed to list AI accounting issues: ${reason}`, status: 500 } });
  }
});
