import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
var expense_heads_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    const dbExpenseHeads = await prisma.expenseHead.findMany({
      orderBy: { name: "asc" },
      include: {
        account: true
      }
    });
    return res.status(200).json({ status: 200, data: dbExpenseHeads });
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
    const { name, category, accountId, isActive } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: { message: "Name and Category are required", status: 400 } });
    }
    const newHead = await prisma.expenseHead.create({
      data: {
        name,
        category,
        accountId: accountId || null,
        isActive: isActive !== void 0 ? isActive : true
      },
      include: {
        account: true
      }
    });
    await logAudit(req.user.id, "Create Expense Head", "EXPENSE", null, newHead, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newHead });
  }
  if (method === "PUT") {
    if (!checkPerm("UPDATE_ACCOUNT")) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Expense Head ID is required", status: 400 } });
    }
    const existingHead = await prisma.expenseHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: "Expense Head not found", status: 404 } });
    }
    const { name, category, accountId, isActive } = req.body;
    const updatedHead = await prisma.expenseHead.update({
      where: { id },
      data: {
        name: name !== void 0 ? name : void 0,
        category: category !== void 0 ? category : void 0,
        accountId: accountId !== void 0 ? accountId || null : void 0,
        isActive: isActive !== void 0 ? isActive : void 0
      },
      include: {
        account: true
      }
    });
    await logAudit(req.user.id, "Modify Expense Head", "EXPENSE", existingHead, updatedHead, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedHead });
  }
  if (method === "DELETE") {
    if (!checkPerm("DELETE_ACCOUNT")) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Expense Head ID is required", status: 400 } });
    }
    const existingHead = await prisma.expenseHead.findUnique({ where: { id } });
    if (!existingHead) {
      return res.status(404).json({ error: { message: "Expense Head not found", status: 404 } });
    }
    await prisma.expenseHead.delete({ where: { id } });
    await logAudit(req.user.id, "Delete Expense Head", "EXPENSE", existingHead, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Expense Head deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  expense_heads_default as default
};
