import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { AccountingService } from '../../_services/accounting.service.js';
import { PERMS } from '../../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;

    // Optional date range filter
    const { startDate, endDate } = (req.query || {}) as { startDate?: string; endDate?: string };

    try {
      // Stamped with the ledger version it was computed from — see
      // AccountingService.computeWithLedgerVersion. The Dashboard reconciles its
      // summary against this report only when both carry the same version, so a
      // write landing between the two requests can no longer masquerade as an
      // accounting discrepancy.
      const { result: tb, ledgerVersion } = await AccountingService.computeWithLedgerVersion(
        () => AccountingService.getTrialBalance(startDate, endDate)
      );

      const entriesMapped = tb.accounts.map(acc => {
        if (acc.id === 'retained-earnings-opening-diff') {
          return {
            id: 'virtual-opening-retained-earnings',
            glCode: '-',
            accountName: `Opening Retained Earnings (before ${startDate})`,
            accountType: 'EQUITY',
            debit: acc.debit,
            credit: acc.credit
          };
        }
        return {
          id: acc.id,
          glCode: acc.glCode,
          accountName: acc.accountName,
          accountType: acc.accountType,
          detailType: acc.detailType,
          debit: acc.debit,
          credit: acc.credit
        };
      });

      return res.status(200).json({
        status: 200,
        data: {
          ledgerVersion,
          reportPeriod: { startDate: startDate ?? null, endDate: endDate ?? null },
          entries: entriesMapped,
          summary: {
            totalDebit: tb.totalDebit,
            totalCredit: tb.totalCredit,
            isBalanced: tb.difference === 0,
            periodLabel: startDate && endDate
              ? `${startDate} to ${endDate}`
              : startDate
              ? `From ${startDate}`
              : endDate
              ? `Up to ${endDate}`
              : 'All Time'
          },
          // Opening (as of startDate, or account inception if unset) and
          // Closing (as of endDate, or now if unset) balances for Cash in
          // Hand, every Bank, Advance & Loan, Receivable, and Other Assets.
          // Computed entirely in AccountingService.getTrialBalance from
          // posted JournalEntryLine rows — never cached, never hardcoded.
          openingBalances: tb.openingBalances,
          closingBalances: tb.closingBalances
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err.message, status: 500 } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
