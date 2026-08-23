import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import {
  PERMS,
  ERP_MODULE_DEFINITIONS,
  ERP_MODULES_MAP,
  ActionType,
} from '../_constants/permissions.js';

// Legacy permission mapping for backwards compatibility
const LEGACY_PERM_MAP: Record<string, string[]> = {
  coa: ['coa.view', 'coa.create', 'CREATE_ACCOUNT'],
  postToLedger: ['ledger.post', 'POST_JOURNAL'],
  journals: ['journalEntries.view', 'journalEntries.create', 'VIEW_JOURNALS', 'POST_JOURNAL'],
  reports: ['reports.view', 'reports.export', 'reports.print', 'VIEW_REPORTS'],
  audit: ['audit.view', 'audit.export', 'audit.print', 'VIEW_AUDIT'],
  users: ['users.view', 'users.create', 'users.update', 'users.delete', 'MANAGE_USERS'],
  settings: ['settings.view', 'settings.create', 'settings.update', 'settings.delete', 'SYSTEM_SETTINGS', 'MANAGE_ROLES', 'MANAGE_RESERVED_CODES'],
  income: ['revenue.view', 'revenue.create', 'revenue.update', 'RECORD_INCOME', 'MANAGE_REVENUE_HEADS'],
  expense: ['expenses.view', 'expenses.create', 'expenses.update', 'RECORD_EXPENSE', 'MANAGE_EXPENSE_HEADS'],
  invoices: ['invoices.view', 'invoices.create', 'invoices.update', 'invoices.delete', 'VIEW_INVOICES', 'CREATE_INVOICE'],
  members: ['members.view', 'members.create', 'members.update', 'members.delete', 'VIEW_MEMBERS', 'CREATE_MEMBER'],
  beneficiaries: ['beneficiaries.view', 'beneficiaries.create', 'beneficiaries.update', 'beneficiaries.delete', 'VIEW_BENEFICIARIES', 'CREATE_BENEFICIARY'],
  donations: ['donations.view', 'donations.create', 'donations.update', 'donations.delete', 'donations.post', 'donations.approve', 'VIEW_DONATIONS', 'CREATE_DONATION'],
  hallBookings: ['hallBookings.view', 'hallBookings.create', 'hallBookings.update', 'hallBookings.delete', 'hallBookings.post', 'hallBookings.approve', 'VIEW_HALL_BOOKINGS', 'CREATE_HALL_BOOKING'],
  revenueCollections: ['revenueCollections.view', 'revenueCollections.create', 'revenueCollections.update', 'revenueCollections.delete', 'revenueCollections.post', 'VIEW_REVENUE_COLLECTIONS', 'CREATE_REVENUE_COLLECTION'],
  zakatCards: ['zakatCards.view', 'zakatCards.create', 'zakatCards.update', 'zakatCards.delete', 'zakatCards.post', 'VIEW_ZAKAT_CARDS', 'CREATE_ZAKAT_CARD'],
  zakat: ['zakat.view', 'zakat.create', 'zakat.update', 'zakat.delete', 'zakat.post', 'zakat.approve', 'VIEW_ZAKAT_CARDS', 'CREATE_ZAKAT_CARD'],
  donors: ['donors.view', 'donors.create', 'donors.update', 'donors.delete', 'VIEW_DONORS', 'CREATE_DONOR'],
  customers: ['customers.view', 'customers.create', 'customers.update', 'customers.delete', 'VIEW_CUSTOMERS', 'CREATE_CUSTOMER'],
};

/**
 * Derives Access Level string from active actions for a module
 */
function deriveAccessLevel(moduleKey: string, actionsObj: Record<string, boolean>): string {
  const mod = ERP_MODULES_MAP[moduleKey];
  if (!mod) return 'No Access';

  const allowed = mod.actions;
  const activeActions = allowed.filter((act) => !!actionsObj[act]);

  if (activeActions.length === 0) return 'No Access';

  if (allowed.every((act) => !!actionsObj[act])) {
    return 'Full Access';
  }

  // Manager: view, create, update + (approve and/or post if supported)
  const isManagerPattern =
    actionsObj.view &&
    actionsObj.create &&
    actionsObj.update &&
    (!allowed.includes('approve') || actionsObj.approve) &&
    (!allowed.includes('post') || actionsObj.post) &&
    !actionsObj.delete;

  if (isManagerPattern && (allowed.includes('approve') || allowed.includes('post'))) {
    return 'Manager';
  }

  // Editor: view, create, update (no delete, approve, post)
  if (
    actionsObj.view &&
    actionsObj.create &&
    actionsObj.update &&
    !actionsObj.delete &&
    !actionsObj.approve &&
    !actionsObj.post
  ) {
    return 'Editor';
  }

  // Data Entry: view, create
  if (
    actionsObj.view &&
    actionsObj.create &&
    !actionsObj.update &&
    !actionsObj.delete &&
    !actionsObj.approve &&
    !actionsObj.post
  ) {
    return 'Data Entry';
  }

  // View Only: view only
  if (actionsObj.view && activeActions.length === 1) {
    return 'View Only';
  }

  return 'Custom';
}

/**
 * Formats a DB Role into a complete structured Role DTO
 */
function formatRole(role: any) {
  const activePermNames = new Set(role.rolePermissions.map((rp: any) => rp.permission.name));

  // Build modulePermissions map: { [moduleKey]: { [action]: boolean } }
  const modulePermissions: Record<string, Record<string, boolean>> = {};
  const accessLevels: Record<string, string> = {};
  let totalPermissionsCount = 0;
  let totalModulesCount = 0;

  for (const mod of ERP_MODULE_DEFINITIONS) {
    const actMap: Record<string, boolean> = {};
    let hasAnyInModule = false;

    for (const act of mod.actions) {
      const canonicalName = `${mod.key}.${act}`;
      const isGranted =
        role.isPrivileged ||
        activePermNames.has(canonicalName) ||
        // Check legacy mapping expansions if canonical not directly in DB
        (act === 'view' && (activePermNames.has(`VIEW_${mod.key.toUpperCase()}`) || activePermNames.has('VIEW_REPORTS') && (mod.key === 'reports' || mod.key === 'generalLedger'))) ||
        (act === 'create' && (activePermNames.has(`CREATE_${mod.key.toUpperCase()}`) || activePermNames.has('RECORD_INCOME') && mod.key === 'revenue' || activePermNames.has('RECORD_EXPENSE') && mod.key === 'expenses')) ||
        (act === 'post' && (activePermNames.has('ledger.post') || activePermNames.has('POST_JOURNAL')));

      actMap[act] = isGranted;
      if (isGranted) {
        totalPermissionsCount++;
        hasAnyInModule = true;
      }
    }

    if (hasAnyInModule) {
      totalModulesCount++;
    }

    modulePermissions[mod.key] = actMap;
    accessLevels[mod.key] = role.isPrivileged ? 'Full Access' : deriveAccessLevel(mod.key, actMap);
  }

  // Legacy flat boolean permissions map for backwards compatibility
  const legacyPermissions: Record<string, boolean> = {};
  for (const key of Object.keys(LEGACY_PERM_MAP)) {
    legacyPermissions[key] =
      role.isPrivileged ||
      LEGACY_PERM_MAP[key].some((p) => activePermNames.has(p) || (modulePermissions[key] && modulePermissions[key].view));
  }

  const locked =
    role.isPrivileged ||
    role.name === 'Super Admin' ||
    role.name === 'Admin' ||
    role.description?.includes('Locked');

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isPrivileged: role.isPrivileged,
    locked,
    modulesCount: totalModulesCount,
    permissionsCount: totalPermissionsCount,
    assignedUsersCount: role.users?.length || 0,
    modulePermissions,
    accessLevels,
    rawPermissions: Array.from(activePermNames),
    permissions: legacyPermissions,
  };
}

/**
 * Converts submitted permission data into a list of canonical permission names
 */
function extractPermissionsToAssign(body: any): string[] {
  const permissionsToAssign = new Set<string>();

  // Case 1: Rich modulePermissions object { donations: { view: true, create: true, ... } }
  if (body.modulePermissions && typeof body.modulePermissions === 'object') {
    for (const [modKey, actions] of Object.entries(body.modulePermissions)) {
      if (actions && typeof actions === 'object') {
        for (const [act, isEnabled] of Object.entries(actions as Record<string, boolean>)) {
          if (isEnabled) {
            permissionsToAssign.add(`${modKey}.${act}`);
          }
        }
      }
    }
  }

  // Case 2: Array of permission strings e.g. ["donations.view", "donations.create"]
  if (Array.isArray(body.permissionsList)) {
    body.permissionsList.forEach((p: string) => permissionsToAssign.add(p));
  }

  // Case 3: Legacy flat permissions object { donations: true, coa: true }
  if (body.permissions && typeof body.permissions === 'object' && !body.modulePermissions) {
    for (const [key, isEnabled] of Object.entries(body.permissions)) {
      if (isEnabled && LEGACY_PERM_MAP[key]) {
        LEGACY_PERM_MAP[key].forEach((p) => permissionsToAssign.add(p));
      }
    }
  }

  return Array.from(permissionsToAssign);
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  let id = (req.query.id || (req as any).params?.id || req.body?.id) as string;
  if (!id && req.url) {
    const urlParts = req.url.split('?')[0].split('/');
    const lastPart = urlParts[urlParts.length - 1];
    if (lastPart && lastPart !== 'roles') {
      id = lastPart;
    }
  }

  // Role Management is a security-sensitive operation — MANAGE_ROLES is required
  if (!await verifyPermission(req, res, [PERMS.MANAGE_ROLES, 'roles.view', 'roles.update'])) return;

  // ── GET: List All Roles with granular permission summaries ──────────────────
  if (method === 'GET') {
    const dbRoles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        users: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = dbRoles.map(formatRole);
    return res.status(200).json({ status: 200, data: formatted });
  }

  // ── PUT: Update Role Permissions and Metadata ──────────────────────────────
  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Role ID is required', status: 400 } });
    }

    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });

    if (!existingRole) {
      return res.status(404).json({ error: { message: 'Role not found', status: 404 } });
    }

    if (existingRole.isPrivileged || existingRole.name === 'Super Admin' || existingRole.name === 'Admin') {
      return res.status(400).json({
        error: { message: 'System Admin role permissions cannot be modified from the panel', status: 400 },
      });
    }

    const { name, description, locked, modulePermissions, permissions, permissionsList } = req.body;

    const updateData: any = {};
    if (name && name.trim() && name.trim() !== existingRole.name) {
      const trimmed = name.trim();
      const duplicate = await prisma.role.findUnique({ where: { name: trimmed } });
      if (duplicate && duplicate.id !== id) {
        return res.status(400).json({ error: { message: `A role named "${trimmed}" already exists`, status: 400 } });
      }
      updateData.name = trimmed;
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : `${existingRole.name} Role`;
    }

    if (locked !== undefined) {
      const baseName = updateData.name || existingRole.name;
      updateData.description = locked ? `${baseName} Role (Locked)` : (description || `${baseName} Role`);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.role.update({
        where: { id },
        data: updateData,
      });
    }

    // Process updated permissions if provided
    const permissionsToAssign = extractPermissionsToAssign(req.body);
    if (modulePermissions !== undefined || permissions !== undefined || permissionsList !== undefined) {
      // Ensure all permission records exist in DB
      for (const permName of permissionsToAssign) {
        await prisma.permission.upsert({
          where: { name: permName },
          update: {},
          create: { name: permName, description: `Access to ${permName}` },
        });
      }

      const dbPermissions = await prisma.permission.findMany({
        where: { name: { in: permissionsToAssign } },
      });

      // Clear existing and assign new permissions in a transaction
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        prisma.rolePermission.createMany({
          data: dbPermissions.map((p) => ({
            roleId: id,
            permissionId: p.id,
          })),
        }),
      ]);
    }

    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { permission: true } },
        users: { select: { id: true } },
      },
    });

    await logAudit(
      req.user.id,
      `Updated role "${updatedRole?.name || existingRole.name}" permissions`,
      'ROLES',
      existingRole.rolePermissions.map((rp) => rp.permission.name),
      updatedRole?.rolePermissions.map((rp) => rp.permission.name),
      req.headers['x-forwarded-for'] as string,
      req.headers['user-agent']
    );

    return res.status(200).json({
      status: 200,
      message: 'Role permissions updated successfully',
      data: updatedRole ? formatRole(updatedRole) : null,
    });
  }

  // ── POST: Create New Dynamic Role ──────────────────────────────────────────
  if (method === 'POST') {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Role name is required', status: 400 } });
    }

    const trimmedName = name.trim();
    const existing = await prisma.role.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      return res.status(400).json({ error: { message: `A role named "${trimmedName}" already exists`, status: 400 } });
    }

    // Create the new role record
    const newRole = await prisma.role.create({
      data: {
        name: trimmedName,
        description: description?.trim() || `${trimmedName} Role`,
      },
    });

    // Assign initial permissions if provided
    const permissionsToAssign = extractPermissionsToAssign(req.body);
    if (permissionsToAssign.length > 0) {
      for (const permName of permissionsToAssign) {
        await prisma.permission.upsert({
          where: { name: permName },
          update: {},
          create: { name: permName, description: `Access to ${permName}` },
        });
      }

      const dbPermissions = await prisma.permission.findMany({
        where: { name: { in: permissionsToAssign } },
      });

      if (dbPermissions.length > 0) {
        await prisma.rolePermission.createMany({
          data: dbPermissions.map((p) => ({
            roleId: newRole.id,
            permissionId: p.id,
          })),
        });
      }
    }

    const createdRoleWithPerms = await prisma.role.findUnique({
      where: { id: newRole.id },
      include: {
        rolePermissions: { include: { permission: true } },
        users: { select: { id: true } },
      },
    });

    await logAudit(
      req.user.id,
      `Created custom role "${trimmedName}"`,
      'ROLES',
      null,
      { roleId: newRole.id, name: trimmedName, permissionsCount: permissionsToAssign.length },
      req.headers['x-forwarded-for'] as string,
      req.headers['user-agent']
    );

    const formattedNewRole = createdRoleWithPerms ? formatRole(createdRoleWithPerms) : null;
    return res.status(201).json({
      status: 201,
      message: 'Role created successfully',
      data: formattedNewRole,
    });
  }

  // ── DELETE: Delete Role ────────────────────────────────────────────────────
  if (method === 'DELETE') {
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Role ID is required', status: 400 },
        message: 'Role ID is required',
      });
    }

    const trimmedId = id.trim();

    // Check UUID format
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmedId);
    if (!isUuid) {
      return res.status(404).json({
        success: false,
        error: { message: 'Role not found', status: 404 },
        message: 'Role not found',
      });
    }

    const roleToDelete = await prisma.role.findUnique({
      where: { id: trimmedId },
      include: { users: true },
    });

    if (!roleToDelete) {
      return res.status(404).json({
        success: false,
        error: { message: 'Role not found', status: 404 },
        message: 'Role not found',
      });
    }

    // Protected system roles: Super Admin and Admin cannot be deleted
    const PROTECTED_SYSTEM_ROLES = ['Super Admin', 'Admin'];
    if (PROTECTED_SYSTEM_ROLES.includes(roleToDelete.name)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `${roleToDelete.name} is a protected system role and cannot be deleted.`,
          status: 403,
        },
        message: `${roleToDelete.name} is a protected system role and cannot be deleted.`,
      });
    }

    // Check if any users are assigned to this role
    if (roleToDelete.users && roleToDelete.users.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          message: `This role is assigned to ${roleToDelete.users.length} user(s). Reassign those users before deleting the role.`,
          status: 409,
        },
        message: `This role is assigned to ${roleToDelete.users.length} user(s). Reassign those users before deleting the role.`,
      });
    }

    // Cascade delete role permissions and delete role
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: trimmedId } });
      await tx.role.delete({ where: { id: trimmedId } });
    });

    await logAudit(
      req.user.id,
      'ROLE_DELETED',
      'ROLES',
      { id: roleToDelete.id, name: roleToDelete.name },
      null,
      req.headers['x-forwarded-for'] as string,
      req.headers['user-agent']
    );

    return res.status(200).json({
      status: 200,
      success: true,
      message: `Role "${roleToDelete.name}" deleted successfully`,
    });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
