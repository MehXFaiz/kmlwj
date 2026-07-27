import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { AccountingService } from "../../_services/accounting.service.js";
import { PERMS } from "../../_constants/permissions.js";
var tree_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method === "GET") {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) return;
    const dbAccounts = await prisma.account.findMany({
      where: { isDeleted: false },
      include: {
        accountType: true
      },
      orderBy: { glCode: "asc" }
    });
    const aggregates = await AccountingService.getPostedAggregates();
    const liveBalance = (acc) => AccountingService.naturalBalance(acc.accountType?.name || "ASSET", acc.initialBalance, aggregates.get(acc.id));
    const formatAccount = (acc) => ({
      id: acc.id,
      code: acc.glCode,
      name: acc.accountName,
      type: acc.accountType ? acc.accountType.name.charAt(0) + acc.accountType.name.slice(1).toLowerCase() : "Asset",
      level: acc.accountLevel,
      detailType: acc.detailType,
      parentCode: null,
      // Will be filled logically below if needed, or by ID mapping
      currency: acc.currency,
      status: acc.isLocked ? "Inactive" : "Active",
      description: acc.description,
      subsidiary: acc.subsidiary,
      initialBalance: acc.initialBalance,
      currentBalance: liveBalance(acc),
      isSystemDefined: acc.isSystemDefined,
      isReserved: acc.isReserved,
      children: []
    });
    const accountMap = /* @__PURE__ */ new Map();
    const rootAccounts = [];
    dbAccounts.forEach((acc) => {
      accountMap.set(acc.id, { ...formatAccount(acc), _parentId: acc.parentId, _code: acc.glCode });
    });
    dbAccounts.forEach((acc) => {
      const formattedNode = accountMap.get(acc.id);
      if (acc.parentId && accountMap.has(acc.parentId)) {
        const parentNode = accountMap.get(acc.parentId);
        formattedNode.parentCode = parentNode._code;
        parentNode.children.push(formattedNode);
      } else {
        rootAccounts.push(formattedNode);
      }
    });
    const computeBalances = (node) => {
      let debit = 0;
      let credit = 0;
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          computeBalances(child);
          debit += child.debit || 0;
          credit += child.credit || 0;
        });
      } else {
        const bal = Number(node.currentBalance || 0);
        if (bal > 0) {
          debit = bal;
        } else if (bal < 0) {
          credit = Math.abs(bal);
        }
      }
      node.debit = debit;
      node.credit = credit;
      node.netBalance = debit - credit;
    };
    rootAccounts.forEach((root) => computeBalances(root));
    const cleanTree = (nodes) => {
      nodes.forEach((node) => {
        delete node._parentId;
        delete node._code;
        if (node.children.length > 0) {
          cleanTree(node.children);
        }
      });
    };
    cleanTree(rootAccounts);
    return res.status(200).json({ status: 200, data: rootAccounts });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  tree_default as default
};
