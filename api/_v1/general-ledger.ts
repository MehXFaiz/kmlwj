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
    // General Ledger entries are derived from Journal Entry lines and have no independent
    // existence — recalculateAccountBalance always re-derives Account.currentBalance from
    // JournalEntryLine, so deleting a LedgerEntry row alone cannot correctly adjust the balance
    // (the untouched JournalEntryLine rows immediately overwrite any manual adjustment on the
    // next recalculation). Deleting/reversing the source Journal Entry is the only correct way
    // to remove a posting, since that path also removes the JournalEntryLine rows it derives from.
    return res.status(400).json({
      error: {
        message: 'General Ledger entries cannot be deleted directly — they are automatically generated from Journal Entries. Delete or reverse the source Journal Entry instead.',
        status: 400
      }
    });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
