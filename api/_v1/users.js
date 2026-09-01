import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { PERMS, SECURITY_PERMISSIONS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
import bcrypt from "bcryptjs";
async function roleGrantsSecurityPermission(roleName) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    include: { rolePermissions: { include: { permission: true } } }
  });
  if (!role) return false;
  const names = role.rolePermissions.map((rp) => rp.permission.name);
  return names.some((n) => SECURITY_PERMISSIONS.includes(n));
}
var users_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    if (!await verifyPermission(req, res, ["users.view", PERMS.MANAGE_USERS])) return;
  } else if (method === "POST") {
    if (!await verifyPermission(req, res, ["users.create", PERMS.MANAGE_USERS])) return;
  } else if (method === "DELETE") {
    if (!await verifyPermission(req, res, ["users.delete", PERMS.MANAGE_USERS])) return;
  } else {
    if (!await verifyPermission(req, res, ["users.update", PERMS.MANAGE_USERS])) return;
  }
  if (method === "GET") {
    const dbUsers = await prisma.user.findMany({
      where: getDeletedFilter(req.query),
      include: { role: true },
      orderBy: { createdAt: "desc" }
    });
    const formatted = dbUsers.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role.name,
      isActive: u.isActive,
      createdAt: u.createdAt
    }));
    return res.status(200).json({ status: 200, data: formatted });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: "User ID is required", status: 400 } });
      }
      const existing = await prisma.user.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: "User not found", status: 404 } });
      }
      const restored = await prisma.user.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, "Restore User", "USERS", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "User restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: { message: "Email, password, full name, and role are required", status: 400 } });
    }
    if (!actorHoldsSystemSettings && await roleGrantsSecurityPermission(role)) {
      return res.status(403).json({ error: { message: "Forbidden: Only an account with SYSTEM_SETTINGS permission can grant a security-sensitive role", status: 403 } });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: { message: "Email already registered", status: 400 } });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    let roleRecord = await prisma.role.findUnique({ where: { name: role } });
    if (!roleRecord) {
      roleRecord = await prisma.role.create({ data: { name: role, description: `${role} Role` } });
    }
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        roleId: roleRecord.id,
        isActive: true
      },
      include: { role: true }
    });
    await logAudit(req.user.id, "Create User", "USERS", null, { id: newUser.id, email: newUser.email, role: newUser.role.name }, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({
      status: 201,
      data: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role.name,
        isActive: newUser.isActive
      }
    });
  }
  if (method === "PUT") {
    if (!id) {
      return res.status(400).json({ error: { message: "User ID is required", status: 400 } });
    }
    const existingUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existingUser) {
      return res.status(404).json({ error: { message: "User not found", status: 404 } });
    }
    const { fullName, role, isActive, password } = req.body;
    const updateData = {};
    if (fullName !== void 0) updateData.fullName = fullName;
    if (isActive !== void 0) {
      updateData.isActive = typeof isActive === "boolean" ? isActive : isActive === 1 || isActive === "1" || isActive === "true";
    }
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }
    if (role !== void 0) {
      if (!actorHoldsSystemSettings && await roleGrantsSecurityPermission(role)) {
        return res.status(403).json({ error: { message: "Forbidden: Only an account with SYSTEM_SETTINGS permission can grant a security-sensitive role", status: 403 } });
      }
      let roleRecord = await prisma.role.findUnique({ where: { name: role } });
      if (!roleRecord) {
        roleRecord = await prisma.role.create({ data: { name: role, description: `${role} Role` } });
      }
      updateData.roleId = roleRecord.id;
    }
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true }
    });
    await logAudit(req.user.id, "Modify User", "USERS", { id: existingUser.id, fullName: existingUser.fullName, email: existingUser.email, role: existingUser.role.name, isActive: existingUser.isActive }, { id: updatedUser.id, fullName: updatedUser.fullName, email: updatedUser.email, role: updatedUser.role.name, isActive: updatedUser.isActive }, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({
      status: 200,
      data: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role.name,
        isActive: Boolean(updatedUser.isActive)
      }
    });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Admin or Super Admin can permanently delete records", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "User ID is required", status: 400 } });
    }
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ error: { message: "User not found", status: 404 } });
    }
    if (existingUser.id === req.user.id) {
      return res.status(400).json({ error: { message: "Cannot delete your own user account", status: 400 } });
    }
    try {
      if (isPermanent) {
        await prisma.refreshToken.deleteMany({
          where: { userId: id }
        });
        await prisma.user.delete({
          where: { id }
        });
      } else {
        await prisma.user.update({
          where: { id },
          data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id, isActive: false }
        });
      }
      await logAudit(
        req.user.id,
        isPermanent ? "Permanent Delete User" : "Delete User",
        "USERS",
        { id: existingUser.id, email: existingUser.email, fullName: existingUser.fullName },
        null,
        req.headers["x-forwarded-for"],
        req.headers["user-agent"]
      );
      return res.status(200).json({ status: 200, message: "User successfully deleted" });
    } catch (err) {
      if (err.code === "P2003") {
        const deactivatedUser = await prisma.user.update({
          where: { id },
          data: { isActive: false, isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
        });
        await logAudit(
          req.user.id,
          "Deactivate User (via Delete)",
          "USERS",
          { id: existingUser.id, isActive: existingUser.isActive },
          { id: deactivatedUser.id, isActive: deactivatedUser.isActive },
          req.headers["x-forwarded-for"],
          req.headers["user-agent"]
        );
        return res.status(200).json({
          status: 200,
          message: "User set to soft-deleted & inactive."
        });
      }
      return res.status(500).json({ error: { message: err.message || "Internal server error during delete", status: 500 } });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  users_default as default
};
