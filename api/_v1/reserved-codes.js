import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { compareCodes } from "../_utils/code-compare.js";
import { PERMS } from "../_constants/permissions.js";
var reserved_codes_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    const dbReservedCodes = await prisma.reservedCode.findMany();
    dbReservedCodes.sort((a, b) => compareCodes(a.reserveStart, b.reserveStart));
    return res.status(200).json({ status: 200, data: dbReservedCodes });
  }
  if (method === "POST") {
    if (!await verifyPermission(req, res, PERMS.MANAGE_RESERVED_CODES)) return;
    const { reserveStart, reserveEnd, reserveReason, isActive } = req.body;
    if (!reserveStart || !reserveEnd || !reserveReason) {
      return res.status(400).json({ error: { message: "Start code, end code, and reason are required", status: 400 } });
    }
    if (compareCodes(reserveStart, reserveEnd) > 0) {
      return res.status(400).json({ error: { message: "Start code must be less than or equal to end code", status: 400 } });
    }
    const existingReservations = await prisma.reservedCode.findMany();
    const overlap = existingReservations.find(
      (r) => compareCodes(r.reserveStart, reserveEnd) <= 0 && compareCodes(r.reserveEnd, reserveStart) >= 0
    );
    if (overlap) {
      return res.status(400).json({ error: { message: `Range overlaps with existing reservation: ${overlap.reserveStart}-${overlap.reserveEnd}`, status: 400 } });
    }
    const newReservation = await prisma.reservedCode.create({
      data: {
        reserveStart,
        reserveEnd,
        reserveReason,
        isActive: isActive !== void 0 ? isActive : true
      }
    });
    await logAudit(req.user.id, "Create Reserved Code", "COA", null, newReservation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newReservation });
  }
  if (method === "PUT") {
    if (!await verifyPermission(req, res, PERMS.MANAGE_RESERVED_CODES)) return;
    if (!id) {
      return res.status(400).json({ error: { message: "Reserved Code ID is required", status: 400 } });
    }
    const existingReservation = await prisma.reservedCode.findUnique({ where: { id } });
    if (!existingReservation) {
      return res.status(404).json({ error: { message: "Reserved Code not found", status: 404 } });
    }
    const { reserveStart, reserveEnd, reserveReason, isActive } = req.body;
    const newStart = reserveStart !== void 0 ? reserveStart : existingReservation.reserveStart;
    const newEnd = reserveEnd !== void 0 ? reserveEnd : existingReservation.reserveEnd;
    if (compareCodes(newStart, newEnd) > 0) {
      return res.status(400).json({ error: { message: "Start code must be less than or equal to end code", status: 400 } });
    }
    const existingReservations = await prisma.reservedCode.findMany({ where: { id: { not: id } } });
    const overlap = existingReservations.find(
      (r) => compareCodes(r.reserveStart, newEnd) <= 0 && compareCodes(r.reserveEnd, newStart) >= 0
    );
    if (overlap) {
      return res.status(400).json({ error: { message: `Range overlaps with existing reservation: ${overlap.reserveStart}-${overlap.reserveEnd}`, status: 400 } });
    }
    const updatedReservation = await prisma.reservedCode.update({
      where: { id },
      data: {
        reserveStart: newStart,
        reserveEnd: newEnd,
        reserveReason: reserveReason !== void 0 ? reserveReason : existingReservation.reserveReason,
        isActive: isActive !== void 0 ? isActive : existingReservation.isActive
      }
    });
    await logAudit(req.user.id, "Modify Reserved Code", "COA", existingReservation, updatedReservation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedReservation });
  }
  if (method === "DELETE") {
    if (!await verifyPermission(req, res, PERMS.MANAGE_RESERVED_CODES)) return;
    if (!id) {
      return res.status(400).json({ error: { message: "Reserved Code ID is required", status: 400 } });
    }
    const existingReservation = await prisma.reservedCode.findUnique({ where: { id } });
    if (!existingReservation) {
      return res.status(404).json({ error: { message: "Reserved Code not found", status: 404 } });
    }
    await prisma.reservedCode.delete({ where: { id } });
    await logAudit(req.user.id, "Delete Reserved Code", "COA", existingReservation, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Reserved Code deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  reserved_codes_default as default
};
