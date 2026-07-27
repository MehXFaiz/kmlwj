import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { notify } from "../_utils/notify.js";
import { loadPermissions } from "../_services/permission.service.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
var expense_heads_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    const dbExpenseHeads = await prisma.expenseHead.findMany({
      where: getDeletedFilter(req.query),
      orderBy: { name: "asc" },
      include: {
        account: true
      }
    });
    return res.status(200).json({ status: 200, data: dbExpenseHeads });
  }
  const userPerms = await loadPermissions(req);
  const checkPerm = (perm) => userPerms.has(perm);
  if (method === "PUT" || method === "POST") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: "Expense Head ID is required", status: 400 } });
      }
      const existing = await prisma.expenseHead.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Expense Head not found", status: 404 } });
      }
      const restored = await prisma.expenseHead.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, "Restore Expense Head", "EXPENSE", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Expense Head restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    if (!checkPerm(PERMS.MANAGE_EXPENSE_HEADS)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    const { name, category, accountId, isActive } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: { message: "Name and Category are required", status: 400 } });
    }
    const newHead = await prisma.expenseHead.create({
      data: {
        name,
        category,
        accountId: accountId || null,
        isActive: isActive !== void 0 ? isActive : true
      },
      include: {
        account: true
      }
    });
    await logAudit(req.user.id, "Create Expense Head", "EXPENSE", null, newHead, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    await notify(req, {
      title: "Expense Head Added",
      message: `Expense head "${newHead.name}" created.`,
      module: "Expense Heads",
      recordId: newHead.id,
      actionType: "CREATE",
      visibility: "ADMIN_ONLY"
    });
    return res.status(201).json({ status: 201, data: newHead });
  }
  if (method === "PUT") {
    if (!checkPerm(PERMS.MANAGE_EXPENSE_HEADS)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Expense Head ID is required", status: 400 } });
    }
    const existingHead = await prisma.expenseHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: "Expense Head not found", status: 404 } });
    }
    const { name, category, accountId, isActive } = req.body;
    const updatedHead = await prisma.expenseHead.update({
      where: { id },
      data: {
        name: name !== void 0 ? name : void 0,
        category: category !== void 0 ? category : void 0,
        accountId: accountId !== void 0 ? accountId || null : void 0,
        isActive: isActive !== void 0 ? isActive : void 0
      },
      include: {
        account: true
      }
    });
    await logAudit(req.user.id, "Modify Expense Head", "EXPENSE", existingHead, updatedHead, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    await notify(req, {
      title: "Expense Head Updated",
      message: `Expense head "${updatedHead.name}" updated.`,
      module: "Expense Heads",
      recordId: updatedHead.id,
      actionType: "UPDATE",
      visibility: "ADMIN_ONLY"
    });
    return res.status(200).json({ status: 200, data: updatedHead });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent) {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: "Expense Head ID is required", status: 400 } });
      }
      const existingHead2 = await prisma.expenseHead.findUnique({ where: { id } });
      if (!existingHead2) {
        return res.status(404).json({ error: { message: "Expense Head not found", status: 404 } });
      }
      await prisma.expenseHead.delete({ where: { id } });
      await logAudit(req.user.id, "Permanent Delete Expense Head", "EXPENSE", existingHead2, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Expense Head permanently deleted successfully" });
    }
    if (!checkPerm(PERMS.MANAGE_EXPENSE_HEADS)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Expense Head ID is required", status: 400 } });
    }
    const existingHead = await prisma.expenseHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: "Expense Head not found", status: 404 } });
    }
    const updated = await prisma.expenseHead.update({
      where: { id },
      data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
    });
    await logAudit(req.user.id, "Delete Expense Head", "EXPENSE", existingHead, updated, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    await notify(req, {
      title: "Expense Head Deleted",
      message: `Expense head "${existingHead.name}" deleted.`,
      module: "Expense Heads",
      recordId: existingHead.id,
      actionType: "DELETE",
      visibility: "ADMIN_ONLY"
    });
    return res.status(200).json({ status: 200, message: "Expense Head deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  expense_heads_default as default
};
