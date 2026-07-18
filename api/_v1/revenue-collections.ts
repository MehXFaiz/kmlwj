import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

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

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const action = req.query.action as string;
  const categoryFilter = req.query.category as string;

  if (method === 'GET') {
    const whereClause = categoryFilter ? { category: categoryFilter } : {};
    const collections = await prisma.revenueCollection.findMany({
      where: whereClause,
      include: {
        bankAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ status: 200, data: collections });
  }

  // Every write below (create, approve, edit, revert) posts directly to the General Ledger —
  // require RECORD_INCOME (or Super Admin) rather than just any valid login.
  const actingUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  const actingUserPerms = actingUser?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const actingUserIsSuperAdmin = actingUser?.role.name === 'Super Admin';
  if (!actingUserIsSuperAdmin && !actingUserPerms.includes('RECORD_INCOME')) {
    return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
  }

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
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be greater than 0', status: 400 } });
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
      const deletedItems = await prisma.$transaction(async (tx) => {
        const items = await tx.revenueCollection.findMany({
          where: { id: { in: ids } }
        });

        if (items.length === 0) {
          throw new Error('No records found to delete');
        }

        for (const item of items) {
          if (item.status === 'POSTED' && item.journalEntryId) {
            try {
              await AccountingService.deleteJournalEntry(tx, item.journalEntryId, req.user!.id, `${item.category} Deleted`);
            } catch (e) {
              // Ignore if already deleted
            }
          }
        }

        await tx.revenueCollection.deleteMany({
          where: { id: { in: items.map(i => i.id) } }
        });

        return items;
      }, accountingTxOptions);

      await logAudit(
        req.user.id,
        'Delete Revenue Collection',
        'REVENUE',
        null,
        { count: deletedItems.length, ids: deletedItems.map(i => i.id) },
        req.headers['x-forwarded-for'] as string,
        req.headers['user-agent']
      );

      return res.status(200).json({
        status: 200,
        message: `${deletedItems.length} record(s) deleted successfully`,
        data: deletedItems
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
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be greater than 0', status: 400 } });
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
