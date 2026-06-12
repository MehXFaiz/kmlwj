import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
var revenue_heads_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    const dbRevenueHeads = await prisma.revenueHead.findMany({
      orderBy: { code: "asc" }
    });
    return res.status(200).json({ status: 200, data: dbRevenueHeads });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
  });
  const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const isSuperAdmin = user?.role.name === "Super Admin";
  const checkPerm = (perm) => {
    if (isSuperAdmin) return true;
    return userPerms.includes(perm);
  };
  if (method === "POST") {
    if (!checkPerm("CREATE_ACCOUNT")) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    const { code, name, category, description, budget, actual, status } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: { message: "Code and Name are required", status: 400 } });
    }
    const newHead = await prisma.revenueHead.create({
      data: {
        code,
        name,
        category: category || "Operating",
        description,
        status: status || "Active",
        budget: parseFloat(budget) || 0,
        actual: parseFloat(actual) || 0
      }
    });
    await logAudit(req.user.id, "Create Revenue Head", "REVENUE", null, newHead, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newHead });
  }
  if (method === "PUT") {
    if (!checkPerm("UPDATE_ACCOUNT")) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Revenue Head ID is required", status: 400 } });
    }
    const existingHead = await prisma.revenueHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: "Revenue Head not found", status: 404 } });
    }
    const { code, name, category, description, budget, actual, status } = req.body;
    const updatedHead = await prisma.revenueHead.update({
      where: { id },
      data: {
        code: code !== void 0 ? code : void 0,
        name: name !== void 0 ? name : void 0,
        category: category !== void 0 ? category : void 0,
        description: description !== void 0 ? description : void 0,
        status: status !== void 0 ? status : void 0,
        budget: budget !== void 0 ? parseFloat(budget) || 0 : void 0,
        actual: actual !== void 0 ? parseFloat(actual) || 0 : void 0
      }
    });
    await logAudit(req.user.id, "Modify Revenue Head", "REVENUE", existingHead, updatedHead, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedHead });
  }
  if (method === "DELETE") {
    if (!checkPerm("DELETE_ACCOUNT")) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Revenue Head ID is required", status: 400 } });
    }
    const existingHead = await prisma.revenueHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: "Revenue Head not found", status: 404 } });
    }
    await prisma.revenueHead.delete({ where: { id } });
    await logAudit(req.user.id, "Delete Revenue Head", "REVENUE", existingHead, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Revenue Head deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  revenue_heads_default as default
};
