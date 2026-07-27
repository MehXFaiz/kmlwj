import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { PERMS } from '../_constants/permissions.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (!await verifyPermission(req, res, PERMS.MANAGE_CUSTOMERS)) return;

  const { method } = req;
  const id = req.query.id as string;

  if (method === 'GET') {
    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.customer.count()
    ]);
    return res.status(200).json({ status: 200, data: customers, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'POST') {
    const { name, email, phone, address, company, isActive } = req.body;

    // SQA fix: previously only a non-empty `name` check existed server-side —
    // all format validation (name/email/phone/company regexes) lived only in
    // CustomerForm.jsx and was trivially bypassed by a direct API call.
    // Mirrors that same client-side validation here.
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

    // SQA fix: no duplicate-customer prevention existed on email/phone —
    // two customers with identical contact details could be created
    // indefinitely (no CNIC field exists on this model to key off instead).
    if (email || phone) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
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

    const customersWithInvoices = existingCustomers.filter(c => c.invoices.length > 0);
    if (customersWithInvoices.length > 0) {
      return res.status(400).json({
        error: {
          message: `Cannot delete customer(s) with existing invoices (${customersWithInvoices.map(c => c.name).join(', ')})`,
          status: 400,
        },
      });
    }

    await prisma.customer.deleteMany({ where: { id: { in: ids } } });

    for (const c of existingCustomers) {
      await logAudit(req.user.id, 'Delete Customer', 'CUSTOMER', c, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
    }

    return res.status(200).json({ status: 200, message: `${existingCustomers.length} customer(s) deleted successfully` });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
