import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
var income_categories_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id || req.body?.id;
  const action = req.query.action || req.body?.action;
  const isAdminOrSuperAdmin = req.user.role === "Admin" || req.user.role === "Super Admin" || await isSuperAdmin(req);
  const ensureDefaultCategories = async () => {
    const count = await prisma.incomeCategory.count({ where: { isDeleted: false } });
    if (count === 0) {
      const defaultCats = [
        "Donation Income",
        "Other Income (Coconuts, Oil, Battery, Scraps, Rabi-ul-Awal, Qurbani Space)",
        "Haqqani Decoration Income",
        "Shouqat Eco Sound Income",
        "Sharjeel Eco Sound Income",
        "Rizwan Eco Sound Income",
        "Election Committee Income",
        "Software Invoice Income",
        "Monthly Donation",
        "Ramzan Zakat Income"
      ];
      for (const catName of defaultCats) {
        await prisma.incomeCategory.upsert({
          where: { name: catName },
          update: { isDeleted: false },
          create: { name: catName, isActive: true }
        }).catch(() => {
        });
      }
    }
  };
  if (method === "GET") {
    await ensureDefaultCategories();
    const categories = await prisma.incomeCategory.findMany({
      where: getDeletedFilter(req.query),
      orderBy: { createdAt: "asc" },
      include: {
        account: { select: { id: true, glCode: true, accountName: true } }
      }
    });
    return res.status(200).json({ status: 200, data: categories });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore categories", status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: "Category ID is required", status: 400 } });
      }
      const existing = await prisma.incomeCategory.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Income Category not found", status: 404 } });
      }
      const restored = await prisma.incomeCategory.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, "Restore Income Category", "Add Income", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Income Category restored successfully", data: restored });
    }
  }
  if (!isAdminOrSuperAdmin) {
    return res.status(403).json({ error: { message: "Forbidden: Only Admin and Super Admin can Add/Edit/Delete Income Categories", status: 403 } });
  }
  if (method === "POST") {
    const { name, description, accountId, isActive } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: "Category Name is required", status: 400 } });
    }
    const existingName = await prisma.incomeCategory.findUnique({
      where: { name: name.trim() }
    });
    if (existingName) {
      if (existingName.isDeleted) {
        const restored = await prisma.incomeCategory.update({
          where: { id: existingName.id },
          data: {
            description: description !== void 0 ? description : existingName.description,
            accountId: accountId || null,
            isActive: isActive !== void 0 ? Boolean(isActive) : true,
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          }
        });
        return res.status(200).json({ status: 200, message: "Income Category restored", data: restored });
      }
      return res.status(400).json({ error: { message: "An Income Category with this name already exists", status: 400 } });
    }
    const newCategory = await prisma.incomeCategory.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        accountId: accountId || null,
        isActive: isActive !== void 0 ? Boolean(isActive) : true
      },
      include: {
        account: { select: { id: true, glCode: true, accountName: true } }
      }
    });
    await logAudit(req.user.id, "Create Income Category", "Add Income", null, newCategory, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, message: "Income Category created successfully", data: newCategory });
  }
  if (method === "PUT") {
    if (!id) {
      return res.status(400).json({ error: { message: "Category ID is required", status: 400 } });
    }
    const existing = await prisma.incomeCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { message: "Income Category not found", status: 404 } });
    }
    const { name, description, accountId, isActive } = req.body;
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.incomeCategory.findUnique({ where: { name: name.trim() } });
      if (duplicate && duplicate.id !== id) {
        return res.status(400).json({ error: { message: "An Income Category with this name already exists", status: 400 } });
      }
    }
    const updated = await prisma.incomeCategory.update({
      where: { id },
      data: {
        name: name !== void 0 ? name.trim() : void 0,
        description: description !== void 0 ? description ? description.trim() : null : void 0,
        accountId: accountId !== void 0 ? accountId || null : void 0,
        isActive: isActive !== void 0 ? Boolean(isActive) : void 0
      },
      include: {
        account: { select: { id: true, glCode: true, accountName: true } }
      }
    });
    await logAudit(req.user.id, "Update Income Category", "Add Income", existing, updated, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Income Category updated successfully", data: updated });
  }
  if (method === "DELETE") {
    if (!id) {
      return res.status(400).json({ error: { message: "Category ID is required", status: 400 } });
    }
    const existing = await prisma.incomeCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { message: "Income Category not found", status: 404 } });
    }
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent) {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
      }
      await prisma.incomeCategory.delete({ where: { id } });
      await logAudit(req.user.id, "Permanent Delete Income Category", "Add Income", existing, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Income Category permanently deleted successfully" });
    }
    const updated = await prisma.incomeCategory.update({
      where: { id },
      data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
    });
    await logAudit(req.user.id, "Delete Income Category", "Add Income", existing, updated, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Income Category deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  income_categories_default as default
};
