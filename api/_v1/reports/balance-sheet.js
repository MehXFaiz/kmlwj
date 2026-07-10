import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
var balance_sheet_default = makeHandler(async (req, res) => {
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
    const allAccounts = await prisma.account.findMany({
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
    const assets = [];
    const liabilities = [];
    const equity = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpense = 0;
    for (const acc of allAccounts) {
      const type = acc.accountType?.name;
      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance: acc.currentBalance
      };
      if (type === "ASSET") {
        assets.push(formatted);
        totalAssets += acc.currentBalance;
      } else if (type === "LIABILITY") {
        liabilities.push(formatted);
        totalLiabilities += acc.currentBalance;
      } else if (type === "EQUITY") {
        equity.push(formatted);
        totalEquity += acc.currentBalance;
      } else if (type === "REVENUE") {
        totalRevenue += acc.currentBalance;
      } else if (type === "EXPENSE") {
        totalExpense += acc.currentBalance;
      }
    }
    const netIncome = totalRevenue - totalExpense;
    totalEquity += netIncome;
    if (netIncome !== 0) {
      equity.push({
        id: "virtual-net-income",
        glCode: "-",
        accountName: "Current Year Net Income",
        balance: Math.abs(netIncome),
        isNetIncome: true,
        sign: netIncome >= 0 ? 1 : -1
      });
    }
    return res.status(200).json({
      status: 200,
      data: {
        assets,
        liabilities,
        equity,
        summary: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
          isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1e-3
        }
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  balance_sheet_default as default
};
