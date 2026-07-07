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
    const search = (req.query.search as string) || '';
    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { donorCode: { contains: search, mode: 'insensitive' } },
        { cnic: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }
    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const [donors, total] = await Promise.all([
      prisma.donor.findMany({
        where: whereClause,
        orderBy: { donorCode: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.donor.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: donors, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'POST') {
    const { fullName, fatherName, mobile, cnic, email, address, city, isActive } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: { message: 'Donor full name is required', status: 400 } });
    }

    if (cnic) {
      const existingCnic = await prisma.donor.findUnique({ where: { cnic } });
      if (existingCnic) {
        return res.status(400).json({ error: { message: 'A donor with this CNIC already exists', status: 400 } });
      }
    }

    // Generate donorCode e.g. DNR-0001
    const count = await prisma.donor.count();
    const nextNum = (count + 1).toString().padStart(4, '0');
    const donorCode = `DNR-${nextNum}`;

    const newDonor = await prisma.donor.create({
      data: {
        donorCode,
        fullName,
        fatherName: fatherName || null,
        mobile: mobile || null,
        cnic: cnic || null,
        email: email || null,
        address: address || null,
        city: city || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit(req.user.id, 'Create Donor', 'DONOR', null, newDonor, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newDonor });
  }

  if (method === 'PUT' || method === 'PATCH') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Donor ID is required', status: 400 } });
    }

    const existingDonor = await prisma.donor.findUnique({ where: { id } });
    if (!existingDonor) {
      return res.status(404).json({ error: { message: 'Donor not found', status: 404 } });
    }

    const { fullName, fatherName, mobile, cnic, email, address, city, isActive } = req.body;

    if (cnic && cnic !== existingDonor.cnic) {
      const existingCnic = await prisma.donor.findUnique({ where: { cnic } });
      if (existingCnic) {
        return res.status(400).json({ error: { message: 'A donor with this CNIC already exists', status: 400 } });
      }
    }

    const updatedDonor = await prisma.donor.update({
      where: { id },
      data: {
        fullName: fullName !== undefined ? fullName : undefined,
        fatherName: fatherName !== undefined ? (fatherName || null) : undefined,
        mobile: mobile !== undefined ? (mobile || null) : undefined,
        cnic: cnic !== undefined ? (cnic || null) : undefined,
        email: email !== undefined ? (email || null) : undefined,
        address: address !== undefined ? (address || null) : undefined,
        city: city !== undefined ? (city || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    await logAudit(req.user.id, 'Update Donor', 'DONOR', existingDonor, updatedDonor, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedDonor });
  }

  if (method === 'DELETE') {
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Donor ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: { message: 'No valid ID provided', status: 400 } });
    }

    const existingDonors = await prisma.donor.findMany({
      where: { id: { in: ids } },
      include: { donations: true },
    });

    if (existingDonors.length === 0) {
      return res.status(404).json({ error: { message: 'No donors found to delete', status: 404 } });
    }

    const donorsWithDonations = existingDonors.filter(d => d.donations.length > 0);
    if (donorsWithDonations.length > 0) {
      return res.status(400).json({
        error: {
          message: `Cannot delete donor(s) with existing donation records (${donorsWithDonations.map(d => d.donorCode).join(', ')})`,
          status: 400,
        },
      });
    }

    await prisma.donor.deleteMany({ where: { id: { in: ids } } });

    for (const d of existingDonors) {
      await logAudit(req.user.id, 'Delete Donor', 'DONOR', d, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
    }

    return res.status(200).json({ status: 200, message: `${existingDonors.length} donor(s) deleted successfully` });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
