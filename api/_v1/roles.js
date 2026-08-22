import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { PERMS } from "../_constants/permissions.js";
var roles_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  let id = req.query.id || req.params?.id || req.body?.id;
  if (!id && req.url) {
    const urlParts = req.url.split("?")[0].split("/");
    const lastPart = urlParts[urlParts.length - 1];
    if (lastPart && lastPart !== "roles") {
      id = lastPart;
    }
  }
  if (!await verifyPermission(req, res, PERMS.MANAGE_ROLES)) return;
  const permMap = {
    coa: ["CREATE_ACCOUNT"],
    journals: ["VIEW_JOURNALS", "POST_JOURNAL"],
    reports: ["VIEW_REPORTS"],
    audit: ["VIEW_AUDIT"],
    users: ["MANAGE_USERS"],
    settings: ["SYSTEM_SETTINGS", "MANAGE_ROLES", "MANAGE_RESERVED_CODES"],
    income: ["RECORD_INCOME", "MANAGE_REVENUE_HEADS"],
    expense: ["RECORD_EXPENSE", "MANAGE_EXPENSE_HEADS"],
    invoices: ["VIEW_INVOICES", "CREATE_INVOICE"],
    members: ["VIEW_MEMBERS", "CREATE_MEMBER"],
    beneficiaries: ["VIEW_BENEFICIARIES", "CREATE_BENEFICIARY"],
    donations: ["VIEW_DONATIONS", "CREATE_DONATION", "VIEW_DONATIONS_RECEIVED", "CREATE_DONATION_RECEIVED"],
    hallBookings: ["VIEW_HALL_BOOKINGS", "CREATE_HALL_BOOKING"],
    revenueCollections: ["VIEW_REVENUE_COLLECTIONS", "CREATE_REVENUE_COLLECTION"],
    zakatCards: ["VIEW_ZAKAT_CARDS", "CREATE_ZAKAT_CARD"],
    zakat: ["VIEW_ZAKAT_CARDS", "CREATE_ZAKAT_CARD"],
    donors: ["VIEW_DONORS", "CREATE_DONOR"],
    customers: ["VIEW_CUSTOMERS", "CREATE_CUSTOMER"]
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
      const permissions = {};
      for (const key of Object.keys(permMap)) {
        permissions[key] = permMap[key].some((p) => activePermNames.includes(p));
      }
      const locked = role.isPrivileged || role.name === "Super Admin" || role.name === "Admin" || role.description?.includes("Locked");
      return {
        id: role.id,
        name: role.name,
        description: role.description,
        isPrivileged: role.isPrivileged,
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
    if (existingRole.isPrivileged || existingRole.name === "Super Admin" || existingRole.name === "Admin") {
      return res.status(400).json({ error: { message: "System Admin role permissions cannot be modified from the panel", status: 400 } });
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
    const newRolePermissions = {};
    for (const key of Object.keys(permMap)) {
      newRolePermissions[key] = permMap[key].every((p) => activePermNames.includes(p));
    }
    const formattedNewRole = {
      id: createdRoleWithPerms.id,
      name: createdRoleWithPerms.name,
      description: createdRoleWithPerms.description,
      permissions: newRolePermissions,
      locked: false
    };
    return res.status(201).json({ status: 201, message: "Role created successfully", data: formattedNewRole });
  }
  if (method === "DELETE") {
    if (!id || typeof id !== "string" || !id.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: "Role ID is required", status: 400 },
        message: "Role ID is required"
      });
    }
    const trimmedId = id.trim();
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmedId);
    if (!isUuid) {
      return res.status(404).json({
        success: false,
        error: { message: "Role not found", status: 404 },
        message: "Role not found"
      });
    }
    const roleToDelete = await prisma.role.findUnique({
      where: { id: trimmedId },
      include: { users: true }
    });
    if (!roleToDelete) {
      return res.status(404).json({
        success: false,
        error: { message: "Role not found", status: 404 },
        message: "Role not found"
      });
    }
    const PROTECTED_SYSTEM_ROLES = ["Super Admin", "Admin"];
    if (PROTECTED_SYSTEM_ROLES.includes(roleToDelete.name)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `${roleToDelete.name} is a protected system role and cannot be deleted.`,
          status: 403
        },
        message: `${roleToDelete.name} is a protected system role and cannot be deleted.`
      });
    }
    if (roleToDelete.users && roleToDelete.users.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          message: `This role is assigned to ${roleToDelete.users.length} user(s). Reassign those users before deleting the role.`,
          status: 409
        },
        message: `This role is assigned to ${roleToDelete.users.length} user(s). Reassign those users before deleting the role.`
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: trimmedId } });
      await tx.role.delete({ where: { id: trimmedId } });
    });
    await logAudit(
      req.user.id,
      "ROLE_DELETED",
      "ROLES",
      { id: roleToDelete.id, name: roleToDelete.name },
      null,
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
    return res.status(200).json({
      status: 200,
      success: true,
      message: `Role "${roleToDelete.name}" deleted successfully`
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  roles_default as default
};
