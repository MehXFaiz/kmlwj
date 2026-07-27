import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { AccountingService } from "../../_services/accounting.service.js";
import { PERMS } from "../../_constants/permissions.js";
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
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;
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
    const cashAccounts = cashBankAccounts.filter((a) => AccountingService.isCashAccount(a.accountName, a.detailType));
    const bankAccounts = cashBankAccounts.filter((a) => AccountingService.isBankAccount(a.accountName, a.detailType));
    const cashCodes = new Set(cashAccounts.map((a) => a.glCode));
    const bankCodes = new Set(bankAccounts.map((a) => a.glCode));
    const cashBankCodes = new Set(cashBankAccounts.map((a) => a.glCode));
    const { startDate, endDate } = req.query || {};
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    const computeBalance = async (accounts, upto) => {
      if (accounts.length === 0) return 0;
      const aggregates = await AccountingService.getPostedAggregates({
        to: upto,
        accountIds: accounts.map((a) => a.id)
      });
      const total = accounts.reduce(
        (sum, acc) => sum + AccountingService.naturalBalance("ASSET", acc.initialBalance, aggregates.get(acc.id)),
        0
      );
      return Math.round(total * 100) / 100;
    };
    const computeCashBalance = (upto) => computeBalance(cashBankAccounts, upto);
    const computeCashOnlyBalance = (upto) => computeBalance(cashAccounts, upto);
    const computeBankOnlyBalance = (upto) => computeBalance(bankAccounts, upto);
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
    const cashInflowsMap = {};
    const cashOutflowsMap = {};
    const bankInflowsMap = {};
    const bankOutflowsMap = {};
    const processMovements = (movementLines, nonCashLines, netChange2, globalInflows, globalOutflows) => {
      if (netChange2 > 0) {
        const totalNonCashCredit = nonCashLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
        nonCashLines.forEach((l) => {
          if (l.credit > 0) {
            const ratio = totalNonCashCredit > 0 ? Number(l.credit) / totalNonCashCredit : 1;
            const amount = Math.round(netChange2 * ratio * 100) / 100;
            const name = l.account.accountName;
            globalInflows[name] = (globalInflows[name] || 0) + amount;
            inflowCategoryByAccount[name] = classifyCashFlowCategory2(name, l.account.accountType?.name);
          }
        });
      } else if (netChange2 < 0) {
        const absChange = Math.abs(netChange2);
        const totalNonCashDebit = nonCashLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
        nonCashLines.forEach((l) => {
          if (l.debit > 0) {
            const ratio = totalNonCashDebit > 0 ? Number(l.debit) / totalNonCashDebit : 1;
            const amount = Math.round(absChange * ratio * 100) / 100;
            const name = l.account.accountName;
            globalOutflows[name] = (globalOutflows[name] || 0) + amount;
            outflowCategoryByAccount[name] = classifyCashFlowCategory2(name, l.account.accountType?.name);
          }
        });
      }
    };
    postedJournals.forEach((je) => {
      const allCashBankLines = je.lines.filter((l) => cashBankCodes.has(l.account.glCode));
      const nonCashBankLines = je.lines.filter((l) => !cashBankCodes.has(l.account.glCode));
      if (allCashBankLines.length === 0 || nonCashBankLines.length === 0) return;
      const netCashChange = allCashBankLines.reduce((sum, l) => sum + Number(l.debit || 0) - Number(l.credit || 0), 0);
      processMovements(allCashBankLines, nonCashBankLines, netCashChange, inflowsMap, outflowsMap);
      const cashLines = je.lines.filter((l) => cashCodes.has(l.account.glCode));
      if (cashLines.length > 0) {
        const netCash = cashLines.reduce((sum, l) => sum + Number(l.debit || 0) - Number(l.credit || 0), 0);
        processMovements(cashLines, nonCashBankLines, netCash, cashInflowsMap, cashOutflowsMap);
      }
      const bankLines = je.lines.filter((l) => bankCodes.has(l.account.glCode));
      if (bankLines.length > 0) {
        const netBank = bankLines.reduce((sum, l) => sum + Number(l.debit || 0) - Number(l.credit || 0), 0);
        processMovements(bankLines, nonCashBankLines, netBank, bankInflowsMap, bankOutflowsMap);
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
    const cashTotalReceipts = Math.round(Object.values(cashInflowsMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const cashTotalPayments = Math.round(Object.values(cashOutflowsMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const closingCash = endDate ? await computeCashOnlyBalance(new Date(dateFilter.lte)) : await computeCashOnlyBalance();
    const openingCash = startDate ? await computeCashOnlyBalance(new Date(new Date(startDate).getTime() - 1)) : Math.round((closingCash - (cashTotalReceipts - cashTotalPayments)) * 100) / 100;
    const bankTotalReceipts = Math.round(Object.values(bankInflowsMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const bankTotalPayments = Math.round(Object.values(bankOutflowsMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const closingBank = endDate ? await computeBankOnlyBalance(new Date(dateFilter.lte)) : await computeBankOnlyBalance();
    const openingBank = startDate ? await computeBankOnlyBalance(new Date(new Date(startDate).getTime() - 1)) : Math.round((closingBank - (bankTotalReceipts - bankTotalPayments)) * 100) / 100;
    const periodLabel = startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : "All Time";
    return res.status(200).json({
      status: 200,
      data: {
        inflows,
        outflows,
        categorySummary,
        // Split Cash in Hand and Bank sections (single source of truth: posted GL entries)
        cashSection: {
          receipts: Object.entries(cashInflowsMap).map(([accountName, amount]) => ({ accountName, amount })),
          payments: Object.entries(cashOutflowsMap).map(([accountName, amount]) => ({ accountName, amount })),
          openingBalance: openingCash,
          totalReceipts: cashTotalReceipts,
          totalPayments: cashTotalPayments,
          closingBalance: closingCash
        },
        bankSection: {
          receipts: Object.entries(bankInflowsMap).map(([accountName, amount]) => ({ accountName, amount })),
          payments: Object.entries(bankOutflowsMap).map(([accountName, amount]) => ({ accountName, amount })),
          openingBalance: openingBank,
          totalReceipts: bankTotalReceipts,
          totalPayments: bankTotalPayments,
          closingBalance: closingBank
        },
        summary: {
          beginningCash,
          totalInflow,
          totalOutflow,
          netChange,
          endingCash,
          periodLabel
        }
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  cash_flow_default as default
};
