import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { loadPermissions } from "../_services/permission.service.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
var revenue_heads_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    const dbRevenueHeads = await prisma.revenueHead.findMany({
      where: getDeletedFilter(req.query),
      orderBy: { createdAt: "desc" }
    });
    return res.status(200).json({ status: 200, data: dbRevenueHeads });
  }
  const userPerms = await loadPermissions(req);
  const checkPerm = (perm) => userPerms.has(perm);
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: "Revenue Head ID is required", status: 400 } });
      }
      const existing = await prisma.revenueHead.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Revenue Head not found", status: 404 } });
      }
      const restored = await prisma.revenueHead.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, "Restore Revenue Head", "REVENUE", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Revenue Head restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    if (!checkPerm(PERMS.MANAGE_REVENUE_HEADS)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    const { name, category, hall, amount, accountId, isActive } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: { message: "Name and Category are required", status: 400 } });
    }
    const newHead = await prisma.revenueHead.create({
      data: {
        name,
        category,
        hall: category === "Hall Bookings" ? hall || null : null,
        amount: amount !== void 0 ? parseFloat(amount) : 0,
        accountId: accountId || null,
        isActive: isActive !== void 0 ? Boolean(isActive) : true
      }
    });
    await logAudit(req.user.id, "Create Revenue Head", "REVENUE", null, newHead, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newHead });
  }
  if (method === "PUT") {
    if (!checkPerm(PERMS.MANAGE_REVENUE_HEADS)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Revenue Head ID is required", status: 400 } });
    }
    const existingHead = await prisma.revenueHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: "Revenue Head not found", status: 404 } });
    }
    const { name, category, hall, amount, accountId, isActive } = req.body;
    const updatedHead = await prisma.revenueHead.update({
      where: { id },
      data: {
        name: name !== void 0 ? name : void 0,
        category: category !== void 0 ? category : void 0,
        hall: category === "Hall Bookings" ? hall !== void 0 ? hall : void 0 : null,
        amount: amount !== void 0 ? parseFloat(amount) : void 0,
        accountId: accountId !== void 0 ? accountId || null : void 0,
        isActive: isActive !== void 0 ? Boolean(isActive) : void 0
      }
    });
    await logAudit(req.user.id, "Modify Revenue Head", "REVENUE", existingHead, updatedHead, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedHead });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent) {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: "Revenue Head ID is required", status: 400 } });
      }
      const existingHead2 = await prisma.revenueHead.findUnique({ where: { id } });
      if (!existingHead2) {
        return res.status(404).json({ error: { message: "Revenue Head not found", status: 404 } });
      }
      await prisma.revenueHead.delete({ where: { id } });
      await logAudit(req.user.id, "Permanent Delete Revenue Head", "REVENUE", existingHead2, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Revenue Head permanently deleted successfully" });
    }
    if (!checkPerm(PERMS.MANAGE_REVENUE_HEADS)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Revenue Head ID is required", status: 400 } });
    }
    const existingHead = await prisma.revenueHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: "Revenue Head not found", status: 404 } });
    }
    const updated = await prisma.revenueHead.update({
      where: { id },
      data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
    });
    await logAudit(req.user.id, "Delete Revenue Head", "REVENUE", existingHead, updated, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Revenue Head deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  revenue_heads_default as default
};
