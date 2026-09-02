import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { ErpResetService, ErpResetMode } from '../../_services/erp-reset.service.js';
import { prisma } from '../../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  // 1. Verify User Authentication
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  // 2. Strict Database-level Super Admin Verification
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: true },
  });

  const roleName = user?.role?.name;
  const isSuperAdmin = roleName === 'Super Admin' || roleName === 'SUPER ADMIN';

  if (!isSuperAdmin) {
    return res.status(403).json({
      error: {
        message: 'Forbidden: Only Super Admin can access ERP Reset features.',
        status: 403,
      },
    });
  }

  const url = req.url || '';
  const isPreview = url.includes('/preview') || req.query.action === 'preview';
  const isHistory = url.includes('/history') || req.query.action === 'history';

  // 3. GET /preview or GET /history
  if (req.method === 'GET') {
    if (isHistory) {
      const history = await ErpResetService.getResetHistory(Number(req.query.limit) || 20);
      return res.status(200).json({
        status: 200,
        data: history,
      });
    }

    // Default to preview
    const mode = (req.query.mode as ErpResetMode) || 'TRANSACTIONS_ONLY';
    const preview = await ErpResetService.getResetPreview(mode);
    return res.status(200).json({
      status: 200,
      data: preview,
    });
  }

  // 4. POST Execution
  if (req.method === 'POST') {
    const { password, confirmationText, resetMode } = req.body || {};

    try {
      const result = await ErpResetService.executeReset({
        userId: req.user.id,
        resetMode: resetMode || 'TRANSACTIONS_ONLY',
        password,
        confirmationText,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      return res.status(200).json({
        status: 200,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      const status = error.status || 500;
      return res.status(status).json({
        error: {
          message: error.message || 'ERP Data Reset failed',
          code: error.code || 'RESET_FAILED',
          status,
        },
      });
    }
  }

  return res.status(405).json({
    error: { message: 'Method Not Allowed', status: 405 },
  });
});
