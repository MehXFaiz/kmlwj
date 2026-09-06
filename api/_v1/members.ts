import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { enforceRestrictedRolePolicy } from '../_middlewares/rbac.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { logger } from '../_utils/logger.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from '../_utils/soft-delete.js';
import { createMemberSchema, updateMemberSchema } from '../_schemas/members.schema.js';

function trimOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const trimmed = String(v).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function trimIfProvided(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  return trimOrNull(v);
}

const MEMBER_NO_PREFIX = 'KML-';

async function nextMemberNo(): Promise<string> {
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

async function assignMemberNo(memberId: string): Promise<string> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const candidate = await nextMemberNo();
    try {
      const updated = await prisma.member.updateMany({
        where: { id: memberId, memberNo: null },
        data: { memberNo: candidate },
      });
      if (updated.count === 0) {
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

  const method = (req.method?.toUpperCase() ?? '');
  const id = req.query.id as string;
  const action = (req.query.action || req.body?.action) as string;

  // Granular RBAC: PUT / PATCH require members.update, DELETE requires members.delete
  if (!await enforceRestrictedRolePolicy(req, res, method === 'DELETE' ? ['members.delete', PERMS.DELETE_MEMBER] : ['members.update', PERMS.UPDATE_MEMBER])) return;

  if (method === 'GET') {
    if (!await verifyPermission(req, res, ['members.view', PERMS.VIEW_MEMBERS])) return;

    if (id && !req.query.limit) {
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
    const whereClause = getDeletedFilter(req.query);

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.member.count({ where: whereClause })
    ]);
    await backfillMemberNos(members);
    return res.status(200).json({ status: 200, data: members, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: 'Member ID is required', status: 400 } });
      }
      const existing = await prisma.member.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Member not found', status: 404 } });
      }
      const restored = await prisma.member.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, 'Restore Member', 'MEMBER', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Member restored successfully', data: restored });
    }
  }

  if (method === 'POST') {
    if (!await verifyPermission(req, res, ['members.create', PERMS.CREATE_MEMBER])) return;

    const validated = createMemberSchema.parse(req.body);
    let {
      memberNo, fullName, fatherName, cnic, dob, address, mobile,
      email, city, area, ghamName, education, profession, company, doi,
      photoUrl, cnicFrontUrl, cnicBackUrl, isActive
    } = validated;

    logger.info({ photoUrl, cnicFrontUrl, cnicBackUrl }, 'Saving new member with image URLs');

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
    if (!await verifyPermission(req, res, ['members.update', PERMS.UPDATE_MEMBER])) return;

    if (!id) {
      return res.status(400).json({ error: { message: 'Member ID is required', status: 400 } });
    }

    const existingMember = await prisma.member.findUnique({ where: { id } });
    if (!existingMember) {
      return res.status(404).json({ error: { message: 'Member not found', status: 404 } });
    }

    const validated = updateMemberSchema.parse(req.body);
    let {
      memberNo, fullName, fatherName, cnic, dob, address, mobile,
      email, city, area, ghamName, education, profession, company, doi,
      photoUrl, cnicFrontUrl, cnicBackUrl, isActive
    } = validated;

    if (fullName !== undefined && !String(fullName).trim()) {
      return res.status(400).json({ error: { message: 'Full Member Name is required', status: 400 } });
    }
    if (fatherName !== undefined && fatherName !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: 'Father name can only contain letters, spaces, hyphens, and dots', status: 400 } });
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
    if (address !== undefined && address !== '' && !/^[a-zA-Z0-9\s.,#/-]{3,200}$/.test(String(address))) {
      return res.status(400).json({ error: { message: 'Address contains unsupported characters', status: 400 } });
    }
    if (city !== undefined && city !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(city))) {
      return res.status(400).json({ error: { message: 'City can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (area !== undefined && area !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(area))) {
      return res.status(400).json({ error: { message: 'Area can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (ghamName !== undefined && ghamName !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(ghamName))) {
      return res.status(400).json({ error: { message: 'Gham name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }

    for (const [field, value] of [['photoUrl', photoUrl], ['cnicFrontUrl', cnicFrontUrl], ['cnicBackUrl', cnicBackUrl]] as const) {
      if (value && String(value).startsWith('data:')) {
        return res.status(400).json({ error: { message: `${field}: send a URL, not a Base64 image. Use /api/v1/upload first.`, status: 400 } });
      }
    }

    logger.info({ memberId: id, photoUrl, cnicFrontUrl, cnicBackUrl }, 'Updating member with image URLs');

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

    const activationChanged =
      isActive !== undefined && Boolean(isActive) !== Boolean(existingMember.isActive);

    return res.status(200).json({ status: 200, data: updatedMember });
  }

  if (method === 'DELETE') {
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Admin or Super Admin can permanently delete records', status: 403 } });
    }

    if (!await verifyPermission(req, res, ['members.delete', PERMS.DELETE_MEMBER])) return;

    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Member ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    await prisma.$transaction(async (tx) => {
      if (isPermanent) {
        await tx.familyRelationship.deleteMany({
          where: { OR: [{ memberId: { in: ids } }, { relatedMemberId: { in: ids } }] }
        });
        await tx.zakatCard.deleteMany({
          where: { memberId: { in: ids } }
        });
        await tx.member.deleteMany({
          where: { id: { in: ids } }
        });
      } else {
        await tx.member.updateMany({
          where: { id: { in: ids } },
          data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
        });
      }
    });

    await logAudit(req.user.id, isPermanent ? 'Permanent Delete Member' : 'Delete Member(s)', 'MEMBER', { ids }, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(200).json({ status: 200, message: `Successfully deleted ${ids.length} member(s)` });
  }

  return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
});
