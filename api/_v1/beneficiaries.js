import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
const ALL_FIELDS = [
  "name",
  "fatherName",
  "husbandName",
  "cnic",
  "dob",
  "mobile",
  "email",
  "familySize",
  "monthlyIncome",
  "monthlyExpenses",
  "debtAmount",
  "housingStatus",
  "housingOther",
  "address",
  "town",
  "area",
  "gham",
  "husbandGham",
  "fatherGham",
  "education",
  "profession",
  "firm",
  "remarks",
  "isActive"
];
function pickData(body, isCreate) {
  const data = {};
  for (const key of ALL_FIELDS) {
    if (body[key] === void 0) {
      if (!isCreate) continue;
    }
    const val = body[key];
    if (key === "isActive") {
      data.isActive = val !== void 0 ? Boolean(val) : true;
    } else if (key === "dob") {
      data.dob = val ? new Date(val) : null;
    } else if (key === "familySize") {
      data.familySize = val ? parseInt(val) : null;
    } else if (["monthlyIncome", "monthlyExpenses", "debtAmount"].includes(key)) {
      data[key] = val || val === 0 ? parseFloat(val) : null;
    } else {
      data[key] = val || null;
    }
  }
  return data;
}
var beneficiaries_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    const { limit = "100", page = "1" } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const [beneficiaries, total] = await Promise.all([
      prisma.beneficiary.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.beneficiary.count()
    ]);
    return res.status(200).json({ status: 200, data: beneficiaries, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "POST") {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: { message: "Name is required", status: 400 } });
    }
    const data = pickData(req.body, true);
    const newBeneficiary = await prisma.beneficiary.create({ data });
    await logAudit(req.user.id, "Create Beneficiary", "DONATION", null, newBeneficiary, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newBeneficiary });
  }
  if (method === "PUT") {
    if (!id) {
      return res.status(400).json({ error: { message: "Beneficiary ID is required", status: 400 } });
    }
    const existingBeneficiary = await prisma.beneficiary.findUnique({ where: { id } });
    if (!existingBeneficiary) {
      return res.status(404).json({ error: { message: "Beneficiary not found", status: 404 } });
    }
    const data = pickData(req.body, false);
    const updatedBeneficiary = await prisma.beneficiary.update({
      where: { id },
      data
    });
    await logAudit(req.user.id, "Update Beneficiary", "DONATION", existingBeneficiary, updatedBeneficiary, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedBeneficiary });
  }
  if (method === "DELETE") {
    if (!id) {
      return res.status(400).json({ error: { message: "Beneficiary ID is required", status: 400 } });
    }
    const existingBeneficiary = await prisma.beneficiary.findUnique({ where: { id } });
    if (!existingBeneficiary) {
      return res.status(404).json({ error: { message: "Beneficiary not found", status: 404 } });
    }
    const donationsCount = await prisma.donation.count({ where: { beneficiaryId: id } });
    if (donationsCount > 0) {
      return res.status(400).json({ error: { message: "Cannot delete beneficiary because they have associated donation records. Please remove the donations first.", status: 400 } });
    }
    await prisma.beneficiary.delete({ where: { id } });
    await logAudit(req.user.id, "Delete Beneficiary", "DONATION", existingBeneficiary, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Beneficiary deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  beneficiaries_default as default
};
