import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { PettyCashService } from "../_services/petty-cash.service.js";
import { PERMS } from "../_constants/permissions.js";
import { isPrivilegedUser } from "../_services/permission.service.js";
var petty_cash_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method, query, body } = req;
  const action = query.action || (req.url ? req.url.split("?")[0].split("/").pop() : "");
  if (method === "GET") {
    if (!await verifyPermission(req, res, ["expenses.view", PERMS.RECORD_EXPENSE])) return;
  } else if (method === "POST") {
    if (action === "bulk-delete" || action === "bulk-revert" || action === "revert" || action === "delete") {
      if (!await verifyPermission(req, res, ["expenses.delete"])) return;
    } else {
      if (!await verifyPermission(req, res, ["expenses.create", PERMS.RECORD_EXPENSE])) return;
    }
  } else if (method === "PUT" || method === "PATCH") {
    if (!await verifyPermission(req, res, ["expenses.update"])) return;
  } else if (method === "DELETE") {
    if (!await verifyPermission(req, res, ["expenses.delete"])) return;
  }
  try {
    if (method === "GET") {
      if (action === "config") {
        const config2 = await PettyCashService.getConfig();
        return res.status(200).json(config2);
      }
      if (action === "register") {
        const register2 = await PettyCashService.getRegister({
          startDate: query.startDate,
          endDate: query.endDate,
          type: query.type,
          page: query.page ? parseInt(query.page, 10) : 1,
          limit: query.limit ? parseInt(query.limit, 10) : 50
        });
        return res.status(200).json(register2);
      }
      if (action === "voucher" || query.voucherNo || query.id) {
        const voucherId = query.voucherNo || query.id || action;
        const voucher = await PettyCashService.getVoucher(voucherId);
        return res.status(200).json(voucher);
      }
      if (action === "reconciliations") {
        const reconciliations = await PettyCashService.getReconciliations();
        return res.status(200).json(reconciliations);
      }
      const [config, register] = await Promise.all([
        PettyCashService.getConfig(),
        PettyCashService.getRegister({ limit: 50 })
      ]);
      return res.status(200).json({ config, ...register });
    }
    if (method === "PUT") {
      const createdById = req.user.id;
      if (action === "config") {
        const isPrivileged = await isPrivilegedUser(req);
        if (!isPrivileged) {
          return res.status(403).json({ error: "Permission denied. Only Administrators can modify Petty Cash configuration." });
        }
        const updated = await PettyCashService.updateConfig(body);
        return res.status(200).json(updated);
      }
      const txId = body.id || body.transactionId || (query.id !== "config" ? query.id : null);
      if (txId) {
        const updated = await PettyCashService.updateTransaction(txId, body, createdById);
        return res.status(200).json(updated);
      }
    }
    if (method === "POST") {
      const createdById = req.user.id;
      if (action === "add-cash" || action === "transfer-in") {
        const result = await PettyCashService.addCash({
          sourceAccountId: body.sourceAccountId,
          amount: body.amount,
          date: body.date,
          referenceNo: body.referenceNo,
          narration: body.narration,
          createdById,
          isReplenishment: false
        });
        return res.status(201).json(result);
      }
      if (action === "expense") {
        const result = await PettyCashService.recordExpense({
          expenseHeadId: body.expenseHeadId,
          expenseAccountId: body.expenseAccountId,
          amount: body.amount,
          paidTo: body.paidTo,
          date: body.date,
          referenceNo: body.referenceNo,
          narration: body.narration,
          attachmentUrl: body.attachmentUrl,
          createdById
        });
        return res.status(201).json(result);
      }
      if (action === "replenish") {
        const result = await PettyCashService.addCash({
          sourceAccountId: body.sourceAccountId,
          amount: body.amount,
          date: body.date,
          referenceNo: body.referenceNo,
          narration: body.narration || "Petty Cash Fund Replenishment",
          createdById,
          isReplenishment: true
        });
        return res.status(201).json(result);
      }
      if (action === "reconcile") {
        const result = await PettyCashService.reconcile({
          physicalCount: body.physicalCount,
          explanation: body.explanation,
          reconciledById: createdById
        });
        return res.status(201).json(result);
      }
      if (action === "approve-reconciliation") {
        const isAdmin = user?.role === "ADMIN" || user?.roleName === "ADMIN" || user?.role?.name === "ADMIN" || user?.role === "Super Admin";
        if (!isAdmin) {
          return res.status(403).json({ error: "Permission denied. Only Administrators can approve reconciliation adjustments." });
        }
        const result = await PettyCashService.approveReconciliation(body.reconciliationId, createdById);
        return res.status(200).json(result);
      }
      if (action === "bulk-delete" || action === "bulk-revert") {
        const result = await PettyCashService.bulkRevertTransactions(body.transactionIds, createdById, body.revertReason || "Bulk Admin Reversal");
        return res.status(200).json({ success: true, results: result });
      }
      if (action === "revert" || action === "delete") {
        const result = await PettyCashService.revertTransaction(body.transactionId, createdById, body.revertReason || "Admin Reversal");
        return res.status(200).json(result);
      }
    }
    return res.status(400).json({ error: "Invalid Petty Cash endpoint or action" });
  } catch (err) {
    console.error("[Petty Cash API Error]:", err);
    return res.status(err.status || 400).json({ error: err.message || "Petty Cash processing failed" });
  }
});
export {
  petty_cash_default as default
};
