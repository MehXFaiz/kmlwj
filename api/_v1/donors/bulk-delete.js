import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { logAudit } from "../../_utils/audit.js";
import { PERMS } from "../../_constants/permissions.js";
import { isAdminOrAbove } from "../../_utils/soft-delete.js";
const MAX_BULK_IDS = 500;
const UUID_RE = /^[0-9a-fA-F]{24}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
var bulk_delete_default = makeHandler(async (req, res) => {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.MANAGE_DONORS)) return;
  if (!await isAdminOrAbove(req)) {
    return res.status(403).json({
      error: { message: "Forbidden: Only an Admin or Super Admin can bulk delete donors", status: 403 }
    });
  }
  const rawIds = req.body?.ids;
  if (!Array.isArray(rawIds)) {
    return res.status(400).json({ error: { message: 'Request body must contain an "ids" array', status: 400 } });
  }
  const ids = [...new Set(rawIds.map(String).map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return res.status(400).json({ error: { message: "No donors selected", status: 400 } });
  }
  if (ids.length > MAX_BULK_IDS) {
    return res.status(400).json({
      error: { message: `Cannot delete more than ${MAX_BULK_IDS} donors in a single request`, status: 400 }
    });
  }
  const validIds = ids.filter((id) => UUID_RE.test(id));
  if (validIds.length === 0) {
    return res.status(400).json({ error: { message: "No valid donor IDs provided", status: 400 } });
  }
  const { deleted, donors } = await prisma.$transaction(async (tx) => {
    const targets = await tx.donor.findMany({
      where: { id: { in: validIds }, isDeleted: false },
      select: { id: true, donorCode: true, fullName: true }
    });
    if (targets.length === 0) return { deleted: 0, donors: targets };
    const result = await tx.donor.updateMany({
      where: { id: { in: targets.map((t) => t.id) }, isDeleted: false },
      data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
    });
    return { deleted: result.count, donors: targets };
  });
  const message = deleted === 0 ? "No donors were deleted \u2014 the selected records no longer exist." : `${deleted} donor${deleted === 1 ? "" : "s"} deleted successfully.`;
  if (deleted > 0) {
    await logAudit(
      req.user.id,
      "Bulk Delete Donors",
      "DONOR",
      { requestedIds: ids, donors: donors.map((d) => ({ id: d.id, donorCode: d.donorCode, fullName: d.fullName })) },
      { deletedCount: deleted, donorCodes: donors.map((d) => d.donorCode) },
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
  }
  return res.status(200).json({
    status: 200,
    success: true,
    deleted,
    deletedIds: donors.map((d) => d.id),
    message
  });
});
export {
  bulk_delete_default as default
};
