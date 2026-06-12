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
    const dbExpenseHeads = await prisma.expenseHead.findMany({
      orderBy: { code: 'asc' },
    });
    return res.status(200).json({ status: 200, data: dbExpenseHeads });
  }

  // Enforce CREATE_ACCOUNT or UPDATE_ACCOUNT permissions for expense changes
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

    const { code, name, category, description, budget, actual, status } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: { message: 'Code and Name are required', status: 400 } });
    }

    const newHead = await prisma.expenseHead.create({
      data: {
        code,
        name,
        category: category || 'Operating',
        description,
        status: status || 'Active',
        budget: parseFloat(budget) || 0,
        actual: parseFloat(actual) || 0,
      },
    });

    await logAudit(req.user.id, 'Create Expense Head', 'EXPENSE', null, newHead, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newHead });
  }

  if (method === 'PUT') {
    if (!checkPerm('UPDATE_ACCOUNT')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Expense Head ID is required', status: 400 } });
    }

    const existingHead = await prisma.expenseHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: 'Expense Head not found', status: 404 } });
    }

    const { code, name, category, description, budget, actual, status } = req.body;

    const updatedHead = await prisma.expenseHead.update({
      where: { id },
      data: {
        code: code !== undefined ? code : undefined,
        name: name !== undefined ? name : undefined,
        category: category !== undefined ? category : undefined,
        description: description !== undefined ? description : undefined,
        status: status !== undefined ? status : undefined,
        budget: budget !== undefined ? parseFloat(budget) || 0 : undefined,
        actual: actual !== undefined ? parseFloat(actual) || 0 : undefined,
      },
    });

    await logAudit(req.user.id, 'Modify Expense Head', 'EXPENSE', existingHead, updatedHead, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedHead });
  }

  if (method === 'DELETE') {
    if (!checkPerm('DELETE_ACCOUNT')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Expense Head ID is required', status: 400 } });
    }

    const existingHead = await prisma.expenseHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: 'Expense Head not found', status: 404 } });
    }

    await prisma.expenseHead.delete({ where: { id } });

    await logAudit(req.user.id, 'Delete Expense Head', 'EXPENSE', existingHead, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Expense Head deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
