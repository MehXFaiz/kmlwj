import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { AccountingService } from "../../_services/accounting.service.js";
var income_statement_default = makeHandler(async (req, res) => {
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
      const pnl = await AccountingService.getIncomeStatement(startDate, endDate);
      return res.status(200).json({
        status: 200,
        data: {
          revenues: pnl.revenues,
          expenses: pnl.expenses,
          summary: {
            totalRevenue: pnl.totalRevenue,
            totalExpense: pnl.totalExpense,
            netIncome: pnl.netProfit,
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
  income_statement_default as default
};
