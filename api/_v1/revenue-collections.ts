import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { enforceRestrictedRolePolicy } from '../_middlewares/rbac.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';
import { validateAmount } from '../_utils/amount.js';
import { isValidTransactionDate } from '../_utils/date-range.js';
import { PERMS } from '../_constants/permissions.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

// SQA fix: `category` previously accepted any free-form string with only a
// non-empty check — a caller bypassing the UI dropdown (e.g. direct API call)
// could create records under fabricated categories that break category-based
// reporting (CategorizedRevenues.jsx groups by exactly this fixed set).
const ALLOWED_CATEGORIES = ['Zakat', 'Fitra', 'Membership Fee', 'Bus Booking'];

async function getIncomeAccountForCategory(category: string, tx: any) {
  let searchKeyword = category;
  if (/membership/i.test(category)) searchKeyword = 'Membership';
  else if (/bus/i.test(category)) searchKeyword = 'Bus';
  else if (/hall/i.test(category)) searchKeyword = 'Hall';
  else if (/zakat/i.test(category)) searchKeyword = 'Zakat';

  // First try: find a revenue account matching searchKeyword (unlocked, no child accounts)
  let acc = await tx.account.findFirst({
    where: {
      accountType: { name: { in: ['Revenue', 'Income'], mode: 'insensitive' } },
      accountName: { contains: searchKeyword, mode: 'insensitive' },
      isLocked: false,
      children: { none: {} }
    },
    orderBy: { glCode: 'asc' }
  });

  if (!acc && searchKeyword !== category) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { in: ['Revenue', 'Income'], mode: 'insensitive' } },
        accountName: { contains: category, mode: 'insensitive' },
        isLocked: false,
        children: { none: {} }
      },
      orderBy: { glCode: 'asc' }
    });
  }

  // Last resort: any unlocked leaf revenue account
  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { in: ['Revenue', 'Income'], mode: 'insensitive' } },
        isLocked: false,
        children: { none: {} }
      },
      orderBy: { glCode: 'asc' }
    });
  }

  return acc;
}

import { isSuperAdmin, getDeletedFilter } from '../_utils/soft-delete.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  // RBAC: PUT/PATCH/DELETE always blocked for non-privileged roles
  if (!await enforceRestrictedRolePolicy(req, res)) return;

  const method = req.method?.toUpperCase() ?? '';
  const id = req.query.id as string;
  const action = (req.query.action || req.body?.action) as string;
  const categoryFilter = req.query.category as string;

  if (method === 'GET') {
    if (!await verifyPermission(req, res, PERMS.VIEW_REVENUE_COLLECTIONS)) return;

    const whereClause: any = {
      ...(categoryFilter ? { category: categoryFilter } : {}),
      ...getDeletedFilter(req.query),
    };
    // Bounded default instead of an unconditional full-table scan — 1000 comfortably
    // covers current usage while capping worst-case query cost as the table grows.
    const { limit = '1000', page = '1' } = req.query as any;
    const limitNum = parseInt(limit) || 1000;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;

    const [collections, total] = await Promise.all([
      prisma.revenueCollection.findMany({
        where: whereClause,
        include: {
          bankAccount: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.revenueCollection.count({ where: whereClause }),
    ]);
    return res.status(200).json({ status: 200, data: collections, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: 'Collection ID is required', status: 400 } });
      }
      const existing = await prisma.revenueCollection.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Record not found', status: 404 } });
      }
      const restored = await prisma.revenueCollection.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      if (existing.journalEntryId) {
        await prisma.journalEntry.update({
          where: { id: existing.journalEntryId },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        }).catch(() => {});
        // The cached Account.currentBalance must follow the ledger: this entry
        // just moved in/out of POSTED_JOURNAL_FILTER, so rebuild every account
        // it touches or the balance keeps the deleted transaction's impact.
        await AccountingService.recalculateBalancesForJournalEntry(prisma, existing.journalEntryId);
      }
      await logAudit(req.user.id, 'Restore Revenue Collection', 'REVENUE', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Revenue collection restored successfully', data: restored });
    }
  }

  // Every write below (create, approve, edit, revert) posts directly to the General Ledger.
  // Non-privileged roles can only create (POST); PUT/DELETE already blocked above.
  if (!await verifyPermission(req, res, PERMS.CREATE_REVENUE_COLLECTION)) return;

  if (method === 'POST') {
    // Action: Approve & Post to Ledger
    if (action === 'approve') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: 'Collection ID is required', status: 400 } });

      const item = await prisma.revenueCollection.findUnique({ where: { id }, include: { bankAccount: true } });
      if (!item) return res.status(404).json({ error: { message: 'Record not found', status: 404 } });
      if (item.status === 'POSTED') return res.status(400).json({ error: { message: 'Record is already posted to ledger', status: 400 } });

      let debitAccountId: string | null = null;
      if (item.paymentMethod === 'CASH') {
        const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
        debitAccountId = cashAccount.id;
      } else {
        if (!item.bankAccountId) return res.status(400).json({ error: { message: 'Bank account is required for BANK/CHEQUE payments', status: 400 } });
        debitAccountId = item.bankAccountId;
      }

      const result = await prisma.$transaction(async (tx) => {
        const incomeAccount = await getIncomeAccountForCategory(item.category, tx);
        if (!incomeAccount) {
          throw new Error(`No revenue account found in Chart of Accounts for ${item.category}`);
        }

        const postingResult = await AccountingService.postReceipt(tx, {
          amount: item.amount,
          cashOrBankAccountId: debitAccountId!,
          incomeAccountId: incomeAccount.id,
          reference: `${item.category.slice(0, 3).toUpperCase()}-${item.receiptNo}`,
          description: `${item.category} Receipt from ${item.title} ${item.subTitle ? `(${item.subTitle})` : ''}`,
          module: item.category,
          voucherType: 'BR',
          postedBy: req.user!.id,
          postingDate: item.eventDate || new Date(),
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        const approvedItem = await tx.revenueCollection.update({
          where: { id },
          data: { 
            status: 'POSTED',
            journalEntryId: postingResult.journalEntry.id 
          }
        });

        return { approvedItem, journalEntry: postingResult.journalEntry };
      }, accountingTxOptions);

      await logAudit(req.user.id, `Post ${item.category}`, 'REVENUE', item, result.approvedItem, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


      return res.status(200).json({ status: 200, data: result.approvedItem, message: `${item.category} posted to ledger successfully` });
    }

    if (action === 'revert') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: 'Collection ID is required', status: 400 } });

      const item = await prisma.revenueCollection.findUnique({ where: { id } });
      if (!item) return res.status(404).json({ error: { message: 'Record not found', status: 404 } });
      if (item.status !== 'POSTED') return res.status(400).json({ error: { message: 'Record is not posted to ledger', status: 400 } });

      const result = await prisma.$transaction(async (tx) => {
        if (item.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, item.journalEntryId, req.user!.id, `Reverted ${item.category}`);
          } catch (e) {}
        }

        const revertedItem = await tx.revenueCollection.update({
          where: { id },
          data: { 
            status: 'Confirmed',
            journalEntryId: null
          }
        });

        return revertedItem;
      }, accountingTxOptions);

      await logAudit(req.user.id, `Revert ${item.category}`, 'REVENUE', item, result, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


      return res.status(200).json({ status: 200, data: result, message: `${item.category} reverted from ledger successfully` });
    }

    // Action: Create Record & Auto-Post to Ledger
    const { category, title, subTitle, mobile, eventDate, quantity, rate, destination, amount, paymentMethod, bankAccountId, chequeNumber, remarks } = req.body;

    if (!category || !title || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields (category, title, amount, paymentMethod)', status: 400 } });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: { message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`, status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const parsedAmount = amountCheck.amount;
    if (eventDate !== undefined && eventDate !== null && eventDate !== '' && !isValidTransactionDate(new Date(eventDate))) {
      return res.status(400).json({ error: { message: 'Event date is out of the acceptable range', status: 400 } });
    }
    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payment methods', status: 400 } });
    }

    let debitAccountId: string | null = null;
    if (paymentMethod === 'CASH') {
      const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
      debitAccountId = cashAccount.id;
    } else {
      debitAccountId = bankAccountId;
    }

    const result = await prisma.$transaction(async (tx) => {
      const incomeAccount = await getIncomeAccountForCategory(category, tx);
      if (!incomeAccount) {
        throw new Error(`No revenue account found in Chart of Accounts for ${category}`);
      }

      // Get a unique receipt number for reference (do not insert manually; let autoincrement handle it)
      const count = await tx.revenueCollection.count({ where: { category } });
      const refNo = count + 1;

      const postingResult = await AccountingService.postReceipt(tx, {
        amount: parsedAmount,
        cashOrBankAccountId: debitAccountId!,
        incomeAccountId: incomeAccount.id,
        reference: `${category.slice(0, 3).toUpperCase()}-${refNo}`,
        description: `${category} Receipt from ${title} ${subTitle ? `(${subTitle})` : ''}`,
        module: category,
        voucherType: 'BR',
        postedBy: req.user!.id,
        postingDate: eventDate ? new Date(eventDate) : new Date(),
        ipAddress: req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent']
      });

      const newItem = await tx.revenueCollection.create({
        data: {
          category,
          // receiptNo is autoincrement — do NOT set it manually
          title,
          subTitle: subTitle || null,
          mobile: mobile || null,
          eventDate: eventDate ? new Date(eventDate) : new Date(),
          quantity: quantity ? parseInt(quantity, 10) : null,
          rate: rate ? parseFloat(rate) : null,
          destination: destination || null,
          amount: parsedAmount,
          paymentMethod,
          bankAccountId: bankAccountId || null,
          chequeNumber: chequeNumber || null,
          status: 'POSTED',
          remarks: remarks || null,
          journalEntryId: postingResult.journalEntry.id,
          createdById: req.user!.id
        },
        include: {
          bankAccount: true,
          journalEntry: true
        }
      });

      return newItem;
    }, accountingTxOptions);

    await logAudit(req.user.id, `Create & Post ${category}`, 'REVENUE', null, result, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(201).json({ status: 201, data: result });
  }

  if (method === 'DELETE') {
    // Bulk-ID parsing (supports single or multiple IDs) merged with the
    // soft-delete-by-default + permanent-delete-gated-by-Super-Admin logic
    // that used to live in a second, unreachable 'DELETE' block below it —
    // that block always lost because this one already returns unconditionally.
    // The result was every delete here being an irreversible hard-delete with
    // no permission gate, and Restore therefore always 404ing.
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can permanently delete records', status: 403 } });
    }

    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Record ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: { message: 'No valid ID provided', status: 400 } });
    }

    try {
      const affectedItems = await prisma.$transaction(async (tx) => {
        const items = await tx.revenueCollection.findMany({
          where: { id: { in: ids } }
        });

        if (items.length === 0) {
          throw new Error('No records found to delete');
        }

        for (const item of items) {
          if (item.journalEntryId) {
            try {
              if (isPermanent) {
                await AccountingService.deleteJournalEntry(tx, item.journalEntryId, req.user!.id, `${item.category} Permanently Deleted`);
              } else {
                await tx.journalEntry.update({
                  where: { id: item.journalEntryId },
                  data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
                });
                // The cached Account.currentBalance must follow the ledger: this entry
                // just moved in/out of POSTED_JOURNAL_FILTER, so rebuild every account
                // it touches or the balance keeps the deleted transaction's impact.
                await AccountingService.recalculateBalancesForJournalEntry(tx, item.journalEntryId);
              }
            } catch (e) {
              // Ignore if already deleted
            }
          }
        }

        if (isPermanent) {
          await tx.revenueCollection.deleteMany({
            where: { id: { in: items.map(i => i.id) } }
          });
        } else {
          await tx.revenueCollection.updateMany({
            where: { id: { in: items.map(i => i.id) } },
            data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
          });
        }

        return items;
      }, accountingTxOptions);

      await logAudit(
        req.user.id,
        isPermanent ? 'Permanent Delete Revenue Collection' : 'Delete Revenue Collection',
        'REVENUE',
        null,
        { count: affectedItems.length, ids: affectedItems.map(i => i.id), permanent: isPermanent },
        req.headers['x-forwarded-for'] as string,
        req.headers['user-agent']
      );


      return res.status(200).json({
        status: 200,
        message: `${affectedItems.length} record(s) deleted successfully`,
        data: affectedItems
      });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message || 'Failed to delete record(s)', status: 400 } });
    }
  }

  if (method === 'PUT') {
    const id = req.query.id as string;
    if (!id) {
      return res.status(400).json({ error: { message: 'Record ID is required', status: 400 } });
    }

    const existingItem = await prisma.revenueCollection.findUnique({ where: { id } });
    if (!existingItem) {
      return res.status(404).json({ error: { message: 'Record not found', status: 404 } });
    }

    const { category, title, subTitle, mobile, eventDate, quantity, rate, destination, amount, paymentMethod, bankAccountId, chequeNumber, remarks } = req.body;

    if (!category || !title || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields (category, title, amount, paymentMethod)', status: 400 } });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: { message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`, status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const parsedAmount = amountCheck.amount;
    if (eventDate !== undefined && eventDate !== null && eventDate !== '' && !isValidTransactionDate(new Date(eventDate))) {
      return res.status(400).json({ error: { message: 'Event date is out of the acceptable range', status: 400 } });
    }
    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payment methods', status: 400 } });
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      if (existingItem.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existingItem.journalEntryId, req.user!.id, `Reversing ${category} for update`);
        } catch (e) {}
      }

      let debitAccountId: string | null = null;
      if (paymentMethod === 'CASH') {
        const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
        debitAccountId = cashAccount.id;
      } else {
        debitAccountId = bankAccountId;
      }

      const incomeAccount = await getIncomeAccountForCategory(category, tx);
      if (!incomeAccount) {
        throw new Error(`No revenue account found in Chart of Accounts for ${category}`);
      }

      const postingResult = await AccountingService.postReceipt(tx, {
        amount: parsedAmount,
        cashOrBankAccountId: debitAccountId!,
        incomeAccountId: incomeAccount.id,
        reference: `${category.slice(0, 3).toUpperCase()}-${existingItem.receiptNo}`,
        description: `${category} Receipt from ${title} ${subTitle ? `(${subTitle})` : ''}`,
        module: category,
        voucherType: 'BR',
        postedBy: req.user!.id,
        postingDate: eventDate ? new Date(eventDate) : new Date(),
        ipAddress: req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent']
      });

      return await tx.revenueCollection.update({
        where: { id },
        data: {
          category,
          title,
          subTitle: subTitle || null,
          mobile: mobile || null,
          eventDate: eventDate ? new Date(eventDate) : new Date(),
          quantity: quantity ? parseInt(quantity, 10) : null,
          rate: rate ? parseFloat(rate) : null,
          destination: destination || null,
          amount: parsedAmount,
          paymentMethod,
          bankAccountId: bankAccountId || null,
          chequeNumber: chequeNumber || null,
          status: 'POSTED',
          remarks: remarks || null,
          journalEntryId: postingResult.journalEntry.id
        },
        include: {
          bankAccount: true,
          journalEntry: true
        }
      });
    }, accountingTxOptions);

    await logAudit(req.user.id, `Update & Post ${category}`, 'REVENUE', existingItem, updatedItem, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(200).json({ status: 200, data: updatedItem });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
