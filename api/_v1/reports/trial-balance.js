import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { AccountingService } from "../../_services/accounting.service.js";
import { PERMS } from "../../_constants/permissions.js";
var trial_balance_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;
    const { startDate, endDate } = req.query || {};
    try {
      const tb = await AccountingService.getTrialBalance(startDate, endDate);
      const entriesMapped = tb.accounts.map((acc) => {
        if (acc.id === "retained-earnings-opening-diff") {
          return {
            id: "virtual-opening-retained-earnings",
            glCode: "-",
            accountName: `Opening Retained Earnings (before ${startDate})`,
            accountType: "EQUITY",
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
          entries: entriesMapped,
          summary: {
            totalDebit: tb.totalDebit,
            totalCredit: tb.totalCredit,
            isBalanced: tb.difference === 0,
            periodLabel: startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : "All Time"
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
    } catch (err) {
      return res.status(500).json({ error: { message: err.message, status: 500 } });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  trial_balance_default as default
};
