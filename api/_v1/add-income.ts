import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { AccountingService } from '../_services/accounting.service.js';
import { validateAmount } from '../_utils/amount.js';
import { isSuperAdmin, getDeletedFilter } from '../_utils/soft-delete.js';
import { logAudit } from '../_utils/audit.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const idParam = (req.query.id || req.body?.id) as string;
  const action = (req.query.action || req.body?.action) as string;

  const isAdminOrSuperAdmin = req.user.role === 'Admin' || req.user.role === 'Super Admin' || await isSuperAdmin(req);

  if (method === 'GET') {
    const { categoryId, paymentMethod, startDate, endDate, search, page, limit } = req.query as Record<string, string>;

    const whereClause: any = getDeletedFilter(req.query);

    if (categoryId && categoryId !== 'all') {
      whereClause.categoryId = categoryId;
    }

    if (paymentMethod && paymentMethod !== 'all') {
      whereClause.paymentMethod = paymentMethod.toUpperCase();
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }

    if (search && search.trim()) {
      const queryStr = search.trim();
      whereClause.OR = [
        { referenceNumber: { contains: queryStr, mode: 'insensitive' } },
        { remarks: { contains: queryStr, mode: 'insensitive' } },
        { category: { name: { contains: queryStr, mode: 'insensitive' } } },
        { bankAccount: { accountName: { contains: queryStr, mode: 'insensitive' } } },
      ];

      // If search is a valid number, also search amount
      const numVal = parseFloat(queryStr);
      if (!isNaN(numVal)) {
        whereClause.OR.push({ amount: numVal });
      }
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '50', 10);
    const skip = (pageNum - 1) * limitNum;

    const [total, records] = await Promise.all([
      prisma.addIncomeRecord.count({ where: whereClause }),
      prisma.addIncomeRecord.findMany({
        where: whereClause,
        orderBy: { date: 'desc' },
        skip: isNaN(skip) ? undefined : skip,
        take: isNaN(limitNum) ? undefined : limitNum,
        include: {
          category: true,
          bankAccount: { select: { id: true, glCode: true, accountName: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          journalEntry: { select: { id: true, voucherNo: true, status: true } }
        }
      })
    ]);

    return res.status(200).json({
      status: 200,
      data: records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  }

  if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      if (!idParam) {
        return res.status(400).json({ error: { message: 'Record ID is required', status: 400 } });
      }
      const existing = await prisma.addIncomeRecord.findUnique({ where: { id: idParam } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Income record not found', status: 404 } });
      }
      const restored = await prisma.addIncomeRecord.update({
        where: { id: idParam },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      if (existing.journalEntryId) {
        await prisma.journalEntry.update({
          where: { id: existing.journalEntryId },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        }).catch(() => {});
        await AccountingService.recalculateBalancesForJournalEntry(prisma, existing.journalEntryId);
      }
      await logAudit(req.user.id, 'Restore Income Record', 'Add Income', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Income record restored successfully', data: restored });
    }
  }

  // Admin & Super Admin restriction for Create, Update, Delete
  if (!isAdminOrSuperAdmin) {
    return res.status(403).json({ error: { message: 'Forbidden: Only Admin and Super Admin can Add/Edit/Delete Income records', status: 403 } });
  }

  if (method === 'POST') {
    const { categoryId, customCategoryName, subCategory, amount, date, paymentMethod, bankAccountId, referenceNumber, remarks, attachmentUrl } = req.body;

    if ((!categoryId && !customCategoryName) || amount === undefined || amount === null) {
      return res.status(400).json({ error: { message: 'Income Category and Amount are required fields', status: 400 } });
    }

    const normalizedPaymentMethod = (paymentMethod || 'CASH').toUpperCase();
    if (normalizedPaymentMethod === 'BANK' && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank Account is required when Payment Method is Bank', status: 400 } });
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;

    const result = await prisma.$transaction(async (tx) => {
      let category;
      if (categoryId === 'CUSTOM' || (customCategoryName && customCategoryName.trim())) {
        const catName = (customCategoryName || 'Custom Income').trim();
        category = await tx.incomeCategory.findUnique({
          where: { name: catName },
          include: { account: { include: { accountType: true } } }
        });
        if (!category) {
          // A freshly created custom category has no accountId yet — it will
          // correctly fail the "not linked with any Revenue GL Account" guard
          // below until an admin maps it, same as any other unmapped category.
          category = await tx.incomeCategory.create({
            data: { name: catName, description: 'Custom Income Category', isActive: true },
            include: { account: { include: { accountType: true } } }
          });
        }
      } else {
        category = await tx.incomeCategory.findUnique({
          where: { id: categoryId },
          include: { account: { include: { accountType: true } } }
        });
      }

      if (!category) {
        throw new Error('Income Category not found');
      }

      const creditAccountId = category.accountId || category.account?.id;

      // Never fall back to posting by category name/text — that's exactly
      // what produced "Accounting Engine Error: Account not found in Chart
      // of Accounts for identifier 'HaqqaniDecorationIncome'"-style crashes.
      // Every Income Category must be explicitly mapped (Chart of Accounts >
      // Income Category Mapping) before it can be used to record income.
      if (!creditAccountId) {
        const err: any = new Error('This income category is not linked with any Revenue GL Account. Please map it from Chart of Accounts.');
        err.status = 400;
        throw err;
      }
      const mappedAccountType = category.account?.accountType?.name?.toUpperCase();
      if (mappedAccountType && mappedAccountType !== 'REVENUE') {
        const err: any = new Error(`This income category is mapped to a non-Revenue account (${category.account?.accountName}). Please map it to a Revenue GL Account from Chart of Accounts.`);
        err.status = 400;
        throw err;
      }

      const cleanSubCategory = subCategory && subCategory.trim() ? subCategory.trim() : null;

      const incomeRecord = await tx.addIncomeRecord.create({
        data: {
          categoryId: category.id,
          subCategory: cleanSubCategory,
          amount: numAmount,
          date: date ? new Date(date) : new Date(),
          paymentMethod: normalizedPaymentMethod as any,
          bankAccountId: bankAccountId || null,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          remarks: remarks ? remarks.trim() : null,
          attachmentUrl: attachmentUrl || null,
          status: 'PENDING_POST',
          journalEntryId: null,
          createdById: req.user!.id
        },
        include: {
          category: true,
          bankAccount: { select: { id: true, glCode: true, accountName: true } },
          createdBy: { select: { id: true, fullName: true, email: true } }
        }
      });

      await logAudit(req.user!.id, 'Create Income Record (Pending Post)', 'Add Income', null, incomeRecord, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return incomeRecord;
    }, accountingTxOptions);

    return res.status(201).json({ status: 201, message: 'Income record saved as Pending Post', data: result });
  }

  if (method === 'PUT') {
    const { id, categoryId, customCategoryName, subCategory, amount, date, paymentMethod, bankAccountId, referenceNumber, remarks, attachmentUrl } = req.body;

    const targetId = id || idParam;
    if (!targetId || (!categoryId && !customCategoryName) || amount === undefined) {
      return res.status(400).json({ error: { message: 'Record ID, Income Category, and Amount are required', status: 400 } });
    }

    const normalizedPaymentMethod = (paymentMethod || 'CASH').toUpperCase();
    if (normalizedPaymentMethod === 'BANK' && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank Account is required when Payment Method is Bank', status: 400 } });
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.addIncomeRecord.findUnique({
        where: { id: targetId },
        include: { category: true }
      });

      if (!existing) {
        throw new Error('Income record not found');
      }

      // Delete old journal entry if present
      if (existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, 'Income Record Updated');
        } catch (e) {}
      }

      let category;
      if (categoryId === 'CUSTOM' || (customCategoryName && customCategoryName.trim())) {
        const catName = (customCategoryName || 'Custom Income').trim();
        category = await tx.incomeCategory.findUnique({
          where: { name: catName },
          include: { account: { include: { accountType: true } } }
        });
        if (!category) {
          // A freshly created custom category has no accountId yet — it will
          // correctly fail the "not linked with any Revenue GL Account" guard
          // below until an admin maps it, same as any other unmapped category.
          category = await tx.incomeCategory.create({
            data: { name: catName, description: 'Custom Income Category', isActive: true },
            include: { account: { include: { accountType: true } } }
          });
        }
      } else {
        category = await tx.incomeCategory.findUnique({
          where: { id: categoryId },
          include: { account: { include: { accountType: true } } }
        });
      }

      if (!category) {
        throw new Error('Income Category not found');
      }

      const creditAccountId = category.accountId || category.account?.id;

      // Same guard as POST — never fall back to posting by category name/text.
      if (!creditAccountId) {
        const err: any = new Error('This income category is not linked with any Revenue GL Account. Please map it from Chart of Accounts.');
        err.status = 400;
        throw err;
      }
      const mappedAccountType = category.account?.accountType?.name?.toUpperCase();
      if (mappedAccountType && mappedAccountType !== 'REVENUE') {
        const err: any = new Error(`This income category is mapped to a non-Revenue account (${category.account?.accountName}). Please map it to a Revenue GL Account from Chart of Accounts.`);
        err.status = 400;
        throw err;
      }

      const cleanSubCategory = subCategory && subCategory.trim() ? subCategory.trim() : null;

      const postingDescription = remarks
        ? `${remarks} (${category.name}${cleanSubCategory ? ` - ${cleanSubCategory}` : ''})`
        : `Income received for ${category.name}${cleanSubCategory ? ` - ${cleanSubCategory}` : ''}`;

      // Create updated Journal Entry — always by the mapped Account ID / GL
      // Code, never by category text.
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: numAmount,
        cashOrBankAccountId: (normalizedPaymentMethod === 'BANK' || normalizedPaymentMethod === 'ONLINE' || normalizedPaymentMethod === 'CHEQUE') && bankAccountId ? bankAccountId : undefined,
        cashOrBankAccountKeyword: !(normalizedPaymentMethod === 'BANK' && bankAccountId) ? 'Cash' : undefined,
        incomeAccountId: creditAccountId,
        description: postingDescription,
        reference: referenceNumber || `Income Ref #${Date.now().toString().slice(-6)}`,
        module: 'Add Income',
        postedBy: req.user!.id,
        postingDate: date ? new Date(date) : new Date(),
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const updatedRecord = await tx.addIncomeRecord.update({
        where: { id: targetId },
        data: {
          categoryId: category.id,
          subCategory: cleanSubCategory,
          amount: numAmount,
          date: date ? new Date(date) : new Date(),
          paymentMethod: normalizedPaymentMethod as any,
          bankAccountId: bankAccountId || null,
          referenceNumber: referenceNumber ? referenceNumber.trim() : null,
          remarks: remarks ? remarks.trim() : null,
          attachmentUrl: attachmentUrl !== undefined ? attachmentUrl : existing.attachmentUrl,
          journalEntryId: postingResult.journalEntry.id
        },
        include: {
          category: true,
          bankAccount: { select: { id: true, glCode: true, accountName: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
          journalEntry: { select: { id: true, voucherNo: true, status: true } }
        }
      });

      await logAudit(req.user!.id, 'Update Income Record', 'Add Income', existing, updatedRecord, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return updatedRecord;
    }, accountingTxOptions);

    return res.status(200).json({ status: 200, message: 'Income record updated successfully', data: result });
  }

  if (method === 'DELETE') {
    const bodyIds = req.body?.ids;
    const queryIds = req.query.ids ? String(req.query.ids).split(',') : null;
    const ids: string[] = Array.isArray(bodyIds)
      ? bodyIds
      : (queryIds || (req.query.id || req.body?.id ? [String(req.query.id || req.body?.id)] : []));

    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: { message: 'Income Record ID(s) required', status: 400 } });
    }

    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;

    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can permanently delete records', status: 403 } });
    }

    await prisma.$transaction(async (tx) => {
      const existingRecords = await tx.addIncomeRecord.findMany({
        where: { id: { in: ids } }
      });

      for (const existing of existingRecords) {
        if (existing.journalEntryId) {
          try {
            if (isPermanent) {
              await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, 'Income Record Permanently Deleted');
            } else {
              await tx.journalEntry.update({
                where: { id: existing.journalEntryId },
                data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
              });
              await AccountingService.recalculateBalancesForJournalEntry(tx, existing.journalEntryId);
            }
          } catch (e) {}
        }

        if (isPermanent) {
          await tx.addIncomeRecord.delete({ where: { id: existing.id } });
          await logAudit(req.user!.id, 'Permanent Delete Income Record', 'Add Income', existing, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
        } else {
          const updated = await tx.addIncomeRecord.update({
            where: { id: existing.id },
            data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
          });
          await logAudit(req.user!.id, 'Delete Income Record', 'Add Income', existing, updated, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
        }
      }
    }, accountingTxOptions);

    return res.status(200).json({ status: 200, message: `${ids.length} income record(s) deleted successfully` });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
