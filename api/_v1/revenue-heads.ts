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

  if (method === 'GET') {
    const dbRevenueHeads = await prisma.revenueHead.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ status: 200, data: dbRevenueHeads });
  }

  // Enforce CREATE_ACCOUNT or UPDATE_ACCOUNT permissions for revenue changes
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

  if (method === 'POST') {
    if (!checkPerm('CREATE_ACCOUNT')) {
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

    return res.status(201).json({ status: 201, data: newHead });
  }

  if (method === 'PUT') {
    if (!checkPerm('UPDATE_ACCOUNT')) {
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

    return res.status(200).json({ status: 200, data: updatedHead });
  }

  if (method === 'DELETE') {
    if (!checkPerm('DELETE_ACCOUNT')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Revenue Head ID is required', status: 400 } });
    }

    const existingHead = await prisma.revenueHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: 'Revenue Head not found', status: 404 } });
    }

    await prisma.revenueHead.delete({ where: { id } });

    await logAudit(req.user.id, 'Delete Revenue Head', 'REVENUE', existingHead, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Revenue Head deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
