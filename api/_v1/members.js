import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";

var members_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    if (id) {
      const member = await prisma.member.findUnique({ where: { id } });
      if (!member) {
        return res.status(404).json({ error: { message: "Member not found", status: 404 } });
      }
      return res.status(200).json({ status: 200, data: member });
    }
    const members = await prisma.member.findMany({
      orderBy: { createdAt: "desc" }
    });
    return res.status(200).json({ status: 200, data: members });
  }
  if (method === "POST") {
    const {
      memberNo,
      fullName,
      fatherName,
      cnic,
      dob,
      address,
      mobile,
      email,
      city,
      area,
      ghamName,
      education,
      profession,
      company,
      doi,
      photoUrl,
      isActive
    } = req.body;
    if (!fullName) {
      return res.status(400).json({ error: { message: "Full Member Name is required", status: 400 } });
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
        isActive: isActive !== void 0 ? Boolean(isActive) : true
      }
    });
    await logAudit(req.user.id, "Register Member", "MEMBER", null, newMember, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newMember });
  }
  if (method === "PUT") {
    if (!id) {
      return res.status(400).json({ error: { message: "Member ID is required", status: 400 } });
    }
    const existingMember = await prisma.member.findUnique({ where: { id } });
    if (!existingMember) {
      return res.status(404).json({ error: { message: "Member not found", status: 404 } });
    }
    const {
      memberNo,
      fullName,
      fatherName,
      cnic,
      dob,
      address,
      mobile,
      email,
      city,
      area,
      ghamName,
      education,
      profession,
      company,
      doi,
      photoUrl,
      isActive
    } = req.body;
    const updatedMember = await prisma.member.update({
      where: { id },
      data: {
        memberNo: memberNo !== void 0 ? memberNo || null : void 0,
        fullName: fullName || void 0,
        fatherName: fatherName !== void 0 ? fatherName || null : void 0,
        cnic: cnic !== void 0 ? cnic || null : void 0,
        dob: dob !== void 0 ? dob || null : void 0,
        address: address !== void 0 ? address || null : void 0,
        mobile: mobile !== void 0 ? mobile || null : void 0,
        email: email !== void 0 ? email || null : void 0,
        city: city !== void 0 ? city || null : void 0,
        area: area !== void 0 ? area || null : void 0,
        ghamName: ghamName !== void 0 ? ghamName || null : void 0,
        education: education !== void 0 ? education || null : void 0,
        profession: profession !== void 0 ? profession || null : void 0,
        company: company !== void 0 ? company || null : void 0,
        doi: doi !== void 0 ? doi || null : void 0,
        photoUrl: photoUrl !== void 0 ? photoUrl || null : void 0,
        isActive: isActive !== void 0 ? Boolean(isActive) : void 0
      }
    });
    await logAudit(req.user.id, "Update Member", "MEMBER", existingMember, updatedMember, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedMember });
  }
  if (method === "DELETE") {
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Member ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    await prisma.member.deleteMany({
      where: { id: { in: ids } }
    });
    await logAudit(req.user.id, "Delete Member(s)", "MEMBER", { ids }, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: `Successfully deleted ${ids.length} member(s)` });
  }
  return res.status(405).json({ error: { message: "Method not allowed", status: 405 } });
});

export {
  members_default as default
};
