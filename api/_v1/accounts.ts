import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;

  if (method === 'GET') {
    const { search, type, status, sortBy = 'glCode', order = 'asc', page = '1', limit = '100' } = req.query as any;

    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { glCode: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type && type !== 'All') {
      whereClause.accountType = { name: type.toUpperCase() };
    }
    if (status && status !== 'All') {
      whereClause.isLocked = status === 'Inactive';
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const [dbAccounts, total] = await Promise.all([
      prisma.account.findMany({
        where: whereClause,
        include: {
          accountType: true,
          parent: true,
        },
        orderBy: { [sortBy]: order === 'desc' ? 'desc' : 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.account.count({ where: whereClause })
    ]);

    const formatted = dbAccounts.map((acc) => ({
      id: acc.id,
      code: acc.glCode,
      name: acc.accountName,
      type: acc.accountType ? (acc.accountType.name.charAt(0) + acc.accountType.name.slice(1).toLowerCase()) : 'Asset',
      level: acc.accountLevel,
      detailType: acc.detailType,
      parentCode: acc.parent ? acc.parent.glCode : null,
      currency: acc.currency,
      status: acc.isLocked ? 'Inactive' : 'Active',
      description: acc.description,
      subsidiary: acc.subsidiary,
      initialBalance: acc.initialBalance,
      isSystemDefined: acc.isSystemDefined,
      isReserved: acc.isReserved,
    }));

    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
  }

  // Verify User Role & Permissions for mutations
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const isSuperAdmin = user?.role.name === 'Super Admin';

  const checkPerm = (perm: string) => {
    if (isSuperAdmin) return true;
    return userPerms.includes(perm);
  };

  if (method === 'POST') {
    if (!checkPerm('CREATE_ACCOUNT')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    const { code, name, type, detailType, parentCode, currency, subsidiary, initialBalance, description, isLocked, isReserved } = req.body;

    if (!code || !name || !type) {
      return res.status(400).json({ error: { message: 'Code, Name, and Type are required', status: 400 } });
    }

    // Reserved accounts cannot be assigned unless explicitly marked as reserved
    if (!isReserved) {
      const reservedMatch = await prisma.reservedCode.findFirst({
        where: {
          isActive: true,
          reserveStart: { lte: code },
          reserveEnd: { gte: code },
        }
      });
      if (reservedMatch) {
        return res.status(400).json({ error: { message: `Code ${code} falls within a reserved range: ${reservedMatch.reserveReason}`, status: 400 } });
      }
    }

    const typeNameUpper = type.toUpperCase();
    let accountType = await prisma.accountType.findUnique({ where: { name: typeNameUpper } });
    if (!accountType) {
      accountType = await prisma.accountType.create({ data: { name: typeNameUpper } });
    }

    let parentId = null;
    if (parentCode && parentCode !== 'none') {
      const parentAcc = await prisma.account.findUnique({ where: { glCode: parentCode } });
      if (parentAcc) parentId = parentAcc.id;
    }

    let accountLevel = 'SUBSIDIARY';
    if (!parentCode || parentCode === 'none') {
      accountLevel = 'MAIN';
    } else {
      const parentAcc = await prisma.account.findUnique({ where: { glCode: parentCode } });
      if (parentAcc && (parentAcc.accountLevel === 'MAIN')) {
        accountLevel = 'PARENT';
      }
    }

    const newAccount = await prisma.account.create({
      data: {
        glCode: code,
        accountName: name,
        accountLevel: accountLevel as any,
        parentId,
        accountTypeId: accountType.id,
        description,
        currency: currency || 'USD',
        subsidiary: subsidiary || ['Global'],
        initialBalance: parseFloat(initialBalance) || 0,
        detailType: detailType || 'Header',
        isLocked: !!isLocked,
        isReserved: !!isReserved,
      },
    });

    await logAudit(req.user.id, 'Create Account', 'COA', null, newAccount, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newAccount });
  }

  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Account ID is required', status: 400 } });
    }

    const existingAccount = await prisma.account.findUnique({ where: { id } });
    if (!existingAccount) {
      return res.status(404).json({ error: { message: 'Account not found', status: 404 } });
    }

    // Locked accounts cannot be edited (unless it's just unlocking it)
    const isToggleLock = req.body.isLocked !== undefined && Object.keys(req.body).length === 1;
    if (existingAccount.isLocked && !isToggleLock && req.body.isLocked !== false) {
      return res.status(400).json({ error: { message: 'Locked accounts cannot be edited', status: 400 } });
    }
    const requiredPerm = isToggleLock ? 'LOCK_ACCOUNT' : 'UPDATE_ACCOUNT';

    if (!checkPerm(requiredPerm)) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    const { code, name, type, detailType, parentCode, currency, subsidiary, initialBalance, description, isLocked, isReserved } = req.body;

    if (code !== undefined) {
      // Reserved accounts cannot be assigned unless explicitly marked as reserved
      if (isReserved !== true && existingAccount.isReserved !== true) {
        const reservedMatch = await prisma.reservedCode.findFirst({
          where: {
            isActive: true,
            reserveStart: { lte: code },
            reserveEnd: { gte: code },
          }
        });
        if (reservedMatch) {
          return res.status(400).json({ error: { message: `Code ${code} falls within a reserved range: ${reservedMatch.reserveReason}`, status: 400 } });
        }
      }
    }

    const updateData: any = {};
    if (code !== undefined) updateData.glCode = code;
    if (name !== undefined) updateData.accountName = name;
    if (description !== undefined) updateData.description = description;
    if (currency !== undefined) updateData.currency = currency;
    if (subsidiary !== undefined) updateData.subsidiary = subsidiary;
    if (initialBalance !== undefined) updateData.initialBalance = parseFloat(initialBalance) || 0;
    if (detailType !== undefined) updateData.detailType = detailType;
    if (isLocked !== undefined) updateData.isLocked = isLocked;
    if (isReserved !== undefined) updateData.isReserved = isReserved;

    if (type !== undefined) {
      const typeNameUpper = type.toUpperCase();
      let accountType = await prisma.accountType.findUnique({ where: { name: typeNameUpper } });
      if (!accountType) {
        accountType = await prisma.accountType.create({ data: { name: typeNameUpper } });
      }
      updateData.accountTypeId = accountType.id;
    }

    if (parentCode !== undefined) {
      if (!parentCode || parentCode === 'none') {
        updateData.parentId = null;
        updateData.accountLevel = 'MAIN';
      } else {
        const parentAcc = await prisma.account.findUnique({ where: { glCode: parentCode } });
        if (parentAcc) {
          updateData.parentId = parentAcc.id;
          updateData.accountLevel = parentAcc.accountLevel === 'MAIN' ? 'PARENT' : 'SUBSIDIARY';
        }
      }
    }

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: updateData,
    });

    await logAudit(req.user.id, isToggleLock ? 'Toggle Lock Account' : 'Modify Account', 'COA', existingAccount, updatedAccount, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedAccount });
  }

  if (method === 'DELETE') {
    if (!checkPerm('DELETE_ACCOUNT')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Account ID is required', status: 400 } });
    }

    const existingAccount = await prisma.account.findUnique({ where: { id } });
    if (!existingAccount) {
      return res.status(404).json({ error: { message: 'Account not found', status: 404 } });
    }

    if (existingAccount.accountLevel === 'MAIN') {
      return res.status(400).json({ error: { message: 'MAIN accounts cannot be deleted', status: 400 } });
    }

    await prisma.account.delete({ where: { id } });

    await logAudit(req.user.id, 'Delete Account', 'COA', existingAccount, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Account deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
