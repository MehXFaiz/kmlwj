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
    const { startDate, endDate } = req.query || {};
    const pnlAccounts = await prisma.account.findMany({
      where: {
        accountType: {
          name: { in: ["REVENUE", "EXPENSE"] }
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
      let balance = acc.currentBalance;
      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.lte = end;
        }
        const agg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: dateFilter
          },
          _sum: { debit: true, credit: true }
        });
        const totalDebit = Number(agg._sum.debit) || 0;
        const totalCredit = Number(agg._sum.credit) || 0;
        if (type === "REVENUE") {
          balance = totalCredit - totalDebit;
        } else if (type === "EXPENSE") {
          balance = totalDebit - totalCredit;
        }
      }
      if (balance === 0) continue;
      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance
      };
      if (type === "REVENUE") {
        revenues.push(formatted);
        totalRevenue += balance;
      } else if (type === "EXPENSE") {
        expenses.push(formatted);
        totalExpense += balance;
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
          netIncome,
          // Include filter metadata so UI can label the report correctly
          periodLabel: startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : "All Time"
        }
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  income_statement_default as default
};
