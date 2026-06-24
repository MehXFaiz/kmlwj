import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
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
    const pnlAccounts = await prisma.account.findMany({
      where: {
        accountType: {
          name: { in: ["REVENUE", "EXPENSE"] }
        },
        NOT: {
          currentBalance: 0
        }
      },
      include: {
        accountType: true
      },
      orderBy: { glCode: "asc" }
    });
    const revenues = [];
    const expenses = [];
    let totalRevenue = 0;
    let totalExpense = 0;
    for (const acc of pnlAccounts) {
      const type = acc.accountType?.name;
      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance: Math.abs(acc.currentBalance)
      };
      if (type === "REVENUE") {
        revenues.push(formatted);
        totalRevenue += acc.currentBalance * -1;
      } else if (type === "EXPENSE") {
        expenses.push(formatted);
        totalExpense += acc.currentBalance;
      }
    }
    const netIncome = totalRevenue - totalExpense;
    return res.status(200).json({
      status: 200,
      data: {
        revenues,
        expenses,
        summary: {
          totalRevenue,
          totalExpense,
          netIncome
        }
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  income_statement_default as default
};
