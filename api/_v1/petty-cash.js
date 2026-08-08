import { PettyCashService } from "../_services/petty-cash.service.js";
async function handler(req, res) {
  const { method, query, body, user } = req;
  const action = query.action || (req.path ? req.path.split("/").pop() : "");
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
      const [config, register] = await Promise.all([
        PettyCashService.getConfig(),
        PettyCashService.getRegister({ limit: 50 })
      ]);
      return res.status(200).json({ config, ...register });
    }
    if (method === "PUT") {
      if (action === "config") {
        const isAdmin = user?.role === "ADMIN" || user?.roleName === "ADMIN" || user?.role?.name === "ADMIN";
        if (!isAdmin) {
          return res.status(403).json({ error: "Permission denied. Only Administrators can modify Petty Cash configuration." });
        }
        const updated = await PettyCashService.updateConfig(body);
        return res.status(200).json(updated);
      }
    }
    if (method === "POST") {
      const createdById = user?.id || "00000000-0000-0000-0000-000000000000";
      if (action === "add-cash" || action === "transfer-in") {
        const result = await PettyCashService.addCash({
          sourceAccountId: body.sourceAccountId,
          amount: parseFloat(body.amount),
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
          amount: parseFloat(body.amount),
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
          amount: parseFloat(body.amount),
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
          physicalCount: parseFloat(body.physicalCount),
          explanation: body.explanation,
          reconciledById: createdById
        });
        return res.status(201).json(result);
      }
      if (action === "approve-reconciliation") {
        const isAdmin = user?.role === "ADMIN" || user?.roleName === "ADMIN" || user?.role?.name === "ADMIN";
        if (!isAdmin) {
          return res.status(403).json({ error: "Permission denied. Only Administrators can approve reconciliation adjustments." });
        }
        const result = await PettyCashService.approveReconciliation(body.reconciliationId, createdById);
        return res.status(200).json(result);
      }
      if (action === "revert" || action === "delete") {
        const isAdmin = user?.role === "ADMIN" || user?.roleName === "ADMIN" || user?.role?.name === "ADMIN";
        if (!isAdmin) {
          return res.status(403).json({ error: "Permission denied. Only Administrators can revert posted Petty Cash transactions." });
        }
        const result = await PettyCashService.revertTransaction(body.transactionId, createdById, body.revertReason || "Admin Reversal");
        return res.status(200).json(result);
      }
    }
    return res.status(400).json({ error: "Invalid Petty Cash endpoint or action" });
  } catch (err) {
    console.error("[Petty Cash API Error]:", err);
    return res.status(err.status || 400).json({ error: err.message || "Petty Cash processing failed" });
  }
}
export {
  handler as default
};
