import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
var cash_flow_default = makeHandler(async (req, res) => {
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
    const cashBankAccounts = await prisma.account.findMany({
      where: {
        accountType: { name: { in: ["Asset", "ASSET"], mode: "insensitive" } },
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
    const endingCash = cashBankAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance || 0), 0);
    const postedJournals = await prisma.journalEntry.findMany({
      where: {
        status: "Posted"
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
          }
        });
      }
    });
    const inflows = Object.entries(inflowsMap).map(([name, amount]) => ({
      accountName: name,
      amount
    }));
    const outflows = Object.entries(outflowsMap).map(([name, amount]) => ({
      accountName: name,
      amount
    }));
    const totalInflow = Math.round(inflows.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
    const totalOutflow = Math.round(outflows.reduce((sum, o) => sum + o.amount, 0) * 100) / 100;
    const netChange = Math.round((totalInflow - totalOutflow) * 100) / 100;
    const beginningCash = Math.round((endingCash - netChange) * 100) / 100;
    return res.status(200).json({
      status: 200,
      data: {
        inflows,
        outflows,
        summary: {
          beginningCash,
          totalInflow,
          totalOutflow,
          netChange,
          endingCash
        }
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  cash_flow_default as default
};
