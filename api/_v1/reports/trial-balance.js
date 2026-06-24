import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
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
    const activeAccounts = await prisma.account.findMany({
      where: {
        NOT: {
          currentBalance: 0
        }
      },
      include: {
        accountType: true
      },
      orderBy: { glCode: "asc" }
    });
    let totalDebit = 0;
    let totalCredit = 0;
    const formatted = activeAccounts.map((acc) => {
      let debit = 0;
      let credit = 0;
      if (acc.currentBalance > 0) {
        debit = acc.currentBalance;
        totalDebit += debit;
      } else if (acc.currentBalance < 0) {
        credit = Math.abs(acc.currentBalance);
        totalCredit += credit;
      }
      return {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountType: acc.accountType?.name || "Unknown",
        debit,
        credit
      };
    });
    return res.status(200).json({
      status: 200,
      data: {
        entries: formatted,
        summary: {
          totalDebit,
          totalCredit,
          isBalanced: Math.abs(totalDebit - totalCredit) < 1e-3
        }
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  trial_balance_default as default
};
