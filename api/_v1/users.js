import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import bcrypt from "bcrypt";
var users_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
  });
  const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const isSuperAdmin = user?.role.name === "Super Admin";
  const checkPerm = (perm) => {
    if (isSuperAdmin) return true;
    return userPerms.includes(perm);
  };
  if (!checkPerm("MANAGE_USERS")) {
    return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
  }
  if (method === "GET") {
    const dbUsers = await prisma.user.findMany({
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
  if (method === "POST") {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: { message: "Email, password, full name, and role are required", status: 400 } });
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
    if (isActive !== void 0) updateData.isActive = isActive;
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }
    if (role !== void 0) {
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
        isActive: updatedUser.isActive
      }
    });
  }
  if (method === "DELETE") {
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
      await prisma.refreshToken.deleteMany({
        where: { userId: id }
      });
      await prisma.user.delete({
        where: { id }
      });
      await logAudit(
        req.user.id,
        "Delete User",
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
          data: { isActive: false }
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
        return res.status(400).json({
          error: {
            message: "User has active records (donations, bookings, ledger etc.) and cannot be fully deleted. They have been set to Inactive instead.",
            status: 400
          }
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
