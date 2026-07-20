import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { AccountingService } from "../../_services/accounting.service.js";
var trial_balance_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
    });
    const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
    const isSuperAdmin = user?.role.name === "Super Admin";
    if (!isSuperAdmin && !userPerms.includes("VIEW_REPORTS")) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
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
            isBalanced: tb.difference < 1e-3,
            periodLabel: startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : "All Time"
          }
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
