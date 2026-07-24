import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { AccountingService } from '../_services/accounting.service.js';
import { validateAmount } from '../_utils/amount.js';
import { notify } from '../_utils/notify.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    const expenses = await prisma.simpleExpense.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        expenseHead: true,
        createdBy: { select: { fullName: true } }
      }
    });

    return res.status(200).json({ status: 200, data: expenses });
  }

  // Every write below immediately posts a real transaction to the General Ledger — require
  // RECORD_EXPENSE (or Super Admin) rather than just any valid login.
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const isSuperAdmin = user?.role.name === 'Super Admin';
  if (!isSuperAdmin && !userPerms.includes('RECORD_EXPENSE')) {
    return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
  }

  if (req.method === 'POST') {
    const { date, expenseHeadId, paidTo, description, amount, paymentMethod, bankAccountId, reference } = req.body;

    if (!expenseHeadId || !amount) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    // SQA fix: `Number(amount) <= 0` was bypassed by any non-numeric string
    // (NaN comparisons are always false), letting a NaN amount reach ledger
    // posting. validateAmount() rejects non-numeric input and enforces a cap.
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;

    // Begin transaction to create SimpleExpense and post to General Ledger via AccountingService
    const result = await prisma.$transaction(async (tx) => {
      const expenseHead = await tx.expenseHead.findUnique({
        where: { id: expenseHeadId },
        include: { account: true }
      });

      if (!expenseHead) {
        throw new Error('Expense head not found');
      }

      const expenseAccountId = expenseHead.accountId || expenseHead.account?.id;

      // Automatically post payment to GL: Debits Expense Account, Credits Cash/Bank
      const postingResult = await AccountingService.postPayment(tx, {
        amount: numAmount,
        cashOrBankAccountId: paymentMethod === 'BANK' && bankAccountId ? bankAccountId : undefined,
        cashOrBankAccountKeyword: paymentMethod !== 'BANK' ? 'Cash' : undefined,
        expenseAccountId: expenseAccountId || undefined,
        expenseAccountKeyword: !expenseAccountId ? (expenseHead.name || 'Expense') : undefined,
        description: description || `Expense for ${expenseHead.name}`,
        reference: reference || 'Expense Payment',
        module: 'Simple Expense',
        postedBy: req.user!.id,
        postingDate: date ? new Date(date) : new Date(),
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const expense = await tx.simpleExpense.create({
        data: {
          date: date ? new Date(date) : new Date(),
          expenseHeadId,
          paidTo,
          description,
          amount: numAmount,
          paymentMethod: paymentMethod || 'CASH',
          bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
          reference,
          journalEntryId: postingResult.journalEntry.id,
          createdById: req.user!.id
        },
        include: { expenseHead: true }
      });

      try {
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'Create Simple Expense',
            module: 'Expense',
            newValues: { amount: numAmount, expenseHead: expenseHead.name, paidTo, description }
          }
        });
      } catch (e) {}

      return expense;
    }, accountingTxOptions);

    await notify(req, {
      title: 'Expense Added',
      message: `Expense of PKR ${Number((result as any).amount).toLocaleString()} recorded${(result as any).paidTo ? ` — paid to ${(result as any).paidTo}` : ''}.`,
      module: 'Expenses',
      recordId: (result as any).id,
      actionType: 'CREATE',
    });

    return res.status(201).json({ status: 201, data: result });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { id, date, expenseHeadId, paidTo, description, amount, paymentMethod, bankAccountId, reference } = req.body;
    if (!id || !expenseHeadId || !amount) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleExpense.findUnique({ where: { id }, include: { expenseHead: true } });
      if (!existing) throw new Error('Expense not found');

      if (existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, 'Simple Expense Updated');
        } catch (e) {}
      }

      const expenseHead = await tx.expenseHead.findUnique({
        where: { id: expenseHeadId },
        include: { account: true }
      });
      if (!expenseHead) {
        throw new Error('Expense head not found');
      }

      const expenseAccountId = expenseHead.accountId || expenseHead.account?.id;

      const cashAccount = paymentMethod !== 'BANK' ? await AccountingService.ensureCashInHandAccount(tx) : null;
      const postingResult = await AccountingService.postPayment(tx, {
        amount: numAmount,
        cashOrBankAccountId: paymentMethod === 'BANK' && bankAccountId ? bankAccountId : cashAccount?.id,
        expenseAccountId: expenseAccountId || undefined,
        expenseAccountKeyword: !expenseAccountId ? (expenseHead.name || 'Expense') : undefined,
        description: description || `Expense for ${expenseHead.name}`,
        reference: reference || 'Expense Payment',
        module: 'Simple Expense',
        postedBy: req.user!.id,
        postingDate: date ? new Date(date) : new Date(),
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const updated = await tx.simpleExpense.update({
        where: { id },
        data: {
          date: date ? new Date(date) : new Date(),
          expenseHeadId,
          paidTo,
          description,
          amount: numAmount,
          paymentMethod: paymentMethod || 'CASH',
          bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
          reference,
          journalEntryId: postingResult.journalEntry.id
        },
        include: { expenseHead: true, createdBy: { select: { fullName: true } } }
      });

      try {
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'Update Simple Expense',
            module: 'Expense',
            oldValues: { amount: existing.amount, expenseHeadId: existing.expenseHeadId },
            newValues: { amount: numAmount, expenseHead: expenseHead.name, paidTo, description }
          }
        });
      } catch (e) {}

      return updated;
    }, accountingTxOptions);

    await notify(req, {
      title: 'Expense Updated',
      message: `Expense (PKR ${Number((result as any).amount).toLocaleString()}) updated.`,
      module: 'Expenses',
      recordId: (result as any).id,
      actionType: 'UPDATE',
    });

    return res.status(200).json({ status: 200, data: result });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id || req.body.id;
    if (!id) return res.status(400).json({ error: { message: 'Expense ID required', status: 400 } });

    await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleExpense.findUnique({ where: { id: String(id) } });
      if (existing && existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, 'Simple Expense Deleted');
        } catch (e) {}
      }
      if (existing) {
        await tx.simpleExpense.delete({ where: { id: String(id) } });
      }
    }, accountingTxOptions);

    await notify(req, {
      title: 'Expense Deleted',
      message: 'Expense record deleted and journal entry reversed.',
      module: 'Expenses',
      recordId: String(id),
      actionType: 'DELETE',
      visibility: 'ADMIN_ONLY',
    });

    return res.status(200).json({ status: 200, message: 'Expense deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
