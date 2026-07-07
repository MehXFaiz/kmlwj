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
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
    });
    return res.status(200).json({ status: 200, data: customers });
  }

  if (method === 'POST') {
    const { name, email, phone, address, company, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ error: { message: 'Name is required', status: 400 } });
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
