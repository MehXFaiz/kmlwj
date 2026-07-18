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
    const { startDate, endDate } = req.query || {};
    const activeAccounts = await prisma.account.findMany({
      include: {
        accountType: true
      },
      orderBy: { glCode: "asc" }
    });
    let totalDebit = 0;
    let totalCredit = 0;
    let openingRetainedEarnings = 0;
    const formatted = [];
    for (const acc of activeAccounts) {
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
        const d = Number(agg._sum.debit) || 0;
        const c = Number(agg._sum.credit) || 0;
        const typeName2 = (acc.accountType?.name || "").toUpperCase();
        const isDebitNormal2 = ["ASSET", "EXPENSE"].includes(typeName2);
        const isPnl = ["REVENUE", "EXPENSE"].includes(typeName2);
        if (isPnl) {
          balance = isDebitNormal2 ? d - c : c - d;
        } else {
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            const cumAgg = await prisma.ledgerEntry.aggregate({
              where: { accountId: acc.id, postingDate: { lte: end } },
              _sum: { debit: true, credit: true }
            });
            const cd = Number(cumAgg._sum.debit) || 0;
            const cc = Number(cumAgg._sum.credit) || 0;
            const initBal = Number(acc.initialBalance) || 0;
            balance = isDebitNormal2 ? initBal + cd - cc : initBal + cc - cd;
          }
        }
      }
      if (balance === 0) continue;
      const typeName = acc.accountType?.name?.toUpperCase() || "ASSET";
      const isDebitNormal = ["ASSET", "EXPENSE"].includes(typeName);
      let debit = 0;
      let credit = 0;
      if (isDebitNormal) {
        if (balance > 0) {
          debit = balance;
        } else if (balance < 0) {
          credit = Math.abs(balance);
        }
      } else {
        if (balance > 0) {
          credit = balance;
        } else if (balance < 0) {
          debit = Math.abs(balance);
        }
      }
      totalDebit += debit;
      totalCredit += credit;
      formatted.push({
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountType: acc.accountType?.name || "Unknown",
        debit,
        credit
      });
    }
    if (startDate) {
      const start = new Date(startDate);
      for (const acc of activeAccounts) {
        const typeName = (acc.accountType?.name || "").toUpperCase();
        if (!["REVENUE", "EXPENSE"].includes(typeName)) continue;
        const priorAgg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: { lt: start }
          },
          _sum: { debit: true, credit: true }
        });
        const d = Number(priorAgg._sum.debit) || 0;
        const c = Number(priorAgg._sum.credit) || 0;
        openingRetainedEarnings += typeName === "REVENUE" ? c - d : (d - c) * -1;
      }
    }
    if (startDate && openingRetainedEarnings !== 0) {
      let debit = 0;
      let credit = 0;
      if (openingRetainedEarnings > 0) {
        credit = openingRetainedEarnings;
      } else {
        debit = Math.abs(openingRetainedEarnings);
      }
      totalDebit += debit;
      totalCredit += credit;
      formatted.push({
        id: "virtual-opening-retained-earnings",
        glCode: "-",
        accountName: `Opening Retained Earnings (before ${startDate})`,
        accountType: "EQUITY",
        debit,
        credit
      });
    }
    return res.status(200).json({
      status: 200,
      data: {
        entries: formatted,
        summary: {
          totalDebit,
          totalCredit,
          isBalanced: Math.abs(totalDebit - totalCredit) < 1e-3,
          periodLabel: startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : "All Time"
        }
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  trial_balance_default as default
};
