import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
var donors_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    const search = req.query.search || "";
    const whereClause = {};
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { donorCode: { contains: search, mode: "insensitive" } },
        { cnic: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search, mode: "insensitive" } }
      ];
    }
    const donors = await prisma.donor.findMany({
      where: whereClause,
      orderBy: { donorCode: "asc" }
    });
    return res.status(200).json({ status: 200, data: donors });
  }
  if (method === "POST") {
    const { fullName, fatherName, mobile, cnic, email, address, city, isActive } = req.body;
    if (!fullName) {
      return res.status(400).json({ error: { message: "Donor full name is required", status: 400 } });
    }
    if (cnic) {
      const existingCnic = await prisma.donor.findUnique({ where: { cnic } });
      if (existingCnic) {
        return res.status(400).json({ error: { message: "A donor with this CNIC already exists", status: 400 } });
      }
    }
    const count = await prisma.donor.count();
    const nextNum = (count + 1).toString().padStart(4, "0");
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
        isActive: isActive !== void 0 ? Boolean(isActive) : true
      }
    });
    await logAudit(req.user.id, "Create Donor", "DONOR", null, newDonor, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newDonor });
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
    if (!id) {
      return res.status(400).json({ error: { message: "Donor ID is required", status: 400 } });
    }
    const existingDonor = await prisma.donor.findUnique({ where: { id }, include: { donations: true } });
    if (!existingDonor) {
      return res.status(404).json({ error: { message: "Donor not found", status: 404 } });
    }
    if (existingDonor.donations.length > 0) {
      return res.status(400).json({ error: { message: "Cannot delete donor with existing donation records", status: 400 } });
    }
    await prisma.donor.delete({ where: { id } });
    await logAudit(req.user.id, "Delete Donor", "DONOR", existingDonor, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Donor deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  donors_default as default
};
