import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { notify } from '../_utils/notify.js';
import { loadPermissions } from '../_services/permission.service.js';
import { PERMS, SECURITY_PERMISSIONS } from '../_constants/permissions.js';
import bcrypt from 'bcrypt';

// A role is "security-sensitive" if it grants any Super-Admin-only permission
// (SYSTEM_SETTINGS, MANAGE_USERS, MANAGE_ROLES). Only an actor who already holds
// SYSTEM_SETTINGS may assign such a role to someone else — this is a permission-set
// check, not a role-name check, so it works for any role (built-in or custom) that
// happens to carry those permissions.
async function roleGrantsSecurityPermission(roleName: string): Promise<boolean> {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) return false;
  const names = role.rolePermissions.map((rp) => rp.permission.name);
  return names.some((n) => SECURITY_PERMISSIONS.includes(n));
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;

  // User Management is a security-sensitive operation — MANAGE_USERS is granted
  // only to Super Admin by seed data/convention.
  if (!await verifyPermission(req, res, PERMS.MANAGE_USERS)) return;
  const userPerms = await loadPermissions(req);
  const actorHoldsSystemSettings = userPerms.has(PERMS.SYSTEM_SETTINGS);

  if (method === 'GET') {
    const dbUsers = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = dbUsers.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role.name,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));

    return res.status(200).json({ status: 200, data: formatted });
  }

  if (method === 'POST') {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: { message: 'Email, password, full name, and role are required', status: 400 } });
    }

    // Only an actor who already holds SYSTEM_SETTINGS may assign a role that grants
    // security-sensitive permissions — otherwise a custom role holding only MANAGE_USERS
    // (delegated for ordinary staff administration) could mint a new security-privileged
    // account and self-escalate.
    if (!actorHoldsSystemSettings && await roleGrantsSecurityPermission(role)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only an account with SYSTEM_SETTINGS permission can grant a security-sensitive role', status: 403 } });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: { message: 'Email already registered', status: 400 } });
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
        isActive: true,
      },
      include: { role: true },
    });

    await logAudit(req.user.id, 'Create User', 'USERS', null, { id: newUser.id, email: newUser.email, role: newUser.role.name }, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: 'User Created',
      message: `${newUser.fullName || newUser.email} added as ${newUser.role.name}.`,
      module: 'Users',
      recordId: newUser.id,
      actionType: 'CREATE',
      visibility: 'ADMIN_ONLY',
    });

    return res.status(201).json({
      status: 201,
      data: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role.name,
        isActive: newUser.isActive,
      },
    });
  }

  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'User ID is required', status: 400 } });
    }

    const existingUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existingUser) {
      return res.status(404).json({ error: { message: 'User not found', status: 404 } });
    }

    const { fullName, role, isActive, password } = req.body;
    const updateData: any = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    if (role !== undefined) {
      if (!actorHoldsSystemSettings && await roleGrantsSecurityPermission(role)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only an account with SYSTEM_SETTINGS permission can grant a security-sensitive role', status: 403 } });
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
      include: { role: true },
    });

    await logAudit(req.user.id, 'Modify User', 'USERS', { id: existingUser.id, fullName: existingUser.fullName, email: existingUser.email, role: existingUser.role.name, isActive: existingUser.isActive }, { id: updatedUser.id, fullName: updatedUser.fullName, email: updatedUser.email, role: updatedUser.role.name, isActive: updatedUser.isActive }, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: password ? 'User Password Reset' : 'User Updated',
      message: password
        ? `Password reset for ${updatedUser.fullName || updatedUser.email}.`
        : `${updatedUser.fullName || updatedUser.email} updated${role && role !== existingUser.role.name ? ` — role changed to ${role}` : ''}.`,
      module: 'Users',
      recordId: updatedUser.id,
      actionType: password ? 'PASSWORD_CHANGE' : 'UPDATE',
      visibility: 'ADMIN_ONLY',
    });

    return res.status(200).json({
      status: 200,
      data: {
        id: updatedUser.id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role.name,
        isActive: updatedUser.isActive,
      },
    });
  }

  if (method === 'DELETE') {
    if (!id) {
      return res.status(400).json({ error: { message: 'User ID is required', status: 400 } });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ error: { message: 'User not found', status: 404 } });
    }

    if (existingUser.id === req.user.id) {
      return res.status(400).json({ error: { message: 'Cannot delete your own user account', status: 400 } });
    }

    try {
      // First delete any refresh tokens to clean up references that cascade but are better removed first
      await prisma.refreshToken.deleteMany({
        where: { userId: id }
      });

      // Attempt hard delete
      await prisma.user.delete({
        where: { id },
      });

      await logAudit(
        req.user.id,
        'Delete User',
        'USERS',
        { id: existingUser.id, email: existingUser.email, fullName: existingUser.fullName },
        null,
        req.headers['x-forwarded-for'] as string,
        req.headers['user-agent']
      );

      await notify(req, {
        title: 'User Deleted',
        message: `${existingUser.fullName || existingUser.email} deleted.`,
        module: 'Users',
        recordId: existingUser.id,
        actionType: 'DELETE',
        visibility: 'SUPER_ADMIN_ONLY',
      });

      return res.status(200).json({ status: 200, message: 'User successfully deleted' });
    } catch (err: any) {
      // Prisma foreign key constraint code is P2003
      if (err.code === 'P2003') {
        const deactivatedUser = await prisma.user.update({
          where: { id },
          data: { isActive: false },
        });

        await logAudit(
          req.user.id,
          'Deactivate User (via Delete)',
          'USERS',
          { id: existingUser.id, isActive: existingUser.isActive },
          { id: deactivatedUser.id, isActive: deactivatedUser.isActive },
          req.headers['x-forwarded-for'] as string,
          req.headers['user-agent']
        );

        return res.status(400).json({
          error: {
            message: 'User has active records (donations, bookings, ledger etc.) and cannot be fully deleted. They have been set to Inactive instead.',
            status: 400
          }
        });
      }

      return res.status(500).json({ error: { message: err.message || 'Internal server error during delete', status: 500 } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
