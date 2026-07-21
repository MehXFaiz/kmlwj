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
  "photoUrl",
  "cnicFrontUrl",
  "cnicBackUrl",
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
    const { name, fatherName, husbandName, cnic, mobile, email, address, town, area, gham, housingStatus, housingOther, familySize, monthlyIncome, monthlyExpenses, debtAmount } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: { message: "Name is required", status: 400 } });
    }
    if (fatherName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: "Father name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (husbandName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(husbandName))) {
      return res.status(400).json({ error: { message: "Husband name can only contain letters, spaces, hyphens, and dots", status: 400 } });
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
    if (address && !/^[a-zA-Z0-9\s.,#/-]{3,200}$/.test(String(address))) {
      return res.status(400).json({ error: { message: "Address contains unsupported characters", status: 400 } });
    }
    if (town && !/^[a-zA-Z\s.-]{2,80}$/.test(String(town))) {
      return res.status(400).json({ error: { message: "Town can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (area && !/^[a-zA-Z\s.-]{2,80}$/.test(String(area))) {
      return res.status(400).json({ error: { message: "Area can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (gham && !/^[a-zA-Z\s.-]{2,80}$/.test(String(gham))) {
      return res.status(400).json({ error: { message: "Gham can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (housingStatus && !["Owned", "Rented", "Homeless", "Other"].includes(String(housingStatus))) {
      return res.status(400).json({ error: { message: "Housing status is invalid", status: 400 } });
    }
    if (housingOther && !/^[a-zA-Z\s.-]{2,80}$/.test(String(housingOther))) {
      return res.status(400).json({ error: { message: "Housing detail can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (familySize !== void 0 && familySize !== "" && (!/^\d+$/.test(String(familySize)) || Number(familySize) < 0)) {
      return res.status(400).json({ error: { message: "Family size must be a non-negative whole number", status: 400 } });
    }
    if (monthlyIncome !== void 0 && monthlyIncome !== "" && (!/^\d+(\.\d{1,2})?$/.test(String(monthlyIncome)) || Number(monthlyIncome) < 0)) {
      return res.status(400).json({ error: { message: "Monthly income must be a non-negative number", status: 400 } });
    }
    if (monthlyExpenses !== void 0 && monthlyExpenses !== "" && (!/^\d+(\.\d{1,2})?$/.test(String(monthlyExpenses)) || Number(monthlyExpenses) < 0)) {
      return res.status(400).json({ error: { message: "Monthly expenses must be a non-negative number", status: 400 } });
    }
    if (debtAmount !== void 0 && debtAmount !== "" && (!/^\d+(\.\d{1,2})?$/.test(String(debtAmount)) || Number(debtAmount) < 0)) {
      return res.status(400).json({ error: { message: "Debt amount must be a non-negative number", status: 400 } });
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
    const { name, fatherName, husbandName, cnic, mobile, email, address, town, area, gham, housingStatus, housingOther, familySize, monthlyIncome, monthlyExpenses, debtAmount } = req.body;
    if (name !== void 0 && !String(name).trim()) {
      return res.status(400).json({ error: { message: "Name is required", status: 400 } });
    }
    if (fatherName !== void 0 && fatherName !== "" && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: "Father name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (husbandName !== void 0 && husbandName !== "" && !/^[a-zA-Z\s.-]{2,80}$/.test(String(husbandName))) {
      return res.status(400).json({ error: { message: "Husband name can only contain letters, spaces, hyphens, and dots", status: 400 } });
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
    if (address !== void 0 && address !== "" && !/^[a-zA-Z0-9\s.,#/-]{3,200}$/.test(String(address))) {
      return res.status(400).json({ error: { message: "Address contains unsupported characters", status: 400 } });
    }
    if (town !== void 0 && town !== "" && !/^[a-zA-Z\s.-]{2,80}$/.test(String(town))) {
      return res.status(400).json({ error: { message: "Town can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (area !== void 0 && area !== "" && !/^[a-zA-Z\s.-]{2,80}$/.test(String(area))) {
      return res.status(400).json({ error: { message: "Area can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (gham !== void 0 && gham !== "" && !/^[a-zA-Z\s.-]{2,80}$/.test(String(gham))) {
      return res.status(400).json({ error: { message: "Gham can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (housingStatus !== void 0 && housingStatus !== "" && !["Owned", "Rented", "Homeless", "Other"].includes(String(housingStatus))) {
      return res.status(400).json({ error: { message: "Housing status is invalid", status: 400 } });
    }
    if (housingOther !== void 0 && housingOther !== "" && !/^[a-zA-Z\s.-]{2,80}$/.test(String(housingOther))) {
      return res.status(400).json({ error: { message: "Housing detail can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (familySize !== void 0 && familySize !== "" && (!/^\d+$/.test(String(familySize)) || Number(familySize) < 0)) {
      return res.status(400).json({ error: { message: "Family size must be a non-negative whole number", status: 400 } });
    }
    if (monthlyIncome !== void 0 && monthlyIncome !== "" && (!/^\d+(\.\d{1,2})?$/.test(String(monthlyIncome)) || Number(monthlyIncome) < 0)) {
      return res.status(400).json({ error: { message: "Monthly income must be a non-negative number", status: 400 } });
    }
    if (monthlyExpenses !== void 0 && monthlyExpenses !== "" && (!/^\d+(\.\d{1,2})?$/.test(String(monthlyExpenses)) || Number(monthlyExpenses) < 0)) {
      return res.status(400).json({ error: { message: "Monthly expenses must be a non-negative number", status: 400 } });
    }
    if (debtAmount !== void 0 && debtAmount !== "" && (!/^\d+(\.\d{1,2})?$/.test(String(debtAmount)) || Number(debtAmount) < 0)) {
      return res.status(400).json({ error: { message: "Debt amount must be a non-negative number", status: 400 } });
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
