import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { notify } from '../_utils/notify.js';
import { loadPermissions } from '../_services/permission.service.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, getDeletedFilter } from '../_utils/soft-delete.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;
  const action = (req.query.action || req.body?.action) as string;

  if (method === 'GET') {
    const dbRevenueHeads = await prisma.revenueHead.findMany({
      where: getDeletedFilter(req.query),
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ status: 200, data: dbRevenueHeads });
  }

  const userPerms = await loadPermissions(req);
  const checkPerm = (perm: string) => userPerms.has(perm);

  if (method === 'PUT' || method === 'POST') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: 'Revenue Head ID is required', status: 400 } });
      }
      const existing = await prisma.revenueHead.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Revenue Head not found', status: 404 } });
      }
      const restored = await prisma.revenueHead.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, 'Restore Revenue Head', 'REVENUE', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Revenue Head restored successfully', data: restored });
    }
  }

  if (method === 'POST') {
    if (!checkPerm(PERMS.MANAGE_REVENUE_HEADS)) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    const { name, category, hall, amount, accountId, isActive } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: { message: 'Name and Category are required', status: 400 } });
    }

    const newHead = await prisma.revenueHead.create({
      data: {
        name,
        category,
        hall: category === 'Hall Bookings' ? (hall || null) : null,
        amount: amount !== undefined ? parseFloat(amount) : 0,
        accountId: accountId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit(req.user.id, 'Create Revenue Head', 'REVENUE', null, newHead, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: 'Revenue Head Added',
      message: `Revenue head "${(newHead as any).name}" created.`,
      module: 'Revenue Heads',
      recordId: (newHead as any).id,
      actionType: 'CREATE',
      visibility: 'ADMIN_ONLY',
    });

    return res.status(201).json({ status: 201, data: newHead });
  }

  if (method === 'PUT') {
    if (!checkPerm(PERMS.MANAGE_REVENUE_HEADS)) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Revenue Head ID is required', status: 400 } });
    }

    const existingHead = await prisma.revenueHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: 'Revenue Head not found', status: 404 } });
    }

    const { name, category, hall, amount, accountId, isActive } = req.body;

    const updatedHead = await prisma.revenueHead.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        category: category !== undefined ? category : undefined,
        hall: category === 'Hall Bookings' ? (hall !== undefined ? hall : undefined) : null,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        accountId: accountId !== undefined ? (accountId || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    await logAudit(req.user.id, 'Modify Revenue Head', 'REVENUE', existingHead, updatedHead, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: 'Revenue Head Updated',
      message: `Revenue head "${(updatedHead as any).name}" updated.`,
      module: 'Revenue Heads',
      recordId: (updatedHead as any).id,
      actionType: 'UPDATE',
      visibility: 'ADMIN_ONLY',
    });

    return res.status(200).json({ status: 200, data: updatedHead });
  }

  if (method === 'DELETE') {
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent) {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can permanently delete records', status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: 'Revenue Head ID is required', status: 400 } });
      }
      const existingHead = await prisma.revenueHead.findUnique({ where: { id } });
      if (!existingHead) {
        return res.status(404).json({ error: { message: 'Revenue Head not found', status: 404 } });
      }
      await prisma.revenueHead.delete({ where: { id } });
      await logAudit(req.user.id, 'Permanent Delete Revenue Head', 'REVENUE', existingHead, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Revenue Head permanently deleted successfully' });
    }

    if (!checkPerm(PERMS.MANAGE_REVENUE_HEADS)) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Revenue Head ID is required', status: 400 } });
    }

    const existingHead = await prisma.revenueHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: 'Revenue Head not found', status: 404 } });
    }

    const updated = await prisma.revenueHead.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id }
    });

    await logAudit(req.user.id, 'Delete Revenue Head', 'REVENUE', existingHead, updated, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: 'Revenue Head Deleted',
      message: `Revenue head "${(existingHead as any).name}" deleted.`,
      module: 'Revenue Heads',
      recordId: (existingHead as any).id,
      actionType: 'DELETE',
      visibility: 'ADMIN_ONLY',
    });

    return res.status(200).json({ status: 200, message: 'Revenue Head deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
