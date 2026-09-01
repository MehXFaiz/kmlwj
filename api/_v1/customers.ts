import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { enforceRestrictedRolePolicy } from '../_middlewares/rbac.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from '../_utils/soft-delete.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  // RBAC: PUT/PATCH/DELETE always blocked for non-privileged roles
  if (!await enforceRestrictedRolePolicy(req, res)) return;

  const method = req.method?.toUpperCase() ?? '';
  if (method === 'GET') {
    if (!await verifyPermission(req, res, PERMS.VIEW_CUSTOMERS)) return;
  } else if (method === 'POST') {
    if (!await verifyPermission(req, res, PERMS.CREATE_CUSTOMER)) return;
  } else {
    if (!await verifyPermission(req, res, PERMS.VIEW_CUSTOMERS)) return;
  }

  const id = req.query.id as string;
  const action = (req.query.action || req.body?.action) as string;

  if (method === 'GET') {
    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = getDeletedFilter(req.query);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.customer.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: customers, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: 'Customer ID is required', status: 400 } });
      }
      const existing = await prisma.customer.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Customer not found', status: 404 } });
      }
      const restored = await prisma.customer.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, 'Restore Customer', 'CUSTOMER', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Customer restored successfully', data: restored });
    }
  }

  if (method === 'POST') {
    const { name, email, phone, address, company, isActive } = req.body;

    if (!name || !/^[a-zA-Z\s.-]{3,50}$/.test(String(name))) {
      return res.status(400).json({ error: { message: 'Name should only contain letters, spaces, hyphens, and dots (3-50 chars)', status: 400 } });
    }
    if (email && !/^[\w.+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email))) {
      return res.status(400).json({ error: { message: 'Please enter a valid email address', status: 400 } });
    }
    if (phone && !/^\d{11}$/.test(String(phone))) {
      return res.status(400).json({ error: { message: 'Phone number must contain exactly 11 digits', status: 400 } });
    }
    if (company && !/^[a-zA-Z0-9\s.-]{3,50}$/.test(String(company))) {
      return res.status(400).json({ error: { message: 'Company name should contain only letters, numbers, spaces, hyphens, and dots (3-50 chars)', status: 400 } });
    }

    if (email || phone) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          isDeleted: false,
          OR: [
            ...(email ? [{ email: { equals: String(email), mode: 'insensitive' as const } }] : []),
            ...(phone ? [{ phone: String(phone) }] : []),
          ],
        },
      });
      if (existingCustomer) {
        return res.status(400).json({ error: { message: `A customer with this ${existingCustomer.email === email ? 'email' : 'phone number'} already exists (${existingCustomer.name})`, status: 400 } });
      }
    }

    const newCustomer = await prisma.customer.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        company: company || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit(req.user.id, 'Create Customer', 'CUSTOMER', null, newCustomer, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newCustomer });
  }

  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Customer ID is required', status: 400 } });
    }

    const existingCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!existingCustomer) {
      return res.status(404).json({ error: { message: 'Customer not found', status: 404 } });
    }

    const { name, email, phone, address, company, isActive } = req.body;

    if (name !== undefined && !/^[a-zA-Z\s.-]{3,50}$/.test(String(name))) {
      return res.status(400).json({ error: { message: 'Name should only contain letters, spaces, hyphens, and dots (3-50 chars)', status: 400 } });
    }
    if (email && !/^[\w.+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email))) {
      return res.status(400).json({ error: { message: 'Please enter a valid email address', status: 400 } });
    }
    if (phone && !/^\d{11}$/.test(String(phone))) {
      return res.status(400).json({ error: { message: 'Phone number must contain exactly 11 digits', status: 400 } });
    }
    if (company && !/^[a-zA-Z0-9\s.-]{3,50}$/.test(String(company))) {
      return res.status(400).json({ error: { message: 'Company name should contain only letters, numbers, spaces, hyphens, and dots (3-50 chars)', status: 400 } });
    }

    if (email || phone) {
      const duplicateCustomer = await prisma.customer.findFirst({
        where: {
          id: { not: id },
          isDeleted: false,
          OR: [
            ...(email ? [{ email: { equals: String(email), mode: 'insensitive' as const } }] : []),
            ...(phone ? [{ phone: String(phone) }] : []),
          ],
        },
      });
      if (duplicateCustomer) {
        return res.status(400).json({ error: { message: `A customer with this ${duplicateCustomer.email === email ? 'email' : 'phone number'} already exists (${duplicateCustomer.name})`, status: 400 } });
      }
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        email: email !== undefined ? (email || null) : undefined,
        phone: phone !== undefined ? (phone || null) : undefined,
        address: address !== undefined ? (address || null) : undefined,
        company: company !== undefined ? (company || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    await logAudit(req.user.id, 'Update Customer', 'CUSTOMER', existingCustomer, updatedCustomer, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedCustomer });
  }

  if (method === 'DELETE') {
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Admin or Super Admin can permanently delete records', status: 403 } });
    }

    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Customer ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: { message: 'No valid ID provided', status: 400 } });
    }

    const existingCustomers = await prisma.customer.findMany({
      where: { id: { in: ids } },
      include: { invoices: true },
    });

    if (existingCustomers.length === 0) {
      return res.status(404).json({ error: { message: 'No customers found to delete', status: 404 } });
    }

    if (isPermanent) {
      await prisma.customer.deleteMany({ where: { id: { in: ids } } });
    } else {
      await prisma.customer.updateMany({
        where: { id: { in: ids } },
        data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id }
      });
    }

    for (const c of existingCustomers) {
      await logAudit(req.user.id, isPermanent ? 'Permanent Delete Customer' : 'Delete Customer', 'CUSTOMER', c, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
    }

    return res.status(200).json({ status: 200, message: `${existingCustomers.length} customer(s) deleted successfully` });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
