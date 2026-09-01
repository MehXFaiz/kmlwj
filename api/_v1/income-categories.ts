import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { isSuperAdmin, getDeletedFilter } from '../_utils/soft-delete.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string || req.body?.id;
  const action = (req.query.action || req.body?.action) as string;

  // Helper check for Admin or Super Admin
  const isAdminOrSuperAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin' || await isSuperAdmin(req);

  // Default initial categories to ensure DB is never empty on first load
  const ensureDefaultCategories = async () => {
    // Soft-delete Donation Income if present per requirement
    await prisma.incomeCategory.updateMany({
      where: { name: 'Donation Income' },
      data: { isDeleted: true, deletedAt: new Date() }
    }).catch(() => {});

    // Rename legacy category name if present
    await prisma.incomeCategory.updateMany({
      where: { name: 'Other Income (Coconuts, Oil, Battery, Scraps, Rabi-ul-Awal, Qurbani Space)' },
      data: { name: 'Other Income' }
    }).catch(() => {});

    // name -> GL leaf code, matching the 3020501-3020509 accounts seeded
    // under 3020500 "Add Income Categories" in prisma/seed.ts.
    const defaultCatGlCodes: Record<string, string> = {
      'Other Income': '3020501',
      'Haqqani Decoration Income': '3020502',
      'Shouqat Eco Sound Income': '3020503',
      'Sharjeel Eco Sound Income': '3020504',
      'Rizwan Eco Sound Income': '3020505',
      'Election Committee Income': '3020506',
      'Software Invoice Income': '3020507',
      'Monthly Donation': '3020508',
      'Ramzan Zakat Income': '3020509',
    };

    for (const catName of Object.keys(defaultCatGlCodes)) {
      await prisma.incomeCategory.upsert({
        where: { name: catName },
        update: { isDeleted: false },
        create: { name: catName, isActive: true }
      }).catch(() => {});
    }

    // Auto-map: fill in accountId for any of the above categories that don't
    // have one yet (never overwrites an admin's existing/changed mapping —
    // this is what makes 'HaqqaniDecorationIncome'-style crashes impossible
    // by the time a user ever opens the Add Income form). Safe to re-run.
    for (const [catName, glCode] of Object.entries(defaultCatGlCodes)) {
      const category = await prisma.incomeCategory.findUnique({ where: { name: catName } }).catch(() => null);
      if (!category || category.accountId) continue;
      const account = await prisma.account.findUnique({ where: { glCode } }).catch(() => null);
      if (!account) continue;
      await prisma.incomeCategory.update({
        where: { id: category.id },
        data: { accountId: account.id }
      }).catch(() => {});
    }
  };

  if (method === 'GET') {
    await ensureDefaultCategories();
    const filter = getDeletedFilter(req.query);
    const categories = await prisma.incomeCategory.findMany({
      where: {
        ...filter,
        NOT: { name: 'Donation Income' }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        account: { select: { id: true, glCode: true, accountName: true } }
      }
    });

    return res.status(200).json({ status: 200, data: categories });
  }

  if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore categories', status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: 'Category ID is required', status: 400 } });
      }
      const existing = await prisma.incomeCategory.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Income Category not found', status: 404 } });
      }
      const restored = await prisma.incomeCategory.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, 'Restore Income Category', 'Add Income', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Income Category restored successfully', data: restored });
    }
  }

  // Enforce Admin / Super Admin for mutation operations
  if (!isAdminOrSuperAdmin) {
    return res.status(403).json({ error: { message: 'Forbidden: Only Admin and Super Admin can Add/Edit/Delete Income Categories', status: 403 } });
  }

  if (method === 'POST') {
    const { name, description, accountId, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Category Name is required', status: 400 } });
    }

    const existingName = await prisma.incomeCategory.findUnique({
      where: { name: name.trim() }
    });

    if (existingName) {
      if (existingName.isDeleted) {
        // Un-delete if previously soft deleted
        const restored = await prisma.incomeCategory.update({
          where: { id: existingName.id },
          data: {
            description: description !== undefined ? description : existingName.description,
            accountId: accountId || null,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          }
        });
        return res.status(200).json({ status: 200, message: 'Income Category restored', data: restored });
      }
      return res.status(400).json({ error: { message: 'An Income Category with this name already exists', status: 400 } });
    }

    const newCategory = await prisma.incomeCategory.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        accountId: accountId || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        account: { select: { id: true, glCode: true, accountName: true } }
      }
    });

    await logAudit(req.user.id, 'Create Income Category', 'Add Income', null, newCategory, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, message: 'Income Category created successfully', data: newCategory });
  }

  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Category ID is required', status: 400 } });
    }

    const existing = await prisma.incomeCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { message: 'Income Category not found', status: 404 } });
    }

    const { name, description, accountId, isActive } = req.body;

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.incomeCategory.findUnique({ where: { name: name.trim() } });
      if (duplicate && duplicate.id !== id) {
        return res.status(400).json({ error: { message: 'An Income Category with this name already exists', status: 400 } });
      }
    }

    const updated = await prisma.incomeCategory.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        accountId: accountId !== undefined ? (accountId || null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: {
        account: { select: { id: true, glCode: true, accountName: true } }
      }
    });

    await logAudit(req.user.id, 'Update Income Category', 'Add Income', existing, updated, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Income Category updated successfully', data: updated });
  }

  if (method === 'DELETE') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Category ID is required', status: 400 } });
    }

    const existing = await prisma.incomeCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { message: 'Income Category not found', status: 404 } });
    }

    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;

    if (isPermanent) {
      if (!isAdminOrSuperAdmin) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Admin or Super Admin can permanently delete records', status: 403 } });
      }
      await prisma.incomeCategory.delete({ where: { id } });
      await logAudit(req.user.id, 'Permanent Delete Income Category', 'Add Income', existing, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Income Category permanently deleted successfully' });
    }

    const updated = await prisma.incomeCategory.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id }
    });

    await logAudit(req.user.id, 'Delete Income Category', 'Add Income', existing, updated, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Income Category deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
