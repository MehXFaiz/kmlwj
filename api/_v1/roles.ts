import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;

  // Verify User Role & Permissions
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const isSuperAdmin = user?.role.name === 'Super Admin';

  const checkPerm = (perm: string) => {
    if (isSuperAdmin) return true;
    return userPerms.includes(perm);
  };

  if (!checkPerm('MANAGE_ROLES')) {
    return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
  }

  // Perm mapping definition
  const permMap: Record<string, string[]> = {
    coa: ['CREATE_ACCOUNT', 'UPDATE_ACCOUNT', 'DELETE_ACCOUNT', 'LOCK_ACCOUNT'],
    journals: ['VIEW_REPORTS', 'POST_JOURNAL'],
    reports: ['VIEW_REPORTS'],
    users: ['MANAGE_USERS'],
    settings: ['MANAGE_ROLES', 'MANAGE_RESERVED_CODES'],
    income: ['RECORD_INCOME', 'CREATE_ACCOUNT'],
    expense: ['RECORD_EXPENSE', 'CREATE_ACCOUNT'],
    invoices: ['VIEW_INVOICES'],
  };

  if (method === 'GET') {
    const dbRoles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      },
      orderBy: { name: 'asc' },
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
        invoices: permMap.invoices.every((p) => activePermNames.includes(p)),
      };

      // Check if role is locked (Super Admin cannot be modified, or check description)
      const locked = role.name === 'Super Admin' || role.description?.includes('Locked');

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions,
        locked,
      };
    });

    return res.status(200).json({ status: 200, data: formatted });
  }

  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Role ID is required', status: 400 } });
    }

    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } }
    });

    if (!existingRole) {
      return res.status(404).json({ error: { message: 'Role not found', status: 404 } });
    }

    if (existingRole.name === 'Super Admin') {
      return res.status(400).json({ error: { message: 'Super Admin permissions cannot be modified', status: 400 } });
    }

    const { permissions, locked } = req.body;

    // Handle lock status update if present
    if (locked !== undefined) {
      await prisma.role.update({
        where: { id },
        data: {
          description: locked ? `${existingRole.name} Role (Locked)` : `${existingRole.name} Role`
        }
      });
    }

    if (permissions) {
      // Collect all permission names to add
      const permissionsToAssign: string[] = [];
      Object.keys(permissions).forEach((key) => {
        if (permissions[key] && permMap[key]) {
          permissionsToAssign.push(...permMap[key]);
        }
      });

      // Ensure permissions exist in DB
      for (const permName of permissionsToAssign) {
        await prisma.permission.upsert({
          where: { name: permName },
          update: {},
          create: { name: permName, description: `Access to ${permName}` }
        });
      }

      // Fetch corresponding permission records from DB
      const dbPermissions = await prisma.permission.findMany({
        where: {
          name: { in: permissionsToAssign }
        }
      });

      // Clear existing permissions for this role and add new ones
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
      'Update Role Permissions',
      'ROLES',
      existingRole.rolePermissions.map((rp) => rp.permission.name),
      updatedRole?.rolePermissions.map((rp) => rp.permission.name),
      req.headers['x-forwarded-for'] as string,
      req.headers['user-agent']
    );

    return res.status(200).json({ status: 200, message: 'Role updated successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
