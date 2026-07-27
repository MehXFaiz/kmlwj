import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    // SQA fix (High): this endpoint previously had no permission check at all
    // — any authenticated user, regardless of role, could pull full ledger
    // data (all account activity and balances). Every sibling report endpoint
    // (trial-balance, balance-sheet, income-statement, cash-flow) requires
    // VIEW_REPORTS; this brings the General Ledger in line with them.
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
    const isSuperAdmin = user?.role.name === 'Super Admin';
    if (!isSuperAdmin && !userPerms.includes('VIEW_REPORTS')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    try {
      const { startDate, endDate, accountId, glCode, page, limit } = req.query as any;
      const ledgerResult = await AccountingService.getGeneralLedger({
        startDate,
        endDate,
        accountId,
        glCode,
        page,
        limit
      });

      return res.status(200).json({
        status: 200,
        data: {
          account: ledgerResult.account,
          summary: ledgerResult.summary,
          accountMeta: ledgerResult.accountMeta,
          entries: ledgerResult.entries
        },
        meta: {
          total: ledgerResult.total,
          page: ledgerResult.page,
          limit: ledgerResult.limit
        }
      });
    } catch (err: any) {
      const status = err.status || 500;
      return res.status(status).json({ error: { message: err.message, status } });
    }
  }

  if (req.method === 'POST') {
    return res.status(400).json({
      error: {
        message: 'Manual General Ledger entries are strictly prohibited. All General Ledger entries must be automatically generated from Journal Entries.',
        status: 400
      }
    });
  }

  if (req.method === 'DELETE') {
    // General Ledger entries are a read-only projection of JournalEntryLine rows
    // (via getPostedAggregates) and have no independent existence. The only
    // correct way to remove a posting is to delete or reverse its source Journal
    // Entry, which removes the JournalEntryLine rows the ledger is derived from.
    return res.status(400).json({
      error: {
        message: 'General Ledger entries cannot be deleted directly — they are automatically generated from Journal Entries. Delete or reverse the source Journal Entry instead.',
        status: 400
      }
    });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
