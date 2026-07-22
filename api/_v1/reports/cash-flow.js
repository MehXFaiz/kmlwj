import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
var cash_flow_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    let classifyCashFlowCategory2 = function(accountName, accountTypeName) {
      const name = accountName.toLowerCase();
      const type = (accountTypeName || "").toUpperCase();
      const investingKeywords = ["fixed asset", "investment", "property", "equipment", "vehicle", "furniture", "building", "long-term"];
      const financingKeywords = ["loan", "equity", "capital", "owner", "borrowing", "share"];
      if (investingKeywords.some((k) => name.includes(k))) return "Investing";
      if (financingKeywords.some((k) => name.includes(k)) || type === "EQUITY") return "Financing";
      if (type === "LIABILITY" && financingKeywords.some((k) => name.includes(k))) return "Financing";
      return "Operating";
    };
    var classifyCashFlowCategory = classifyCashFlowCategory2;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
    });
    const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
    const isSuperAdmin = user?.role.name === "Super Admin";
    if (!isSuperAdmin && !userPerms.includes("VIEW_REPORTS")) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    const cashBankAccounts = await prisma.account.findMany({
      where: {
        accountType: { name: { in: ["Asset", "ASSET"], mode: "insensitive" } },
        children: { none: {} },
        OR: [
          { accountName: { contains: "bank", mode: "insensitive" } },
          { accountName: { contains: "cash", mode: "insensitive" } },
          { detailType: { in: ["Cash", "Bank"], mode: "insensitive" } }
        ]
      },
      include: {
        accountType: true
      }
    });
    const cashBankCodes = new Set(cashBankAccounts.map((a) => a.glCode));
    const { startDate, endDate } = req.query || {};
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const computeCashBalance = async (upto) => {
      if (!upto) {
        return cashBankAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance || 0), 0);
      }
      let total = 0;
      for (const account of cashBankAccounts) {
        const agg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: account.id,
            postingDate: { lte: upto }
          },
          _sum: { debit: true, credit: true }
        });
        const debit = Number(agg._sum.debit) || 0;
        const credit = Number(agg._sum.credit) || 0;
        total += (Number(account.initialBalance) || 0) + debit - credit;
      }
      return Math.round(total * 100) / 100;
    };
    const postedJournals = await prisma.journalEntry.findMany({
      where: {
        status: "Posted",
        ...Object.keys(dateFilter).length > 0 ? { postingDate: dateFilter } : {}
      },
      include: {
        lines: {
          include: {
            account: {
              include: { accountType: true }
            }
          }
        }
      },
      orderBy: { postingDate: "asc" }
    });
    const inflowsMap = {};
    const outflowsMap = {};
    const inflowCategoryByAccount = {};
    const outflowCategoryByAccount = {};
    postedJournals.forEach((je) => {
      const cashLines = je.lines.filter((l) => cashBankCodes.has(l.account.glCode));
      const nonCashLines = je.lines.filter((l) => !cashBankCodes.has(l.account.glCode));
      if (cashLines.length === 0 || nonCashLines.length === 0) return;
      const debitSum = cashLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const creditSum = cashLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
      const netCashChange = debitSum - creditSum;
      if (netCashChange > 0) {
        const totalNonCashCredit = nonCashLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
        nonCashLines.forEach((l) => {
          if (l.credit > 0) {
            const ratio = totalNonCashCredit > 0 ? Number(l.credit) / totalNonCashCredit : 1;
            const amount = Math.round(netCashChange * ratio * 100) / 100;
            const name = l.account.accountName;
            inflowsMap[name] = (inflowsMap[name] || 0) + amount;
            inflowCategoryByAccount[name] = classifyCashFlowCategory2(name, l.account.accountType?.name);
          }
        });
      } else if (netCashChange < 0) {
        const absChange = Math.abs(netCashChange);
        const totalNonCashDebit = nonCashLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
        nonCashLines.forEach((l) => {
          if (l.debit > 0) {
            const ratio = totalNonCashDebit > 0 ? Number(l.debit) / totalNonCashDebit : 1;
            const amount = Math.round(absChange * ratio * 100) / 100;
            const name = l.account.accountName;
            outflowsMap[name] = (outflowsMap[name] || 0) + amount;
            outflowCategoryByAccount[name] = classifyCashFlowCategory2(name, l.account.accountType?.name);
          }
        });
      }
    });
    const inflows = Object.entries(inflowsMap).map(([name, amount]) => ({
      accountName: name,
      amount,
      category: inflowCategoryByAccount[name] || "Operating"
    }));
    const outflows = Object.entries(outflowsMap).map(([name, amount]) => ({
      accountName: name,
      amount,
      category: outflowCategoryByAccount[name] || "Operating"
    }));
    const sumByCategory = (rows, cat) => Math.round(rows.filter((r) => r.category === cat).reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
    const categories = ["Operating", "Investing", "Financing"];
    const categorySummary = Object.fromEntries(categories.map((cat) => [
      cat,
      {
        inflow: sumByCategory(inflows, cat),
        outflow: sumByCategory(outflows, cat),
        net: Math.round((sumByCategory(inflows, cat) - sumByCategory(outflows, cat)) * 100) / 100
      }
    ]));
    const totalInflow = Math.round(inflows.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
    const totalOutflow = Math.round(outflows.reduce((sum, o) => sum + o.amount, 0) * 100) / 100;
    const netChange = Math.round((totalInflow - totalOutflow) * 100) / 100;
    const endingCash = endDate ? await computeCashBalance(new Date(dateFilter.lte)) : await computeCashBalance();
    const beginningCash = startDate ? await computeCashBalance(new Date(new Date(startDate).getTime() - 1)) : Math.round((endingCash - netChange) * 100) / 100;
    return res.status(200).json({
      status: 200,
      data: {
        inflows,
        outflows,
        categorySummary,
        summary: {
          beginningCash,
          totalInflow,
          totalOutflow,
          netChange,
          endingCash,
          periodLabel: startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : "All Time"
        }
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  cash_flow_default as default
};
