import { prisma } from "../_prisma.js";
async function memberVerifyHandler(req, res) {
  const { id } = req.params;
  if (!id || id.trim().length < 2) {
    return res.status(400).json({
      verified: false,
      error: "Invalid verification code"
    });
  }
  try {
    let member = await prisma.member.findUnique({
      where: { memberNo: id },
      select: {
        memberNo: true,
        fullName: true,
        fatherName: true,
        cnic: true,
        dob: true,
        ghamName: true,
        area: true,
        city: true,
        address: true,
        doi: true,
        photoUrl: true,
        isActive: true
        // NEVER expose: id, mobile, email, education, profession, company, password etc.
      }
    });
    if (!member) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(id)) {
        member = await prisma.member.findUnique({
          where: { id },
          select: {
            memberNo: true,
            fullName: true,
            fatherName: true,
            cnic: true,
            dob: true,
            ghamName: true,
            area: true,
            city: true,
            address: true,
            doi: true,
            photoUrl: true,
            isActive: true
          }
        });
      }
    }
    if (!member) {
      return res.status(404).json({
        verified: false,
        status: "NOT_FOUND",
        error: "No member found with this QR code. This card may not belong to our organization."
      });
    }
    const rawCnic = member.cnic || "";
    const maskedCnic = rawCnic.length >= 4 ? rawCnic.slice(0, -4).replace(/[0-9]/g, "*") + rawCnic.slice(-4) : rawCnic ? "***masked***" : null;
    return res.status(200).json({
      verified: true,
      status: member.isActive ? "ACTIVE" : "INACTIVE",
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      member: {
        memberNo: member.memberNo,
        fullName: member.fullName,
        fatherName: member.fatherName || null,
        cnic: maskedCnic,
        dob: member.dob || null,
        ghamName: member.ghamName || null,
        area: member.area || null,
        city: member.city || null,
        doi: member.doi || null,
        photoUrl: member.photoUrl || null,
        isActive: member.isActive
      }
    });
  } catch (err) {
    console.error("[MemberVerify] Error:", err);
    return res.status(500).json({
      verified: false,
      error: "Verification service temporarily unavailable. Please try again."
    });
  }
}
export {
  memberVerifyHandler
};
