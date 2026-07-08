import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { AccountingService } from '../_services/accounting.service.js';

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

  if (req.method === 'POST') {
    const { date, expenseHeadId, paidTo, description, amount, paymentMethod, bankAccountId, reference } = req.body;

    if (!expenseHeadId || !amount) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    const numAmount = Number(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be greater than zero', status: 400 } });
    }

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
            details: `Added expense of ${numAmount} for ${expenseHead.name}`
          }
        });
      } catch (e) {}

      return expense;
    });

    return res.status(201).json({ status: 201, data: result });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { id, date, expenseHeadId, paidTo, description, amount, paymentMethod, bankAccountId, reference } = req.body;
    if (!id || !expenseHeadId || !amount) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    const numAmount = Number(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be greater than zero', status: 400 } });
    }

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
            details: `Updated expense of ${numAmount} for ${expenseHead.name}`
          }
        });
      } catch (e) {}

      return updated;
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
    });

    return res.status(200).json({ status: 200, message: 'Expense deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
