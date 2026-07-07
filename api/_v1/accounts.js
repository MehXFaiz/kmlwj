import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { compareCodes } from "../_utils/code-compare.js";
import { AccountingService } from "../_services/accounting.service.js";
var accounts_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    const { search, type, status, level, nature, reserved, sortBy = "glCode", order = "asc", page = "1", limit = "100" } = req.query;
    const whereClause = {};
    if (search) {
      whereClause.OR = [
        { glCode: { contains: search, mode: "insensitive" } },
        { accountName: { contains: search, mode: "insensitive" } }
      ];
    }
    if (type && type !== "All") {
      whereClause.accountType = { name: type.toUpperCase() };
    }
    if (status && status !== "All") {
      whereClause.isLocked = status === "Inactive";
    }
    if (level && level !== "All") {
      whereClause.accountLevel = level;
    }
    if (nature && nature !== "All") {
      whereClause.detailType = nature;
    }
    if (reserved && reserved !== "All") {
      whereClause.isReserved = reserved === "Yes";
    }
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const [dbAccounts, total] = await Promise.all([
      prisma.account.findMany({
        where: whereClause,
        include: {
          accountType: true,
          parent: true
        },
        orderBy: { [sortBy]: order === "desc" ? "desc" : "asc" },
        skip,
        take: limitNum
      }),
      prisma.account.count({ where: whereClause })
    ]);
    const formatted = dbAccounts.map((acc) => ({
      id: acc.id,
      code: acc.glCode,
      name: acc.accountName,
      type: acc.accountType ? acc.accountType.name.charAt(0) + acc.accountType.name.slice(1).toLowerCase() : "Asset",
      level: acc.accountLevel,
      detailType: acc.detailType,
      parentCode: acc.parent ? acc.parent.glCode : null,
      currency: acc.currency,
      status: acc.isLocked ? "Inactive" : "Active",
      description: acc.description,
      subsidiary: acc.subsidiary,
      initialBalance: acc.initialBalance,
      isSystemDefined: acc.isSystemDefined,
      isReserved: acc.isReserved
    }));
    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
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
    const { code, name, type, detailType, parentCode, currency, subsidiary, initialBalance, description, isLocked, isReserved } = req.body;
    if (!code || !name || !type) {
      return res.status(400).json({ error: { message: "Code, Name, and Type are required", status: 400 } });
    }
    if (!/^\d{7}$/.test(code)) {
      return res.status(400).json({ error: { message: "GL Code must be exactly 7 digits (e.g., 1000000)", status: 400 } });
    }
    const codeExists = await prisma.account.findUnique({ where: { glCode: code } });
    if (codeExists) {
      return res.status(400).json({ error: { message: `Account code ${code} is already in use`, status: 400 } });
    }
    if (!isReserved) {
      const allReserved = await prisma.reservedCode.findMany({ where: { isActive: true } });
      const reservedMatch = allReserved.find(
        (r) => compareCodes(r.reserveStart, code) <= 0 && compareCodes(r.reserveEnd, code) >= 0
      );
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
    let accountLevel = "MAIN";
    if (!parentCode || parentCode === "none") {
      return res.status(400).json({ error: { message: "Creation of Level 1 (MAIN) accounts is not allowed. Main accounts (1000000, 2000000, etc.) are permanent.", status: 400 } });
    } else {
      const parentAcc = await prisma.account.findUnique({ where: { glCode: parentCode } });
      if (!parentAcc) {
        return res.status(400).json({ error: { message: "Parent account not found", status: 400 } });
      }
      parentId = parentAcc.id;
      if (parentAcc.accountLevel === "MAIN") {
        accountLevel = "PARENT";
      } else if (parentAcc.accountLevel === "PARENT") {
        accountLevel = "SUBSIDIARY";
      } else if (parentAcc.accountLevel === "SUBSIDIARY") {
        accountLevel = "GL";
      } else {
        return res.status(400).json({ error: { message: "Cannot create an account under a Level 4 (GL) account. GL accounts are the deepest posting level.", status: 400 } });
      }
    }
    const newAccount = await prisma.account.create({
      data: {
        glCode: code,
        accountName: name,
        accountLevel,
        parentId,
        accountTypeId: accountType.id,
        description,
        currency: currency || "PKR",
        subsidiary: subsidiary || ["Global"],
        initialBalance: parseFloat(initialBalance) || 0,
        detailType: detailType || "Header",
        isLocked: !!isLocked,
        isReserved: !!isReserved
      }
    });
    const finalBalance = await AccountingService.recalculateAccountBalance(prisma, newAccount.id);
    newAccount.currentBalance = finalBalance;
    await logAudit(req.user.id, "Create Account", "COA", null, newAccount, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newAccount });
  }
  if (method === "PUT") {
    if (!id) {
      return res.status(400).json({ error: { message: "Account ID is required", status: 400 } });
    }
    const existingAccount = await prisma.account.findUnique({ where: { id } });
    if (!existingAccount) {
      return res.status(404).json({ error: { message: "Account not found", status: 404 } });
    }
    if (existingAccount.accountLevel === "MAIN") {
      return res.status(400).json({ error: { message: "Level 1 (MAIN) accounts are permanent and cannot be modified.", status: 400 } });
    }
    const isToggleLock = req.body.isLocked !== void 0 && Object.keys(req.body).length === 1;
    if (existingAccount.isLocked && !isToggleLock && req.body.isLocked !== false) {
      return res.status(400).json({ error: { message: "Locked accounts cannot be edited", status: 400 } });
    }
    const requiredPerm = isToggleLock ? "LOCK_ACCOUNT" : "UPDATE_ACCOUNT";
    if (!checkPerm(requiredPerm)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    const { code, name, type, detailType, parentCode, currency, subsidiary, initialBalance, description, isLocked, isReserved } = req.body;
    if (code !== void 0) {
      if (!/^\d{7}$/.test(code)) {
        return res.status(400).json({ error: { message: "GL Code must be exactly 7 digits (e.g., 1000000)", status: 400 } });
      }
      if (isReserved !== true && existingAccount.isReserved !== true) {
        const allReserved = await prisma.reservedCode.findMany({ where: { isActive: true } });
        const reservedMatch = allReserved.find(
          (r) => compareCodes(r.reserveStart, code) <= 0 && compareCodes(r.reserveEnd, code) >= 0
        );
        if (reservedMatch) {
          return res.status(400).json({ error: { message: `Code ${code} falls within a reserved range: ${reservedMatch.reserveReason}`, status: 400 } });
        }
      }
    }
    const updateData = {};
    if (code !== void 0) updateData.glCode = code;
    if (name !== void 0) updateData.accountName = name;
    if (description !== void 0) updateData.description = description;
    if (currency !== void 0) updateData.currency = currency;
    if (subsidiary !== void 0) updateData.subsidiary = subsidiary;
    if (initialBalance !== void 0) updateData.initialBalance = parseFloat(initialBalance) || 0;
    if (detailType !== void 0) updateData.detailType = detailType;
    if (isLocked !== void 0) updateData.isLocked = isLocked;
    if (isReserved !== void 0) updateData.isReserved = isReserved;
    if (type !== void 0) {
      const typeNameUpper = type.toUpperCase();
      let accountType = await prisma.accountType.findUnique({ where: { name: typeNameUpper } });
      if (!accountType) {
        accountType = await prisma.accountType.create({ data: { name: typeNameUpper } });
      }
      updateData.accountTypeId = accountType.id;
    }
    if (parentCode !== void 0) {
      if (!parentCode || parentCode === "none") {
        return res.status(400).json({ error: { message: "Moving an account to Level 1 (MAIN) is not allowed.", status: 400 } });
      } else {
        const parentAcc = await prisma.account.findUnique({ where: { glCode: parentCode } });
        if (!parentAcc) {
          return res.status(400).json({ error: { message: "Parent account not found", status: 400 } });
        }
        updateData.parentId = parentAcc.id;
        if (parentAcc.accountLevel === "MAIN") {
          updateData.accountLevel = "PARENT";
        } else if (parentAcc.accountLevel === "PARENT") {
          updateData.accountLevel = "SUBSIDIARY";
        } else if (parentAcc.accountLevel === "SUBSIDIARY") {
          updateData.accountLevel = "GL";
        } else {
          return res.status(400).json({ error: { message: "Cannot move account under a GL account (no Level 5 allowed).", status: 400 } });
        }
      }
    }
    const updatedAccount = await prisma.account.update({
      where: { id },
      data: updateData
    });
    const finalBalance = await AccountingService.recalculateAccountBalance(prisma, id);
    updatedAccount.currentBalance = finalBalance;
    await logAudit(req.user.id, isToggleLock ? "Toggle Lock Account" : "Modify Account", "COA", existingAccount, updatedAccount, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedAccount });
  }
  if (method === "DELETE") {
    if (!checkPerm("DELETE_ACCOUNT")) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    if (!id) {
      return res.status(400).json({ error: { message: "Account ID is required", status: 400 } });
    }
    const existingAccount = await prisma.account.findUnique({ where: { id } });
    if (!existingAccount) {
      return res.status(404).json({ error: { message: "Account not found", status: 404 } });
    }
    if (existingAccount.accountLevel !== "GL") {
      return res.status(400).json({ error: { message: `${existingAccount.accountLevel} accounts are system-defined and cannot be deleted. Only Level 4 (GL) accounts can be deleted.`, status: 400 } });
    }
    await prisma.account.delete({ where: { id } });
    await logAudit(req.user.id, "Delete Account", "COA", existingAccount, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Account deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  accounts_default as default
};
