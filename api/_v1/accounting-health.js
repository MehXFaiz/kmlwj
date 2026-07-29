import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { AccountingIntegrityService } from "../_services/accounting-integrity.service.js";
import { AccountingService } from "../_services/accounting.service.js";
import { prisma } from "../_prisma.js";
import { PERMS } from "../_constants/permissions.js";
var accounting_health_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    if (!await verifyPermission(req, res, PERMS.VIEW_AUDIT)) return;
    try {
      const result = await AccountingIntegrityService.runFullCheck();
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        error: {
          message: "Failed to run accounting integrity check",
          details: error?.message,
          status: 500
        }
      });
    }
  }
  if (req.method === "POST") {
    const action = String(req.query.action || req.body?.action || "rebuild-balances");
    if (action !== "rebuild-balances") {
      return res.status(400).json({ error: { message: `Unknown action '${action}'`, status: 400 } });
    }
    if (!await verifyPermission(req, res, PERMS.UPDATE_ACCOUNT)) return;
    const accountId = req.query.accountId || req.body?.accountId;
    try {
      const before = await AccountingIntegrityService.runFullCheck();
      const driftBefore = before.issues.filter((i) => i.type === "cached_balance_drift").length;
      let updated = 0;
      if (accountId) {
        await prisma.$transaction(async (tx) => {
          await AccountingService.recalculateAccountBalance(tx, accountId);
        });
        updated = 1;
      } else {
        ({ updated } = await AccountingService.recalculateAllBalances());
      }
      const after = await AccountingIntegrityService.runFullCheck();
      const driftAfter = after.issues.filter((i) => i.type === "cached_balance_drift").length;
      return res.status(200).json({
        status: 200,
        message: accountId ? "Account balance repaired from the general ledger" : "All account balances rebuilt from the general ledger",
        data: {
          accountsUpdated: updated,
          driftBefore,
          driftAfter,
          remainingIssues: after.totalIssues
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: {
          message: "Failed to rebuild account balances",
          details: error?.message,
          status: 500
        }
      });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  accounting_health_default as default
};
