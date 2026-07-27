import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { AccountingService } from "../../_services/accounting.service.js";
import { AccountingSyncService } from "../../_services/accounting-sync.service.js";
import { PERMS } from "../../_constants/permissions.js";
var cash_flow_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;
    const { startDate, endDate } = req.query || {};
    try {
      const data = await AccountingService.getCashFlow(startDate, endDate);
      AccountingSyncService.attachSyncHeaders(res);
      return res.status(200).json({
        status: 200,
        data
      });
    } catch (err) {
      return res.status(500).json({ error: { message: err.message, status: 500 } });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  cash_flow_default as default
};
