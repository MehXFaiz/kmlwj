import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { AccountingService } from '../_services/accounting.service.js';
import { PERMS } from '../_constants/permissions.js';
import { validateAmount } from '../_utils/amount.js';
import { notify } from '../_utils/notify.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    const incomes = await prisma.simpleIncome.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        revenueHead: true,
        createdBy: { select: { fullName: true } }
      }
    });

    return res.status(200).json({ status: 200, data: incomes });
  }

  // Every write below immediately posts a real transaction to the General Ledger.
  if (!await verifyPermission(req, res, PERMS.RECORD_INCOME)) return;

  if (req.method === 'POST') {
    const { date, revenueHeadId, description, amount, paymentMethod, bankAccountId, reference } = req.body;

    if (!revenueHeadId || !amount) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    // SQA fix: same NaN-bypass pattern as simple-expense.ts — validateAmount()
    // rejects non-numeric input and enforces an upper bound.
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;

    // Begin transaction to create SimpleIncome and post to General Ledger via AccountingService
    const result = await prisma.$transaction(async (tx) => {
      const revenueHead = await tx.revenueHead.findUnique({
        where: { id: revenueHeadId },
        include: { account: true }
      });

      if (!revenueHead) {
        throw new Error('Revenue head not found');
      }

      const incomeAccountId = revenueHead.accountId || revenueHead.account?.id;

      // Automatically post receipt to GL: Debits Cash/Bank, Credits Income Account
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: numAmount,
        cashOrBankAccountId: paymentMethod === 'BANK' && bankAccountId ? bankAccountId : undefined,
        cashOrBankAccountKeyword: paymentMethod !== 'BANK' ? 'Cash' : undefined,
        incomeAccountId: incomeAccountId || undefined,
        incomeAccountKeyword: !incomeAccountId ? (revenueHead.name || 'Income') : undefined,
        description: description || `Income from ${revenueHead.name}`,
        reference: reference || 'Income Receipt',
        module: 'Simple Income',
        postedBy: req.user!.id,
        postingDate: date ? new Date(date) : new Date(),
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const income = await tx.simpleIncome.create({
        data: {
          date: date ? new Date(date) : new Date(),
          revenueHeadId,
          description,
          amount: numAmount,
          paymentMethod: paymentMethod || 'CASH',
          bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
          reference,
          journalEntryId: postingResult.journalEntry.id,
          createdById: req.user!.id
        },
        include: { revenueHead: true }
      });

      try {
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'Create Simple Income',
            module: 'Income',
            newValues: { amount: numAmount, revenueHead: revenueHead.name, description }
          }
        });
      } catch (e) {}

      return income;
    }, accountingTxOptions);

    await notify(req, {
      title: 'Income Recorded',
      message: `Income of Rs ${numAmount.toLocaleString()} recorded and posted to the ledger.`,
      module: 'Income',
      recordId: (result as any).id,
      actionType: 'CREATE',
    });

    return res.status(201).json({ status: 201, data: result });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { id, date, revenueHeadId, description, amount, paymentMethod, bankAccountId, reference } = req.body;
    if (!id || !revenueHeadId || !amount) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const numAmount = amountCheck.amount;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleIncome.findUnique({ where: { id }, include: { revenueHead: true } });
      if (!existing) throw new Error('Income not found');

      if (existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, 'Simple Income Updated');
        } catch (e) {}
      }

      const revenueHead = await tx.revenueHead.findUnique({
        where: { id: revenueHeadId },
        include: { account: true }
      });
      if (!revenueHead) {
        throw new Error('Revenue head not found');
      }

      const incomeAccountId = revenueHead.accountId || revenueHead.account?.id;

      const cashAccount = paymentMethod !== 'BANK' ? await AccountingService.ensureCashInHandAccount(tx) : null;
      const postingResult = await AccountingService.postReceipt(tx, {
        amount: numAmount,
        cashOrBankAccountId: paymentMethod === 'BANK' && bankAccountId ? bankAccountId : cashAccount?.id,
        incomeAccountId: incomeAccountId || undefined,
        incomeAccountKeyword: !incomeAccountId ? (revenueHead.name || 'Income') : undefined,
        description: description || `Income from ${revenueHead.name}`,
        reference: reference || 'Income Receipt',
        module: 'Simple Income',
        postedBy: req.user!.id,
        postingDate: date ? new Date(date) : new Date(),
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      const updated = await tx.simpleIncome.update({
        where: { id },
        data: {
          date: date ? new Date(date) : new Date(),
          revenueHeadId,
          description,
          amount: numAmount,
          paymentMethod: paymentMethod || 'CASH',
          bankAccountId: paymentMethod === 'BANK' ? bankAccountId : null,
          reference,
          journalEntryId: postingResult.journalEntry.id
        },
        include: { revenueHead: true, createdBy: { select: { fullName: true } } }
      });

      try {
        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'Update Simple Income',
            module: 'Income',
            oldValues: { amount: existing.amount, revenueHeadId: existing.revenueHeadId },
            newValues: { amount: numAmount, revenueHead: revenueHead.name, description }
          }
        });
      } catch (e) {}

      return updated;
    }, accountingTxOptions);

    await notify(req, {
      title: 'Income Updated',
      message: `Income ${id} updated to Rs ${numAmount.toLocaleString()} and re-posted to the ledger.`,
      module: 'Income',
      recordId: id,
      actionType: 'UPDATE',
    });

    return res.status(200).json({ status: 200, data: result });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id || req.body.id;
    if (!id) return res.status(400).json({ error: { message: 'Income ID required', status: 400 } });

    await prisma.$transaction(async (tx) => {
      const existing = await tx.simpleIncome.findUnique({ where: { id: String(id) } });
      if (existing && existing.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, 'Simple Income Deleted');
        } catch (e) {}
      }
      if (existing) {
        await tx.simpleIncome.delete({ where: { id: String(id) } });
      }
    }, accountingTxOptions);

    await notify(req, {
      title: 'Income Deleted',
      message: `Income ${id} deleted and reversed out of the ledger.`,
      module: 'Income',
      recordId: String(id),
      actionType: 'DELETE',
    });

    return res.status(200).json({ status: 200, message: 'Income deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
