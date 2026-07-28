import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, getDeletedFilter } from '../_utils/soft-delete.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const action = (req.query.action || req.body?.action) as string;

  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    if (!await verifyPermission(req, res, PERMS.POST_JOURNAL)) return;
  }

  if (method === 'GET') {
    if (!await verifyPermission(req, res, PERMS.VIEW_JOURNALS)) return;
  }

  if (method === 'GET') {
    const { subsidiary, limit = '100', page = '1', type } = req.query as any;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { ...getDeletedFilter(req.query) };
    if (subsidiary && subsidiary !== 'Global') {
      whereClause.subsidiary = subsidiary;
    }
    if (type) {
      whereClause.voucherType = type;
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where: whereClause,
        include: {
          lines: {
            include: { account: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.journalEntry.count({ where: whereClause })
    ]);

    const formatted = entries.map(je => ({
      id: je.voucherNo,
      dbId: je.id,
      voucherNo: je.voucherNo,
      postingDate: je.postingDate.toISOString().split('T')[0],
      subsidiary: je.subsidiary,
      reference: je.reference,
      description: je.description,
      postedBy: je.postedBy,
      status: je.status,
      voucherType: je.voucherType,
      lines: je.lines.map(line => ({
        id: line.id,
        accountCode: line.account.glCode,
        description: line.description,
        debit: line.debit,
        credit: line.credit
      }))
    }));

    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'POST') {
    const { voucherNo, postingDate, subsidiary, reference, description, status = 'Draft', lines, voucherType = 'JV' } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: { message: 'Lines are required', status: 400 } });
    }

    const isAdjustment = voucherType === 'ADJUSTMENT' || (reference && reference.toUpperCase().includes('ADJUSTMENT'));
    if (isAdjustment && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin may perform manual balance adjustment entries', status: 403 } });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const payloadLines = lines.map(l => ({
          accountCode: l.accountCode,
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || description || reference
        }));

        return await AccountingService.postTransaction(tx, {
          voucherNo: voucherNo || undefined,
          postingDate: postingDate ? new Date(postingDate) : new Date(),
          subsidiary: subsidiary || 'Global',
          reference: reference || 'Journal Entry',
          description: description || 'Journal Entry',
          module: 'Journal Entries',
          voucherType,
          postedBy: req.user?.id || 'system',
          status,
          lines: payloadLines,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });
      }, accountingTxOptions);


      return res.status(201).json({ status: 201, data: result.journalEntry });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }

  if (method === 'PATCH' || method === 'PUT') {
    const { id, status, reference, description, postingDate, amount, lines } = req.body;
    const targetId = id || req.query.id;

    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      if (!targetId) {
        return res.status(400).json({ error: { message: 'Missing journal entry id', status: 400 } });
      }
      const existing = await prisma.journalEntry.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Journal entry not found', status: 404 } });
      }
      const restored = await prisma.journalEntry.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, 'Restore Journal Entry', 'Journal Entries', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Journal entry restored successfully', data: restored });
    }

    if (!targetId) {
       return res.status(400).json({ error: { message: 'Missing journal entry id', status: 400 } });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const je = await tx.journalEntry.findUnique({
          where: { id },
          include: { lines: true }
        });

        if (!je) throw new Error('Journal entry not found');

        const isStatusChangeOnly = (status && status !== je.status && reference === undefined && description === undefined && postingDate === undefined && amount === undefined && !lines);

        if (isStatusChangeOnly) {
          if (je.status === status) return je;

          if (je.status === 'Draft' && status === 'Posted') {
            return await AccountingService.postDraft(tx, id, req.user!.id);
          }
          
          if (je.status === 'Posted' && status === 'Cancelled') {
            return await AccountingService.reverseJournalEntry(tx, id, req.user!.id, req.body.reason);
          }

          if (je.status === 'Cancelled') {
            return await AccountingService.restoreCancelledJournalEntry(tx, id, status, req.user!.id);
          }

          const updatedJe = await tx.journalEntry.update({
            where: { id },
            data: { status }
          });
          return updatedJe;
        }

        // Updating details / amount
        const newDate = postingDate ? new Date(postingDate) : je.postingDate;
        const newRef = reference !== undefined ? reference : je.reference;
        const newDesc = description !== undefined ? description : je.description;
        const newStatus = status || je.status;

        await tx.journalEntry.update({
          where: { id },
          data: {
            postingDate: newDate,
            reference: newRef,
            description: newDesc !== undefined ? (newDesc || null) : undefined,
            status: newStatus
          }
        });

        // If amount changed without custom lines array
        if (amount !== undefined && !lines && je.lines.length > 0) {
          const numAmount = Number(amount);
          if (!Number.isFinite(numAmount) || numAmount <= 0) {
            throw new Error('Accounting Engine Error: Amount must be a positive number.');
          }

          const plannedLines = je.lines.map((l: any) => ({
            debit: l.debit > 0 ? numAmount : l.debit,
            credit: l.credit > 0 ? numAmount : l.credit,
          }));
          const plannedDebit = plannedLines.reduce((sum: Prisma.Decimal, l: any) => sum.plus(new Prisma.Decimal(l.debit)), new Prisma.Decimal(0));
          const plannedCredit = plannedLines.reduce((sum: Prisma.Decimal, l: any) => sum.plus(new Prisma.Decimal(l.credit)), new Prisma.Decimal(0));
          if (!plannedDebit.equals(plannedCredit)) {
            throw new Error(`Accounting Engine Error: Transaction must follow Double Entry Accounting. Total Debit (${plannedDebit.toFixed(2)}) does not equal Total Credit (${plannedCredit.toFixed(2)}).`);
          }

          for (const l of je.lines) {
            const newDebit = l.debit > 0 ? numAmount : l.debit;
            const newCredit = l.credit > 0 ? numAmount : l.credit;
            const lineDesc = newDesc !== undefined ? newDesc : l.description;

            await tx.journalEntryLine.update({
              where: { id: l.id },
              data: {
                debit: newDebit,
                credit: newCredit,
                description: lineDesc
              }
            });
          }
        } else if (lines && Array.isArray(lines) && lines.length > 0) {
          if (lines.length < 2) {
            throw new Error('Accounting Engine Error: Transaction must contain at least two accounting lines for double-entry posting.');
          }

          let totalDebit = new Prisma.Decimal(0);
          let totalCredit = new Prisma.Decimal(0);
          for (const l of lines) {
            const debitVal = new Prisma.Decimal(l.debit ?? 0);
            const creditVal = new Prisma.Decimal(l.credit ?? 0);
            if (debitVal.isNegative() || creditVal.isNegative()) {
              throw new Error('Accounting Engine Error: Debit and Credit amounts cannot be negative.');
            }
            if (!l.accountId) {
              throw new Error('Accounting Engine Error: Every line must reference an account.');
            }
            totalDebit = totalDebit.plus(debitVal);
            totalCredit = totalCredit.plus(creditVal);
          }
          if (!totalDebit.equals(totalCredit)) {
            throw new Error(`Accounting Engine Error: Transaction must follow Double Entry Accounting. Total Debit (${totalDebit.toFixed(2)}) does not equal Total Credit (${totalCredit.toFixed(2)}).`);
          }
          if (totalDebit.lte(0)) {
            throw new Error('Accounting Engine Error: Transaction amount must be greater than zero.');
          }

          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: je.id }
          });
          for (const l of lines) {
            await tx.journalEntryLine.create({
              data: {
                journalEntryId: je.id,
                accountId: l.accountId,
                description: l.description || newDesc || newRef || je.description,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
              }
            });
          }
        }

        // If status is Posted or becoming Posted, refresh the affected account
        // balance caches. Reports read JournalEntryLine directly (single source
        // of truth), so there is no separate ledger table to rewrite here.
        if (newStatus === 'Posted' || newStatus === 'POSTED') {
          const updatedLines = await tx.journalEntryLine.findMany({ where: { journalEntryId: je.id } });
          for (const l of updatedLines) {
            await AccountingService.recalculateAccountBalance(tx, l.accountId);
          }
        }

        return await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
      }, accountingTxOptions);

      await logAudit(req.user.id, 'Update Journal Entry', 'Journal Entries', null, { id, status, reference, amount }, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


      return res.status(200).json({ status: 200, data: result });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }

  if (method === 'DELETE') {
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can permanently delete records', status: 403 } });
    }

    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Journal Entry ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: { message: 'No valid ID provided', status: 400 } });
    }

    try {
      const deletedEntries = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const id of ids) {
          if (isPermanent) {
            const resJe = await AccountingService.deleteJournalEntry(tx, id, req.user!.id, 'Admin Permanently Deleted');
            if (resJe) results.push(resJe);
          } else {
            const resJe = await tx.journalEntry.update({
              where: { id },
              data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
            });
            if (resJe) results.push(resJe);
          }
        }
        return results;
      }, accountingTxOptions);

      await logAudit(
        req.user.id,
        'Delete Journal Entry',
        'Journal Entries',
        null,
        { count: deletedEntries.length, ids: deletedEntries.map(e => e.id) },
        req.headers['x-forwarded-for'] as string,
        req.headers['user-agent']
      );


      return res.status(200).json({
        status: 200,
        message: `${deletedEntries.length} journal entry(s) deleted successfully`,
        data: deletedEntries
      });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
