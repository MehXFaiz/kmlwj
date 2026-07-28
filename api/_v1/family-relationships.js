import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
const RELATION_TYPES = [
  "FATHER",
  "MOTHER",
  "HUSBAND",
  "WIFE",
  "SON",
  "DAUGHTER",
  "BROTHER",
  "SISTER",
  "GRANDFATHER",
  "GRANDMOTHER",
  "GRANDSON",
  "GRANDDAUGHTER",
  "UNCLE",
  "AUNT",
  "NEPHEW",
  "NIECE",
  "COUSIN",
  "GUARDIAN",
  "OTHER"
];
const RECIPROCAL_DEFAULTS = {
  FATHER: "SON",
  MOTHER: "SON",
  HUSBAND: "WIFE",
  WIFE: "HUSBAND",
  SON: "FATHER",
  DAUGHTER: "FATHER",
  BROTHER: "BROTHER",
  SISTER: "SISTER",
  GRANDFATHER: "GRANDSON",
  GRANDMOTHER: "GRANDSON",
  GRANDSON: "GRANDFATHER",
  GRANDDAUGHTER: "GRANDFATHER",
  UNCLE: "NEPHEW",
  AUNT: "NEPHEW",
  NEPHEW: "UNCLE",
  NIECE: "UNCLE",
  COUSIN: "COUSIN",
  GUARDIAN: "OTHER",
  OTHER: "OTHER"
};
const MEMBER_SELECT = {
  id: true,
  memberNo: true,
  fullName: true,
  cnic: true,
  mobile: true,
  photoUrl: true
};
var family_relationships_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    if (!await verifyPermission(req, res, PERMS.VIEW_MEMBERS)) return;
    const memberId = req.query.memberId;
    if (!memberId) {
      return res.status(400).json({ error: { message: "memberId is required", status: 400 } });
    }
    const depth = req.query.depth === "2" ? 2 : 0;
    const filter = getDeletedFilter(req.query);
    const direct = await prisma.familyRelationship.findMany({
      where: { memberId, ...filter },
      include: { relatedMember: { select: MEMBER_SELECT } },
      orderBy: { createdAt: "asc" }
    });
    if (depth !== 2 || direct.length === 0) {
      return res.status(200).json({ status: 200, data: { direct, extended: [] } });
    }
    const relatedIds = [...new Set(direct.map((r) => r.relatedMemberId))];
    const extended = await prisma.familyRelationship.findMany({
      where: { memberId: { in: relatedIds }, relatedMemberId: { not: memberId }, ...filter },
      include: { relatedMember: { select: MEMBER_SELECT } },
      orderBy: { createdAt: "asc" }
    });
    return res.status(200).json({ status: 200, data: { direct, extended } });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      const memberId = req.query.memberId || req.body?.memberId;
      const relatedMemberId = req.query.relatedMemberId || req.body?.relatedMemberId;
      if (!memberId || !relatedMemberId) {
        return res.status(400).json({ error: { message: "memberId and relatedMemberId are required", status: 400 } });
      }
      const restored = await prisma.familyRelationship.updateMany({
        where: {
          OR: [
            { memberId, relatedMemberId },
            { memberId: relatedMemberId, relatedMemberId: memberId }
          ]
        },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, "Restore Family Relationship", "MEMBER", { memberId, relatedMemberId }, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Family relationship restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    if (!await verifyPermission(req, res, PERMS.UPDATE_MEMBER)) return;
    const { memberId, relatedMemberId, relationshipType, reciprocalType, customLabel, reciprocalCustomLabel } = req.body || {};
    if (!memberId || !relatedMemberId) {
      return res.status(400).json({ error: { message: "memberId and relatedMemberId are required", status: 400 } });
    }
    if (memberId === relatedMemberId) {
      return res.status(400).json({ error: { message: "A member cannot be linked to themselves.", status: 400 } });
    }
    if (!RELATION_TYPES.includes(relationshipType)) {
      return res.status(400).json({ error: { message: "Invalid relationship type.", status: 400 } });
    }
    const reciprocal = RELATION_TYPES.includes(reciprocalType) ? reciprocalType : RECIPROCAL_DEFAULTS[relationshipType];
    const [memberA, memberB] = await Promise.all([
      prisma.member.findUnique({ where: { id: memberId } }),
      prisma.member.findUnique({ where: { id: relatedMemberId } })
    ]);
    if (!memberA || !memberB) {
      return res.status(404).json({ error: { message: "One or both members were not found.", status: 404 } });
    }
    const existing = await prisma.familyRelationship.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { memberId, relatedMemberId },
          { memberId: relatedMemberId, relatedMemberId: memberId }
        ]
      }
    });
    if (existing) {
      return res.status(400).json({ error: { message: "These two members are already linked. Remove the existing relationship before adding a new one.", status: 400 } });
    }
    try {
      const [forward, backward] = await prisma.$transaction([
        prisma.familyRelationship.create({
          data: {
            memberId,
            relatedMemberId,
            relationshipType,
            customLabel: relationshipType === "OTHER" ? customLabel || null : null
          },
          include: { relatedMember: { select: MEMBER_SELECT } }
        }),
        prisma.familyRelationship.create({
          data: {
            memberId: relatedMemberId,
            relatedMemberId: memberId,
            relationshipType: reciprocal,
            customLabel: reciprocal === "OTHER" ? reciprocalCustomLabel || customLabel || null : null
          },
          include: { relatedMember: { select: MEMBER_SELECT } }
        })
      ]);
      await logAudit(req.user.id, "Link Family Member", "MEMBER", null, { forward, backward }, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(201).json({ status: 201, data: forward });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(400).json({ error: { message: "These two members are already linked.", status: 400 } });
      }
      throw err;
    }
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
    }
    if (!await verifyPermission(req, res, PERMS.DELETE_MEMBER)) return;
    const memberId = req.query.memberId || req.body?.memberId;
    const relatedMemberId = req.query.relatedMemberId || req.body?.relatedMemberId;
    if (!memberId || !relatedMemberId) {
      return res.status(400).json({ error: { message: "memberId and relatedMemberId are required", status: 400 } });
    }
    let deletedCount = 0;
    if (isPermanent) {
      const deleted = await prisma.familyRelationship.deleteMany({
        where: {
          OR: [
            { memberId, relatedMemberId },
            { memberId: relatedMemberId, relatedMemberId: memberId }
          ]
        }
      });
      deletedCount = deleted.count;
    } else {
      const updated = await prisma.familyRelationship.updateMany({
        where: {
          OR: [
            { memberId, relatedMemberId },
            { memberId: relatedMemberId, relatedMemberId: memberId }
          ]
        },
        data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
      });
      deletedCount = updated.count;
    }
    await logAudit(req.user.id, isPermanent ? "Permanent Unlink Family Member" : "Unlink Family Member", "MEMBER", { memberId, relatedMemberId }, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: `Removed ${deletedCount} relationship link(s)` });
  }
  return res.status(405).json({ error: { message: "Method not allowed", status: 405 } });
});
export {
  family_relationships_default as default
};
