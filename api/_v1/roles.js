import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
var roles_default = makeHandler(async (req, res) => {
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
  if (!checkPerm("MANAGE_ROLES")) {
    return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
  }
  const permMap = {
    coa: ["CREATE_ACCOUNT", "UPDATE_ACCOUNT", "DELETE_ACCOUNT", "LOCK_ACCOUNT"],
    journals: ["VIEW_REPORTS", "POST_JOURNAL"],
    reports: ["VIEW_REPORTS"],
    users: ["MANAGE_USERS"],
    settings: ["MANAGE_ROLES", "MANAGE_RESERVED_CODES"],
    income: ["RECORD_INCOME", "CREATE_ACCOUNT"],
    expense: ["RECORD_EXPENSE", "CREATE_ACCOUNT"],
    invoices: ["VIEW_INVOICES"]
  };
  if (method === "GET") {
    const dbRoles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      },
      orderBy: { name: "asc" }
    });
    const formatted = dbRoles.map((role) => {
      const activePermNames = role.rolePermissions.map((rp) => rp.permission.name);
      const permissions = {
        coa: permMap.coa.every((p) => activePermNames.includes(p)),
        journals: permMap.journals.every((p) => activePermNames.includes(p)),
        reports: permMap.reports.every((p) => activePermNames.includes(p)),
        users: permMap.users.every((p) => activePermNames.includes(p)),
        settings: permMap.settings.every((p) => activePermNames.includes(p)),
        income: permMap.income.every((p) => activePermNames.includes(p)),
        expense: permMap.expense.every((p) => activePermNames.includes(p)),
        invoices: permMap.invoices.every((p) => activePermNames.includes(p))
      };
      const locked = role.name === "Super Admin" || role.description?.includes("Locked");
      return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions,
        locked
      };
    });
    return res.status(200).json({ status: 200, data: formatted });
  }
  if (method === "PUT") {
    if (!id) {
      return res.status(400).json({ error: { message: "Role ID is required", status: 400 } });
    }
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } }
    });
    if (!existingRole) {
      return res.status(404).json({ error: { message: "Role not found", status: 404 } });
    }
    if (existingRole.name === "Super Admin") {
      return res.status(400).json({ error: { message: "Super Admin permissions cannot be modified", status: 400 } });
    }
    const { permissions, locked } = req.body;
    if (locked !== void 0) {
      await prisma.role.update({
        where: { id },
        data: {
          description: locked ? `${existingRole.name} Role (Locked)` : `${existingRole.name} Role`
        }
      });
    }
    if (permissions) {
      const permissionsToAssign = [];
      Object.keys(permissions).forEach((key) => {
        if (permissions[key] && permMap[key]) {
          permissionsToAssign.push(...permMap[key]);
        }
      });
      for (const permName of permissionsToAssign) {
        await prisma.permission.upsert({
          where: { name: permName },
          update: {},
          create: { name: permName, description: `Access to ${permName}` }
        });
      }
      const dbPermissions = await prisma.permission.findMany({
        where: {
          name: { in: permissionsToAssign }
        }
      });
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({
          where: { roleId: id }
        }),
        prisma.rolePermission.createMany({
          data: dbPermissions.map((p) => ({
            roleId: id,
            permissionId: p.id
          }))
        })
      ]);
    }
    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } }
    });
    await logAudit(
      req.user.id,
      "Update Role Permissions",
      "ROLES",
      existingRole.rolePermissions.map((rp) => rp.permission.name),
      updatedRole?.rolePermissions.map((rp) => rp.permission.name),
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
    return res.status(200).json({ status: 200, message: "Role updated successfully" });
  }
  if (method === "POST") {
    const { name, description, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: "Role name is required", status: 400 } });
    }
    const trimmedName = name.trim();
    const existing = await prisma.role.findUnique({
      where: { name: trimmedName }
    });
    if (existing) {
      return res.status(400).json({ error: { message: `A role named "${trimmedName}" already exists`, status: 400 } });
    }
    const newRole = await prisma.role.create({
      data: {
        name: trimmedName,
        description: description?.trim() || `${trimmedName} Role`
      }
    });
    if (permissions) {
      const permissionsToAssign = [];
      Object.keys(permissions).forEach((key) => {
        if (permissions[key] && permMap[key]) {
          permissionsToAssign.push(...permMap[key]);
        }
      });
      for (const permName of permissionsToAssign) {
        await prisma.permission.upsert({
          where: { name: permName },
          update: {},
          create: { name: permName, description: `Access to ${permName}` }
        });
      }
      const dbPermissions = await prisma.permission.findMany({
        where: { name: { in: permissionsToAssign } }
      });
      if (dbPermissions.length > 0) {
        await prisma.rolePermission.createMany({
          data: dbPermissions.map((p) => ({
            roleId: newRole.id,
            permissionId: p.id
          }))
        });
      }
    }
    const createdRoleWithPerms = await prisma.role.findUnique({
      where: { id: newRole.id },
      include: { rolePermissions: { include: { permission: true } } }
    });
    await logAudit(
      req.user.id,
      `Created custom role "${trimmedName}"`,
      "ROLES",
      null,
      { roleId: newRole.id, name: trimmedName, permissions },
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
    const activePermNames = createdRoleWithPerms?.rolePermissions.map((rp) => rp.permission.name) || [];
    const formattedNewRole = {
      id: createdRoleWithPerms.id,
      name: createdRoleWithPerms.name,
      description: createdRoleWithPerms.description,
      permissions: {
        coa: permMap.coa.every((p) => activePermNames.includes(p)),
        journals: permMap.journals.every((p) => activePermNames.includes(p)),
        reports: permMap.reports.every((p) => activePermNames.includes(p)),
        users: permMap.users.every((p) => activePermNames.includes(p)),
        settings: permMap.settings.every((p) => activePermNames.includes(p)),
        income: permMap.income.every((p) => activePermNames.includes(p)),
        expense: permMap.expense.every((p) => activePermNames.includes(p)),
        invoices: permMap.invoices.every((p) => activePermNames.includes(p))
      },
      locked: false
    };
    return res.status(201).json({ status: 201, message: "Role created successfully", data: formattedNewRole });
  }
  if (method === "DELETE") {
    if (!id) {
      return res.status(400).json({ error: { message: "Role ID is required", status: 400 } });
    }
    const roleToDelete = await prisma.role.findUnique({
      where: { id },
      include: { users: true }
    });
    if (!roleToDelete) {
      return res.status(404).json({ error: { message: "Role not found", status: 404 } });
    }
    if (roleToDelete.name === "Super Admin" || roleToDelete.name === "Admin") {
      return res.status(400).json({ error: { message: `Core system role "${roleToDelete.name}" cannot be deleted`, status: 400 } });
    }
    if (roleToDelete.users && roleToDelete.users.length > 0) {
      return res.status(400).json({
        error: {
          message: `Cannot delete role "${roleToDelete.name}" because ${roleToDelete.users.length} user(s) are currently assigned to it. Please reassign those users first.`,
          status: 400
        }
      });
    }
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.role.delete({ where: { id } })
    ]);
    await logAudit(
      req.user.id,
      `Deleted custom role "${roleToDelete.name}"`,
      "ROLES",
      { name: roleToDelete.name },
      null,
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
    return res.status(200).json({ status: 200, message: "Role deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  roles_default as default
};
