import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { notify } from '../_utils/notify.js';

function isUniqueViolation(err: any): boolean {
  return err?.code === 'P2002';
}

const DONOR_CODE_PREFIX = 'DNR-';

// SQA fix: previously derived from `count()`, which races under concurrent
// creation and reuses numbers after a donor is deleted (count shrinks). Max
// existing numeric suffix avoids the reuse issue; the caller retries on the
// rare remaining collision.
async function nextDonorCode(tx: any): Promise<string> {
  const existing = await tx.donor.findMany({
    where: { donorCode: { startsWith: DONOR_CODE_PREFIX } },
    select: { donorCode: true },
  });
  const maxNum = existing.reduce((max: number, d: { donorCode: string }) => {
    const n = parseInt(d.donorCode.slice(DONOR_CODE_PREFIX.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${DONOR_CODE_PREFIX}${String(maxNum + 1).padStart(4, '0')}`;
}

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

    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ error: { message: 'Donor full name is required', status: 400 } });
    }
    if (fatherName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: 'Father / husband name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (cnic && !/^\d{13}$/.test(String(cnic))) {
      return res.status(400).json({ error: { message: 'CNIC must contain exactly 13 digits', status: 400 } });
    }
    if (mobile && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: 'Mobile number must contain exactly 11 digits', status: 400 } });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: { message: 'Email address is invalid', status: 400 } });
    }
    if (address && !/^[a-zA-Z0-9\s.,#/-]{3,160}$/.test(String(address))) {
      return res.status(400).json({ error: { message: 'Address contains unsupported characters', status: 400 } });
    }
    if (city && !/^[a-zA-Z\s.-]{2,80}$/.test(String(city))) {
      return res.status(400).json({ error: { message: 'City can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }

    if (cnic) {
      const existingCnic = await prisma.donor.findUnique({ where: { cnic } });
      if (existingCnic) {
        return res.status(400).json({ error: { message: 'A donor with this CNIC already exists', status: 400 } });
      }
    }

    // SQA fix: uniqueness was only enforced on CNIC, which is optional — two
    // donors with identical name+mobile but no CNIC could be created
    // indefinitely, fragmenting donation history for the same real person.
    // This is a non-blocking, informational warning only (not a rejection),
    // since a shared name+mobile can legitimately belong to different people.
    let duplicateWarning: string | undefined;
    if (!cnic && mobile) {
      const possibleDuplicate = await prisma.donor.findFirst({
        where: { fullName: { equals: fullName, mode: 'insensitive' }, mobile },
      });
      if (possibleDuplicate) {
        duplicateWarning = `A donor named "${possibleDuplicate.fullName}" with the same mobile number already exists (${possibleDuplicate.donorCode}). This donor was still created — please verify this isn't a duplicate.`;
      }
    }

    let newDonor;
    for (let attempt = 1; ; attempt++) {
      const donorCode = await nextDonorCode(prisma);
      try {
        newDonor = await prisma.donor.create({
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
        break;
      } catch (err: any) {
        if (isUniqueViolation(err) && attempt < 5 &&
            (err.meta?.target as string[] | undefined)?.includes('donorCode')) {
          continue;
        }
        throw err;
      }
    }

    await logAudit(req.user.id, 'Create Donor', 'DONOR', null, newDonor, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: 'Donor Added',
      message: `${(newDonor as any).name || 'Donor'} added.`,
      module: 'Donors',
      recordId: (newDonor as any).id,
      actionType: 'CREATE',
    });

    return res.status(201).json({ status: 201, data: newDonor, warning: duplicateWarning });
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

    if (fullName !== undefined && !String(fullName).trim()) {
      return res.status(400).json({ error: { message: 'Donor full name is required', status: 400 } });
    }
    if (fatherName !== undefined && fatherName !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: 'Father / husband name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (cnic !== undefined && cnic !== '' && !/^\d{13}$/.test(String(cnic))) {
      return res.status(400).json({ error: { message: 'CNIC must contain exactly 13 digits', status: 400 } });
    }
    if (mobile !== undefined && mobile !== '' && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: 'Mobile number must contain exactly 11 digits', status: 400 } });
    }
    if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: { message: 'Email address is invalid', status: 400 } });
    }
    if (address !== undefined && address !== '' && !/^[a-zA-Z0-9\s.,#/-]{3,160}$/.test(String(address))) {
      return res.status(400).json({ error: { message: 'Address contains unsupported characters', status: 400 } });
    }
    if (city !== undefined && city !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(city))) {
      return res.status(400).json({ error: { message: 'City can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }

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

    await notify(req, {
      title: 'Donor Updated',
      message: `${(updatedDonor as any).name || 'Donor'} updated.`,
      module: 'Donors',
      recordId: (updatedDonor as any).id,
      actionType: 'UPDATE',
    });

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

    await notify(req, {
      title: existingDonors.length > 1 ? 'Donors Deleted' : 'Donor Deleted',
      message: `${existingDonors.length} donor(s) deleted.`,
      module: 'Donors',
      recordId: existingDonors.length === 1 ? existingDonors[0].id : null,
      actionType: 'DELETE',
      visibility: 'ADMIN_ONLY',
    });

    return res.status(200).json({ status: 200, message: `${existingDonors.length} donor(s) deleted successfully` });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
