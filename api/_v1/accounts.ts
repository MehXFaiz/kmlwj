import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { enforceRestrictedRolePolicy } from '../_middlewares/rbac.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { compareCodes } from '../_utils/code-compare.js';
import { AccountingService } from '../_services/accounting.service.js';
import { loadPermissions } from '../_services/permission.service.js';
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from '../_utils/soft-delete.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  // RBAC: PUT/PATCH/DELETE always blocked for non-privileged roles
  if (!await enforceRestrictedRolePolicy(req, res)) return;

  const { method } = req;
  const id = req.query.id as string;
  const action = (req.query.action || req.body?.action) as string;

  if (method === 'GET') {
    const { search, type, status, level, nature, reserved, sortBy = 'glCode', order = 'asc', page = '1', limit = '100' } = req.query as any;

    const whereClause: any = { ...getDeletedFilter(req.query) };
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
    if (level && level !== 'All') {
      whereClause.accountLevel = level; // e.g. MAIN, PARENT, SUBSIDIARY, GL
    }
    if (nature && nature !== 'All') {
      whereClause.detailType = nature;
    }
    if (reserved && reserved !== 'All') {
      whereClause.isReserved = reserved === 'Yes';
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const [dbAccounts, total, aggregates] = await Promise.all([
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
      prisma.account.count({ where: whereClause }),
      // Single source of truth: live balances from posted journal entry lines,
      // same source as tree.ts, trial balance, and every other financial report.
      AccountingService.getPostedAggregates()
    ]);

    const formatted = dbAccounts.map((acc) => ({
      id: acc.id,
      code: acc.glCode,
      name: acc.accountName,
      accountName: acc.accountName,
      accountLevel: acc.accountLevel,
      type: acc.accountType ? (acc.accountType.name.charAt(0) + acc.accountType.name.slice(1).toLowerCase()) : 'Asset',
      accountType: acc.accountType,
      level: acc.accountLevel,
      detailType: acc.detailType,
      parentCode: acc.parent ? acc.parent.glCode : null,
      parentId: acc.parentId,
      currency: acc.currency,
      status: acc.isLocked ? 'Inactive' : 'Active',
      isLocked: acc.isLocked,
      description: acc.description,
      subsidiary: acc.subsidiary,
      initialBalance: acc.initialBalance,
      // Live currentBalance derived from posted journal entry lines (same formula
      // as tree.ts and FundValidationService). This replaces the stale DB cache.
      currentBalance: AccountingService.naturalBalance(
        acc.accountType?.name || 'ASSET',
        acc.initialBalance,
        aggregates.get(acc.id)
      ),
      isSystemDefined: acc.isSystemDefined,
      isReserved: acc.isReserved,
    }));

    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
  }

  // Verify permissions for mutations — loaded live from DB, never from JWT role name.
  const userPerms = await loadPermissions(req);
  const checkPerm = (perm: string) => userPerms.has(perm);

  if (method === 'POST') {
    if (!checkPerm('CREATE_ACCOUNT')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    const { code, name, type, detailType, parentCode, currency, subsidiary, initialBalance, description, isLocked, isReserved } = req.body;

    if (!code || !name || !type) {
      return res.status(400).json({ error: { message: 'Code, Name, and Type are required', status: 400 } });
    }

    if (!/^\d{7}$/.test(code)) {
      return res.status(400).json({ error: { message: 'GL Code must be exactly 7 digits (e.g., 1000000)', status: 400 } });
    }

    const codeExists = await prisma.account.findUnique({ where: { glCode: code } });
    if (codeExists) {
      return res.status(400).json({ error: { message: `Account code ${code} is already in use`, status: 400 } });
    }

    // Reserved-range collision check: this must always run regardless of what the client sends
    // for `isReserved` — that flag is client-controlled and trusting it to skip the check would
    // let anyone with plain CREATE_ACCOUNT bypass the Reserved Codes governance feature entirely.
    // Only MANAGE_RESERVED_CODES (or Super Admin) may knowingly create an account inside a
    // reserved range.
    const allReserved = await prisma.reservedCode.findMany({ where: { isActive: true } });
    const reservedMatch = allReserved.find(r =>
      compareCodes(r.reserveStart, code) <= 0 &&
      compareCodes(r.reserveEnd, code) >= 0
    );
    if (reservedMatch && !checkPerm('MANAGE_RESERVED_CODES')) {
      return res.status(400).json({ error: { message: `Code ${code} falls within a reserved range: ${reservedMatch.reserveReason}`, status: 400 } });
    }

    const typeNameUpper = type.toUpperCase();
    let accountType = await prisma.accountType.findUnique({ where: { name: typeNameUpper } });
    if (!accountType) {
      accountType = await prisma.accountType.create({ data: { name: typeNameUpper } });
    }

    let parentId = null;
    let accountLevel = 'MAIN';

    if (!parentCode || parentCode === 'none') {
      return res.status(400).json({ error: { message: 'Creation of Level 1 (MAIN) accounts is not allowed. Main accounts (1000000, 2000000, etc.) are permanent.', status: 400 } });
    } else {
      const parentAcc = await prisma.account.findUnique({ where: { glCode: parentCode } });
      if (!parentAcc) {
        return res.status(400).json({ error: { message: 'Parent account not found', status: 400 } });
      }
      parentId = parentAcc.id;

      // 4-level hierarchy: MAIN→PARENT→SUBSIDIARY→GL
      if (parentAcc.accountLevel === 'MAIN') {
        accountLevel = 'PARENT';
      } else if (parentAcc.accountLevel === 'PARENT') {
        accountLevel = 'SUBSIDIARY';
      } else if (parentAcc.accountLevel === 'SUBSIDIARY') {
        accountLevel = 'GL';  // Level 4 — user-editable posting accounts
      } else {
        // GL accounts are leaf nodes — no Level 5
        return res.status(400).json({ error: { message: 'Cannot create an account under a Level 4 (GL) account. GL accounts are the deepest posting level.', status: 400 } });
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
        currency: currency || 'PKR',
        subsidiary: Array.isArray(subsidiary) ? subsidiary : (subsidiary ? [subsidiary] : ['Global']),
        initialBalance: parseFloat(initialBalance) || 0,
        detailType: detailType || 'Header',
        isLocked: !!isLocked,
        isReserved: !!isReserved,
      },
    });

    // Recalculate balance to set correct initial currentBalance sign
    const finalBalance = await AccountingService.recalculateAccountBalance(prisma, newAccount.id);
    newAccount.currentBalance = finalBalance;

    await logAudit(req.user.id, 'Create Account', 'COA', null, newAccount, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(201).json({ status: 201, data: newAccount });
  }

  if (method === 'PUT' || method === 'POST') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: 'Account ID is required', status: 400 } });
      }
      const existingAccount = await prisma.account.findUnique({ where: { id } });
      if (!existingAccount) {
        return res.status(404).json({ error: { message: 'Account not found', status: 404 } });
      }
      const restored = await prisma.account.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, 'Restore Account', 'COA', existingAccount, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Account restored successfully', data: restored });
    }
  }

  if (method === 'PUT') {
    if (!id) {
      return res.status(400).json({ error: { message: 'Account ID is required', status: 400 } });
    }

    const existingAccount = await prisma.account.findUnique({ where: { id } });
    if (!existingAccount) {
      return res.status(404).json({ error: { message: 'Account not found', status: 404 } });
    }

    if (existingAccount.accountLevel === 'MAIN' || existingAccount.glCode === '3000000' || existingAccount.glCode === '4000000') {
      return res.status(400).json({ error: { message: 'Level 1 (MAIN) accounts are permanent and cannot be modified (cannot rename, change GL code, delete, or change level).', status: 400 } });
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
      if (!/^\d{7}$/.test(code)) {
        return res.status(400).json({ error: { message: 'GL Code must be exactly 7 digits (e.g., 1000000)', status: 400 } });
      }

      // Reserved accounts cannot be assigned unless explicitly marked as reserved
      if (isReserved !== true && existingAccount.isReserved !== true) {
        const allReserved = await prisma.reservedCode.findMany({ where: { isActive: true } });
        const reservedMatch = allReserved.find(r => 
          compareCodes(r.reserveStart, code) <= 0 && 
          compareCodes(r.reserveEnd, code) >= 0
        );
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
    if (subsidiary !== undefined) updateData.subsidiary = Array.isArray(subsidiary) ? subsidiary : [subsidiary];
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
        return res.status(400).json({ error: { message: 'Moving an account to Level 1 (MAIN) is not allowed.', status: 400 } });
      } else {
        const parentAcc = await prisma.account.findUnique({ where: { glCode: parentCode } });
        if (!parentAcc) {
          return res.status(400).json({ error: { message: 'Parent account not found', status: 400 } });
        }
        updateData.parentId = parentAcc.id;

        // 4-level hierarchy: MAIN→PARENT→SUBSIDIARY→GL
        if (parentAcc.accountLevel === 'MAIN') {
          updateData.accountLevel = 'PARENT';
        } else if (parentAcc.accountLevel === 'PARENT') {
          updateData.accountLevel = 'SUBSIDIARY';
        } else if (parentAcc.accountLevel === 'SUBSIDIARY') {
          updateData.accountLevel = 'GL';
        } else {
          return res.status(400).json({ error: { message: 'Cannot move account under a GL account (no Level 5 allowed).', status: 400 } });
        }
      }
    }

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: updateData,
    });

    // Recalculate balance after modifications (like initial balance changes)
    const finalBalance = await AccountingService.recalculateAccountBalance(prisma, id);
    updatedAccount.currentBalance = finalBalance;

    await logAudit(req.user.id, isToggleLock ? 'Toggle Lock Account' : 'Modify Account', 'COA', existingAccount, updatedAccount, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(200).json({ status: 200, data: updatedAccount });
  }

  if (method === 'DELETE') {
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent) {
      if (!await isAdminOrAbove(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Admin or Super Admin can permanently delete records', status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: 'Account ID is required', status: 400 } });
      }
      const existingAccount = await prisma.account.findUnique({ where: { id } });
      if (!existingAccount) {
        return res.status(404).json({ error: { message: 'Account not found', status: 404 } });
      }
      if (existingAccount.accountLevel === 'MAIN' || existingAccount.isLocked || existingAccount.glCode === '3000000' || existingAccount.glCode === '4000000') {
        return res.status(400).json({ error: { message: 'MAIN accounts are permanently locked and cannot be deleted.', status: 400 } });
      }
      await prisma.account.delete({ where: { id } });
      await logAudit(req.user.id, 'Permanent Delete Account', 'COA', existingAccount, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Account permanently deleted successfully' });
    }

    if (!checkPerm('DELETE_ACCOUNT')) {
      const message = 'You do not have permission to delete this record.';
      return res.status(403).json({ success: false, message, error: { message, status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Account ID is required', status: 400 } });
    }

    const existingAccount = await prisma.account.findUnique({ where: { id } });
    if (!existingAccount) {
      return res.status(404).json({ error: { message: 'Account not found', status: 404 } });
    }

    // Only GL (Level 4) accounts can be deleted; MAIN/PARENT/SUBSIDIARY are system-locked
    if (existingAccount.accountLevel !== 'GL') {
      return res.status(400).json({ error: { message: `${existingAccount.accountLevel} accounts are system-defined and cannot be deleted. Only Level 4 (GL) accounts can be deleted.`, status: 400 } });
    }

    const updated = await prisma.account.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id }
    });

    await logAudit(req.user.id, 'Delete Account', 'COA', existingAccount, updated, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(200).json({ status: 200, message: 'Account deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
