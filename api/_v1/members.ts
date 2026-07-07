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
    if (id) {
      const member = await prisma.member.findUnique({ where: { id } });
      if (!member) {
        return res.status(404).json({ error: { message: 'Member not found', status: 404 } });
      }
      return res.status(200).json({ status: 200, data: member });
    }
    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.member.count()
    ]);
    return res.status(200).json({ status: 200, data: members, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'POST') {
    const {
      memberNo, fullName, fatherName, cnic, dob, address, mobile,
      email, city, area, ghamName, education, profession, company, doi, photoUrl, isActive
    } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: { message: 'Full Member Name is required', status: 400 } });
    }

    const newMember = await prisma.member.create({
      data: {
        memberNo: memberNo || null,
        fullName,
        fatherName: fatherName || null,
        cnic: cnic || null,
        dob: dob || null,
        address: address || null,
        mobile: mobile || null,
        email: email || null,
        city: city || null,
        area: area || null,
        ghamName: ghamName || null,
        education: education || null,
        profession: profession || null,
        company: company || null,
        doi: doi || null,
        photoUrl: photoUrl || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAudit(req.user.id, 'Register Member', 'MEMBER', null, newMember, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newMember });
  }

  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Member ID is required', status: 400 } });
    }

    const existingMember = await prisma.member.findUnique({ where: { id } });
    if (!existingMember) {
      return res.status(404).json({ error: { message: 'Member not found', status: 404 } });
    }

    const {
      memberNo, fullName, fatherName, cnic, dob, address, mobile,
      email, city, area, ghamName, education, profession, company, doi, photoUrl, isActive
    } = req.body;

    const updatedMember = await prisma.member.update({
      where: { id },
      data: {
        memberNo: memberNo !== undefined ? (memberNo || null) : undefined,
        fullName: fullName || undefined,
        fatherName: fatherName !== undefined ? (fatherName || null) : undefined,
        cnic: cnic !== undefined ? (cnic || null) : undefined,
        dob: dob !== undefined ? (dob || null) : undefined,
        address: address !== undefined ? (address || null) : undefined,
        mobile: mobile !== undefined ? (mobile || null) : undefined,
        email: email !== undefined ? (email || null) : undefined,
        city: city !== undefined ? (city || null) : undefined,
        area: area !== undefined ? (area || null) : undefined,
        ghamName: ghamName !== undefined ? (ghamName || null) : undefined,
        education: education !== undefined ? (education || null) : undefined,
        profession: profession !== undefined ? (profession || null) : undefined,
        company: company !== undefined ? (company || null) : undefined,
        doi: doi !== undefined ? (doi || null) : undefined,
        photoUrl: photoUrl !== undefined ? (photoUrl || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    await logAudit(req.user.id, 'Update Member', 'MEMBER', existingMember, updatedMember, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedMember });
  }

  if (method === 'DELETE') {
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Member ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    await prisma.member.deleteMany({
      where: { id: { in: ids } }
    });

    await logAudit(req.user.id, 'Delete Member(s)', 'MEMBER', { ids }, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: `Successfully deleted ${ids.length} member(s)` });
  }

  return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
});
