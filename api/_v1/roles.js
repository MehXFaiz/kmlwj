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
    journals: ["VIEW_REPORTS"],
    reports: ["VIEW_REPORTS"],
    users: ["MANAGE_USERS"],
    settings: ["MANAGE_ROLES", "MANAGE_RESERVED_CODES"]
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
        settings: permMap.settings.every((p) => activePermNames.includes(p))
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
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  roles_default as default
};
