import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
function isUniqueViolation(err) {
  return err?.code === "P2002";
}
const DONOR_CODE_PREFIX = "DNR-";
async function nextDonorCode(tx) {
  const existing = await tx.donor.findMany({
    where: { donorCode: { startsWith: DONOR_CODE_PREFIX } },
    select: { donorCode: true }
  });
  const maxNum = existing.reduce((max, d) => {
    const n = parseInt(d.donorCode.slice(DONOR_CODE_PREFIX.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${DONOR_CODE_PREFIX}${String(maxNum + 1).padStart(4, "0")}`;
}
var donors_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.MANAGE_DONORS)) return;
  const { method } = req;
  const id = req.query.id;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    const search = req.query.search || "";
    const whereClause = { ...getDeletedFilter(req.query) };
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { donorCode: { contains: search, mode: "insensitive" } },
        { cnic: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search, mode: "insensitive" } }
      ];
    }
    const { limit = "100", page = "1" } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const [donors, total] = await Promise.all([
      prisma.donor.findMany({
        where: whereClause,
        orderBy: { donorCode: "asc" },
        skip,
        take: limitNum
      }),
      prisma.donor.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: donors, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: "Donor ID is required", status: 400 } });
      }
      const existing = await prisma.donor.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Donor not found", status: 404 } });
      }
      const restored = await prisma.donor.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, "Restore Donor", "DONOR", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Donor restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    const { fullName, fatherName, mobile, cnic, email, address, city, isActive } = req.body;
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ error: { message: "Donor full name is required", status: 400 } });
    }
    if (fatherName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: "Father / husband name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (cnic && !/^\d{13}$/.test(String(cnic))) {
      return res.status(400).json({ error: { message: "CNIC must contain exactly 13 digits", status: 400 } });
    }
    if (mobile && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: "Mobile number must contain exactly 11 digits", status: 400 } });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: { message: "Email address is invalid", status: 400 } });
    }
    if (address && !/^[a-zA-Z0-9\s.,#/-]{3,160}$/.test(String(address))) {
      return res.status(400).json({ error: { message: "Address contains unsupported characters", status: 400 } });
    }
    if (city && !/^[a-zA-Z\s.-]{2,80}$/.test(String(city))) {
      return res.status(400).json({ error: { message: "City can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (cnic) {
      const existingCnic = await prisma.donor.findUnique({ where: { cnic } });
      if (existingCnic) {
        return res.status(400).json({ error: { message: "A donor with this CNIC already exists", status: 400 } });
      }
    }
    let duplicateWarning;
    if (!cnic && mobile) {
      const possibleDuplicate = await prisma.donor.findFirst({
        where: { fullName: { equals: fullName, mode: "insensitive" }, mobile }
      });
      if (possibleDuplicate) {
        duplicateWarning = `A donor named "${possibleDuplicate.fullName}" with the same mobile number already exists (${possibleDuplicate.donorCode}). This donor was still created \u2014 please verify this isn't a duplicate.`;
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
            isActive: isActive !== void 0 ? Boolean(isActive) : true
          }
        });
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 5 && err.meta?.target?.includes("donorCode")) {
          continue;
        }
        throw err;
      }
    }
    await logAudit(req.user.id, "Create Donor", "DONOR", null, newDonor, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newDonor, warning: duplicateWarning });
  }
  if (method === "PUT" || method === "PATCH") {
    if (!id) {
      return res.status(400).json({ error: { message: "Donor ID is required", status: 400 } });
    }
    const existingDonor = await prisma.donor.findUnique({ where: { id } });
    if (!existingDonor) {
      return res.status(404).json({ error: { message: "Donor not found", status: 404 } });
    }
    const { fullName, fatherName, mobile, cnic, email, address, city, isActive } = req.body;
    if (fullName !== void 0 && !String(fullName).trim()) {
      return res.status(400).json({ error: { message: "Donor full name is required", status: 400 } });
    }
    if (fatherName !== void 0 && fatherName !== "" && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: "Father / husband name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (cnic !== void 0 && cnic !== "" && !/^\d{13}$/.test(String(cnic))) {
      return res.status(400).json({ error: { message: "CNIC must contain exactly 13 digits", status: 400 } });
    }
    if (mobile !== void 0 && mobile !== "" && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: "Mobile number must contain exactly 11 digits", status: 400 } });
    }
    if (email !== void 0 && email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: { message: "Email address is invalid", status: 400 } });
    }
    if (address !== void 0 && address !== "" && !/^[a-zA-Z0-9\s.,#/-]{3,160}$/.test(String(address))) {
      return res.status(400).json({ error: { message: "Address contains unsupported characters", status: 400 } });
    }
    if (city !== void 0 && city !== "" && !/^[a-zA-Z\s.-]{2,80}$/.test(String(city))) {
      return res.status(400).json({ error: { message: "City can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (cnic && cnic !== existingDonor.cnic) {
      const existingCnic = await prisma.donor.findUnique({ where: { cnic } });
      if (existingCnic) {
        return res.status(400).json({ error: { message: "A donor with this CNIC already exists", status: 400 } });
      }
    }
    const updatedDonor = await prisma.donor.update({
      where: { id },
      data: {
        fullName: fullName !== void 0 ? fullName : void 0,
        fatherName: fatherName !== void 0 ? fatherName || null : void 0,
        mobile: mobile !== void 0 ? mobile || null : void 0,
        cnic: cnic !== void 0 ? cnic || null : void 0,
        email: email !== void 0 ? email || null : void 0,
        address: address !== void 0 ? address || null : void 0,
        city: city !== void 0 ? city || null : void 0,
        isActive: isActive !== void 0 ? Boolean(isActive) : void 0
      }
    });
    await logAudit(req.user.id, "Update Donor", "DONOR", existingDonor, updatedDonor, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedDonor });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
    }
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Donor ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid ID provided", status: 400 } });
    }
    const existingDonors = await prisma.donor.findMany({
      where: { id: { in: ids } },
      include: { donations: true }
    });
    if (existingDonors.length === 0) {
      return res.status(404).json({ error: { message: "No donors found to delete", status: 404 } });
    }
    await prisma.$transaction(async (tx) => {
      if (isPermanent) {
        await tx.donor.deleteMany({ where: { id: { in: ids } } });
      } else {
        await tx.donor.updateMany({
          where: { id: { in: ids } },
          data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
        });
      }
    });
    for (const d of existingDonors) {
      await logAudit(req.user.id, isPermanent ? "Permanent Delete Donor" : "Delete Donor", "DONOR", d, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    }
    return res.status(200).json({ status: 200, message: `${existingDonors.length} donor(s) deleted successfully` });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  donors_default as default
};
