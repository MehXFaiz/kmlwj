import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';

const RELATION_TYPES = [
  'FATHER', 'MOTHER', 'HUSBAND', 'WIFE', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER',
  'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON', 'GRANDDAUGHTER', 'UNCLE', 'AUNT',
  'NEPHEW', 'NIECE', 'COUSIN', 'GUARDIAN', 'OTHER',
];

const RECIPROCAL_DEFAULTS: Record<string, string> = {
  FATHER: 'SON', MOTHER: 'SON', HUSBAND: 'WIFE', WIFE: 'HUSBAND',
  SON: 'FATHER', DAUGHTER: 'FATHER', BROTHER: 'BROTHER', SISTER: 'SISTER',
  GRANDFATHER: 'GRANDSON', GRANDMOTHER: 'GRANDSON', GRANDSON: 'GRANDFATHER', GRANDDAUGHTER: 'GRANDFATHER',
  UNCLE: 'NEPHEW', AUNT: 'NEPHEW', NEPHEW: 'UNCLE', NIECE: 'UNCLE',
  COUSIN: 'COUSIN', GUARDIAN: 'OTHER', OTHER: 'OTHER',
};

// Family-tree links follow the same admin-only write rule as the rest of the
// member module (see api/_middlewares/auth.middleware.ts), but "Data Entry"
// roles are additionally allowed to add/edit — only deletion is admin-only.
function isAdminRole(role?: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === 'admin' || r === 'super admin' || r === 'administrator';
}
function canWriteFamilyLinks(role?: string): boolean {
  if (isAdminRole(role)) return true;
  const r = String(role || '').toLowerCase().trim();
  return r.startsWith('data entry') || r === 'data-entry' || r === 'dataentry';
}

const MEMBER_SELECT = {
  id: true, memberNo: true, fullName: true, cnic: true, mobile: true, photoUrl: true,
};

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;

  if (method === 'GET') {
    const memberId = req.query.memberId as string;
    if (!memberId) {
      return res.status(400).json({ error: { message: 'memberId is required', status: 400 } });
    }

    // depth: 0 = only this member's direct links (used for the summary card),
    // 2 = also pull in each direct relative's own links so the tree can show
    // grandparents/grandchildren without one round-trip per node (avoids N+1).
    const depth = req.query.depth === '2' ? 2 : 0;

    const direct = await prisma.familyRelationship.findMany({
      where: { memberId },
      include: { relatedMember: { select: MEMBER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    if (depth !== 2 || direct.length === 0) {
      return res.status(200).json({ status: 200, data: { direct, extended: [] } });
    }

    const relatedIds = [...new Set(direct.map((r) => r.relatedMemberId))];
    const extended = await prisma.familyRelationship.findMany({
      where: { memberId: { in: relatedIds }, relatedMemberId: { not: memberId } },
      include: { relatedMember: { select: MEMBER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({ status: 200, data: { direct, extended } });
  }

  if (method === 'POST') {
    if (!canWriteFamilyLinks(req.user.role)) {
      return res.status(403).json({ error: { message: 'Forbidden: only Admin and Data Entry roles can link family members.', status: 403 } });
    }

    const { memberId, relatedMemberId, relationshipType, reciprocalType, customLabel, reciprocalCustomLabel } = req.body || {};

    if (!memberId || !relatedMemberId) {
      return res.status(400).json({ error: { message: 'memberId and relatedMemberId are required', status: 400 } });
    }
    if (memberId === relatedMemberId) {
      return res.status(400).json({ error: { message: 'A member cannot be linked to themselves.', status: 400 } });
    }
    if (!RELATION_TYPES.includes(relationshipType)) {
      return res.status(400).json({ error: { message: 'Invalid relationship type.', status: 400 } });
    }
    const reciprocal = RELATION_TYPES.includes(reciprocalType) ? reciprocalType : RECIPROCAL_DEFAULTS[relationshipType];

    const [memberA, memberB] = await Promise.all([
      prisma.member.findUnique({ where: { id: memberId } }),
      prisma.member.findUnique({ where: { id: relatedMemberId } }),
    ]);
    if (!memberA || !memberB) {
      return res.status(404).json({ error: { message: 'One or both members were not found.', status: 404 } });
    }

    // Prevent duplicate / circular links: a relationship between this exact
    // pair (in either direction) must not already exist.
    const existing = await prisma.familyRelationship.findFirst({
      where: {
        OR: [
          { memberId, relatedMemberId },
          { memberId: relatedMemberId, relatedMemberId: memberId },
        ],
      },
    });
    if (existing) {
      return res.status(400).json({ error: { message: 'These two members are already linked. Remove the existing relationship before adding a new one.', status: 400 } });
    }

    try {
      const [forward, backward] = await prisma.$transaction([
        prisma.familyRelationship.create({
          data: {
            memberId, relatedMemberId, relationshipType,
            customLabel: relationshipType === 'OTHER' ? (customLabel || null) : null,
          },
          include: { relatedMember: { select: MEMBER_SELECT } },
        }),
        prisma.familyRelationship.create({
          data: {
            memberId: relatedMemberId, relatedMemberId: memberId, relationshipType: reciprocal,
            customLabel: reciprocal === 'OTHER' ? (reciprocalCustomLabel || customLabel || null) : null,
          },
          include: { relatedMember: { select: MEMBER_SELECT } },
        }),
      ]);

      await logAudit(req.user.id, 'Link Family Member', 'MEMBER', null, { forward, backward }, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return res.status(201).json({ status: 201, data: forward });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ error: { message: 'These two members are already linked.', status: 400 } });
      }
      throw err;
    }
  }

  if (method === 'DELETE') {
    if (!isAdminRole(req.user.role)) {
      return res.status(403).json({ error: { message: 'Forbidden: only Admin can remove family links.', status: 403 } });
    }

    const memberId = (req.query.memberId || req.body?.memberId) as string;
    const relatedMemberId = (req.query.relatedMemberId || req.body?.relatedMemberId) as string;
    if (!memberId || !relatedMemberId) {
      return res.status(400).json({ error: { message: 'memberId and relatedMemberId are required', status: 400 } });
    }

    const deleted = await prisma.familyRelationship.deleteMany({
      where: {
        OR: [
          { memberId, relatedMemberId },
          { memberId: relatedMemberId, relatedMemberId: memberId },
        ],
      },
    });

    await logAudit(req.user.id, 'Unlink Family Member', 'MEMBER', { memberId, relatedMemberId }, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: `Removed ${deleted.count} relationship link(s)` });
  }

  return res.status(405).json({ error: { message: 'Method not allowed', status: 405 } });
});
