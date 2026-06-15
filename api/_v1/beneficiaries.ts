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
    const beneficiaries = await prisma.beneficiary.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ status: 200, data: beneficiaries });
  }

  if (method === 'POST') {
    const { name, cnic, mobile, address, remarks, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ error: { message: 'Name is required', status: 400 } });
    }

    const newBeneficiary = await prisma.beneficiary.create({
      data: {
        name,
        cnic: cnic || null,
        mobile: mobile || null,
        address: address || null,
        remarks: remarks || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit(req.user.id, 'Create Beneficiary', 'DONATION', null, newBeneficiary, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newBeneficiary });
  }

  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Beneficiary ID is required', status: 400 } });
    }

    const existingBeneficiary = await prisma.beneficiary.findUnique({ where: { id } });
    if (!existingBeneficiary) {
      return res.status(404).json({ error: { message: 'Beneficiary not found', status: 404 } });
    }

    const { name, cnic, mobile, address, remarks, isActive } = req.body;

    const updatedBeneficiary = await prisma.beneficiary.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        cnic: cnic !== undefined ? (cnic || null) : undefined,
        mobile: mobile !== undefined ? (mobile || null) : undefined,
        address: address !== undefined ? (address || null) : undefined,
        remarks: remarks !== undefined ? (remarks || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    await logAudit(req.user.id, 'Update Beneficiary', 'DONATION', existingBeneficiary, updatedBeneficiary, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedBeneficiary });
  }

  if (method === 'DELETE') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Beneficiary ID is required', status: 400 } });
    }

    const existingBeneficiary = await prisma.beneficiary.findUnique({ where: { id } });
    if (!existingBeneficiary) {
      return res.status(404).json({ error: { message: 'Beneficiary not found', status: 404 } });
    }

    await prisma.beneficiary.delete({ where: { id } });

    await logAudit(req.user.id, 'Delete Beneficiary', 'DONATION', existingBeneficiary, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Beneficiary deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
