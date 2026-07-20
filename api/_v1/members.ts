import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { logger } from '../_utils/logger.js';

// ── Membership number generation ─────────────────────────────────────────────
// Format: KML-0001, KML-0002, … Unique (DB constraint) and immutable: generated
// exactly once — at registration, or lazily backfilled for legacy members that
// predate auto-generation — and never regenerated or overwritten afterwards.

const MEMBER_NO_PREFIX = 'KML-';

async function nextMemberNo(): Promise<string> {
  // Compute the max numerically (not lexically, which breaks past 4 digits)
  const existing = await prisma.member.findMany({
    where: { memberNo: { startsWith: MEMBER_NO_PREFIX } },
    select: { memberNo: true },
  });
  const maxNum = existing.reduce((max, m) => {
    const n = parseInt(m.memberNo!.slice(MEMBER_NO_PREFIX.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${MEMBER_NO_PREFIX}${String(maxNum + 1).padStart(4, '0')}`;
}

function isUniqueViolation(err: any): boolean {
  return err?.code === 'P2002';
}

/**
 * Assign a memberNo to a member that doesn't have one yet, retrying on the
 * (rare) concurrent-insert collision against the @unique constraint.
 */
async function assignMemberNo(memberId: string): Promise<string> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const candidate = await nextMemberNo();
    try {
      // Guard on memberNo:null so a concurrent assignment is never overwritten
      const updated = await prisma.member.updateMany({
        where: { id: memberId, memberNo: null },
        data: { memberNo: candidate },
      });
      if (updated.count === 0) {
        // Someone else assigned it in the meantime — read and return theirs
        const current = await prisma.member.findUnique({ where: { id: memberId }, select: { memberNo: true } });
        return current?.memberNo ?? candidate;
      }
      logger.info({ memberId, memberNo: candidate }, 'Assigned membership number');
      return candidate;
    } catch (err: any) {
      if (isUniqueViolation(err) && attempt < 5) continue;
      throw err;
    }
  }
  throw new Error('Failed to assign a unique membership number');
}

/**
 * One-time lazy backfill: give legacy members (created before auto-generation)
 * a permanent memberNo the first time they are read. Stored immediately, so
 * subsequent reads return the same value — nothing is regenerated per view.
 */
async function backfillMemberNos<T extends { id: string; memberNo: string | null }>(members: T[]): Promise<T[]> {
  const missing = members.filter(m => !m.memberNo);
  for (const m of missing) {
    m.memberNo = await assignMemberNo(m.id);
  }
  return members;
}

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
      await backfillMemberNos([member]);
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
    await backfillMemberNos(members);
    return res.status(200).json({ status: 200, data: members, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'POST') {
    const {
      memberNo, fullName, fatherName, cnic, dob, address, mobile,
      email, city, area, ghamName, education, profession, company, doi,
      photoUrl, cnicFrontUrl, cnicBackUrl, isActive
    } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: { message: 'Full Member Name is required', status: 400 } });
    }

    // Reject Base64 payloads — images must be uploaded via /api/v1/upload first
    for (const [field, value] of [['photoUrl', photoUrl], ['cnicFrontUrl', cnicFrontUrl], ['cnicBackUrl', cnicBackUrl]] as const) {
      if (value && String(value).startsWith('data:')) {
        return res.status(400).json({ error: { message: `${field}: send a URL, not a Base64 image. Use /api/v1/upload first.`, status: 400 } });
      }
    }

    logger.info({ photoUrl, cnicFrontUrl, cnicBackUrl }, 'Saving new member with image URLs');

    // memberNo: honor an explicitly provided one; otherwise generate. The
    // create is retried on unique-constraint collision (concurrent registration).
    let newMember;
    for (let attempt = 1; ; attempt++) {
      const memberNoToUse = (memberNo && String(memberNo).trim()) || await nextMemberNo();
      try {
        newMember = await prisma.member.create({
          data: {
            memberNo: memberNoToUse,
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
            cnicFrontUrl: cnicFrontUrl || null,
            cnicBackUrl: cnicBackUrl || null,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
          },
        });
        break;
      } catch (err: any) {
        // Retry only on a generated-memberNo collision; an explicitly provided
        // duplicate (or any other unique violation, e.g. cnic) surfaces as 400.
        if (isUniqueViolation(err) && !memberNo && attempt < 5 &&
            (err.meta?.target as string[] | undefined)?.includes('memberNo')) {
          continue;
        }
        if (isUniqueViolation(err)) {
          const target = (err.meta?.target as string[] | undefined)?.join(', ') || 'field';
          return res.status(400).json({ error: { message: `A member with this ${target} already exists.`, status: 400 } });
        }
        throw err;
      }
    }

    logger.info({ memberId: newMember.id, memberNo: newMember.memberNo, photoUrl: newMember.photoUrl }, 'Member saved to database successfully');

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
      email, city, area, ghamName, education, profession, company, doi,
      photoUrl, cnicFrontUrl, cnicBackUrl, isActive
    } = req.body;

    // Reject Base64 payloads — images must be uploaded via /api/v1/upload first
    for (const [field, value] of [['photoUrl', photoUrl], ['cnicFrontUrl', cnicFrontUrl], ['cnicBackUrl', cnicBackUrl]] as const) {
      if (value && String(value).startsWith('data:')) {
        return res.status(400).json({ error: { message: `${field}: send a URL, not a Base64 image. Use /api/v1/upload first.`, status: 400 } });
      }
    }

    logger.info({ memberId: id, photoUrl, cnicFrontUrl, cnicBackUrl }, 'Updating member with image URLs');

    // memberNo is immutable once assigned: ignore any incoming value when one
    // exists; backfill legacy members that still lack one.
    if (!existingMember.memberNo) {
      existingMember.memberNo = await assignMemberNo(id);
    }

    const updatedMember = await prisma.member.update({
      where: { id },
      data: {
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
        cnicFrontUrl: cnicFrontUrl !== undefined ? (cnicFrontUrl || null) : undefined,
        cnicBackUrl: cnicBackUrl !== undefined ? (cnicBackUrl || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    logger.info({ memberId: updatedMember.id, photoUrl: updatedMember.photoUrl }, 'Member updated in database successfully');

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
