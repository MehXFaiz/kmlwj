import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { enforceRestrictedRolePolicy } from '../_middlewares/rbac.middleware.js';
import { checkPermission } from '../_services/permission.service.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';
import { FundValidationService } from '../_services/fund-validation.service.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, getDeletedFilter } from '../_utils/soft-delete.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  // RBAC: PUT/PATCH/DELETE always blocked for non-privileged roles
  if (!await enforceRestrictedRolePolicy(req, res)) return;

  const { method } = req;
  const action = (req.query.action || req.body?.action) as string;

  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const hasMutatePerm =
      await isSuperAdmin(req) ||
      await checkPermission(req, PERMS.POST_JOURNAL) ||
      await checkPermission(req, PERMS.RECORD_EXPENSE) ||
      await checkPermission(req, PERMS.RECORD_INCOME);

    if (!hasMutatePerm) {
      return res.status(403).json({ error: { message: "Forbidden: Permission required to create or modify journal entries", status: 403 } });
    }
  }

  if (method === 'GET') {
    const hasViewPerm =
      await isSuperAdmin(req) ||
      await checkPermission(req, PERMS.VIEW_JOURNALS) ||
      await checkPermission(req, PERMS.POST_JOURNAL) ||
      await checkPermission(req, PERMS.RECORD_EXPENSE) ||
      await checkPermission(req, PERMS.RECORD_INCOME) ||
      await checkPermission(req, PERMS.VIEW_REPORTS);

    if (!hasViewPerm) {
      return res.status(403).json({ error: { message: "Forbidden: Permission required to view journal entries", status: 403 } });
    }
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
      // Support comma-separated types (e.g. "BP,CP") so the Bank Vouchers page
      // can fetch both bank payments and cash payments in a single request.
      const types = String(type).split(',').map((t: string) => t.trim()).filter(Boolean);
      whereClause.voucherType = types.length === 1 ? types[0] : { in: types };
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where: whereClause,
        include: {
          lines: {
            include: { account: true }
          },
          donationReceived: {
            include: { donor: true }
          },
          zakatCard: {
            include: { member: true, beneficiary: true }
          },
          revenueCollection: true,
          addIncomeRecord: {
            include: { category: true }
          },
          pettyCashTransaction: {
            include: { pettyCashAccount: true, expenseHead: true }
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
      donationReceived: (je as any).donationReceived,
      zakatCard: (je as any).zakatCard,
      revenueCollection: (je as any).revenueCollection,
      addIncomeRecord: (je as any).addIncomeRecord,
      pettyCashTransaction: (je as any).pettyCashTransaction,
      lines: je.lines.map(line => ({
        id: line.id,
        accountCode: line.account.glCode,
        accountName: line.account.accountName,
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
      const existing = await prisma.journalEntry.findUnique({ where: { id: targetId }, include: { lines: true } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Journal entry not found', status: 404 } });
      }
      // Un-delete and rebuild the affected balance caches atomically: the entry
      // re-enters POSTED_JOURNAL_FILTER here, so its impact must come back into
      // Account.currentBalance in the same commit or the cache is left short.
      const restored = await prisma.$transaction(async (tx) => {
        // A previously-Posted entry contributed nothing to the ledger while
        // soft-deleted; restoring it is a fresh draw on whatever it credits,
        // and the account it draws from may have moved on in the meantime —
        // validate before letting it re-enter POSTED_JOURNAL_FILTER.
        if (existing.status === 'Posted') {
          const creditByAccount = new Map<string, Prisma.Decimal>();
          for (const l of existing.lines) {
            const credit = new Prisma.Decimal(l.credit ?? 0);
            if (credit.greaterThan(0)) {
              creditByAccount.set(l.accountId, (creditByAccount.get(l.accountId) ?? new Prisma.Decimal(0)).plus(credit));
            }
          }
          for (const [accountId, requiredAmount] of creditByAccount) {
            await FundValidationService.validateAndLockFunds(tx, {
              accountId,
              requiredAmount: requiredAmount.toNumber(),
              module: 'Journal Entries (Restore)',
              userId: req.user!.id,
              ipAddress: req.headers['x-forwarded-for'] as string,
              userAgent: req.headers['user-agent'],
            });
          }
        }

        const je = await tx.journalEntry.update({
          where: { id: targetId },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        });
        await AccountingService.recalculateBalancesForJournalEntry(tx, targetId);
        return je;
      }, accountingTxOptions);
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

        // Captured before any line rewrite so an account that this edit removes
        // from the entry still has its cached balance corrected below.
        const accountsBefore: string[] = je.lines.map((l: any) => l.accountId);

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
          // Any status transition can move this entry into or out of
          // POSTED_JOURNAL_FILTER (e.g. Posted -> Draft un-posts it), so the
          // affected balance caches have to be rebuilt either way.
          await AccountingService.recalculateBalancesForJournalEntry(tx, id);
          return updatedJe;
        }

        // Updating details / amount
        const newDate = postingDate ? new Date(postingDate) : je.postingDate;
        const newRef = reference !== undefined ? reference : je.reference;
        const newDesc = description !== undefined ? description : je.description;
        const newStatus = status || je.status;

        // Plan the line rewrite (if any) WITHOUT writing yet, so available
        // funds can be validated against the pre-edit state before anything
        // is mutated — mirroring the validate-then-write order postDraft/
        // restoreCancelledJournalEntry already use. The journalEntry.update
        // below (including the status flip) is deferred past the fund check
        // too: it runs on the same `tx`, so writing it first would already be
        // visible to FundValidationService's balance query and corrupt the
        // "was this entry already Posted" comparison the delta math relies on.
        type PlannedLine = { id?: string; accountId: string; debit: number; credit: number; description?: string | null };
        let plannedLines: PlannedLine[] | null = null;
        let mode: 'amount' | 'lines' | null = null;

        if (amount !== undefined && !lines && je.lines.length > 0) {
          mode = 'amount';
          const numAmount = Number(amount);
          if (!Number.isFinite(numAmount) || numAmount <= 0) {
            throw new Error('Accounting Engine Error: Amount must be a positive number.');
          }

          plannedLines = je.lines.map((l: any) => ({
            id: l.id,
            accountId: l.accountId,
            // l.debit/l.credit are Prisma Decimals; compare with Decimal ops
            // rather than JS `>` so the check is exact.
            debit: new Prisma.Decimal(l.debit).gt(0) ? numAmount : Number(l.debit),
            credit: new Prisma.Decimal(l.credit).gt(0) ? numAmount : Number(l.credit),
            description: newDesc !== undefined ? newDesc : l.description,
          }));
          const plannedDebit = plannedLines.reduce((sum: Prisma.Decimal, l) => sum.plus(new Prisma.Decimal(l.debit)), new Prisma.Decimal(0));
          const plannedCredit = plannedLines.reduce((sum: Prisma.Decimal, l) => sum.plus(new Prisma.Decimal(l.credit)), new Prisma.Decimal(0));
          if (!plannedDebit.equals(plannedCredit)) {
            throw new Error(`Accounting Engine Error: Transaction must follow Double Entry Accounting. Total Debit (${plannedDebit.toFixed(2)}) does not equal Total Credit (${plannedCredit.toFixed(2)}).`);
          }
        } else if (lines && Array.isArray(lines) && lines.length > 0) {
          mode = 'lines';
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

          plannedLines = lines.map((l: any) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || newDesc || newRef || je.description,
          }));
        }

        // Validate available funds BEFORE writing anything, using the
        // pre-edit `je.status`/`je.lines` (still the current DB state at this
        // point, since nothing above has written yet). Only the INCREASE in
        // credit to an account matters — a decrease only frees balance, and a
        // Draft entry's own lines don't count toward the posted ledger yet,
        // so its prior contribution is 0. FundValidationService itself
        // no-ops for non-Asset accounts, so this only ever blocks a genuine
        // Cash/Bank overdraft.
        if (plannedLines && newStatus === 'Posted') {
          const oldCreditByAccount = new Map<string, Prisma.Decimal>();
          if (je.status === 'Posted') {
            for (const l of je.lines) {
              const credit = new Prisma.Decimal(l.credit ?? 0);
              if (credit.greaterThan(0)) {
                oldCreditByAccount.set(l.accountId, (oldCreditByAccount.get(l.accountId) ?? new Prisma.Decimal(0)).plus(credit));
              }
            }
          }

          const newCreditByAccount = new Map<string, Prisma.Decimal>();
          for (const l of plannedLines) {
            const credit = new Prisma.Decimal(l.credit ?? 0);
            if (credit.greaterThan(0)) {
              newCreditByAccount.set(l.accountId, (newCreditByAccount.get(l.accountId) ?? new Prisma.Decimal(0)).plus(credit));
            }
          }

          for (const [accountId, newCredit] of newCreditByAccount) {
            const delta = newCredit.minus(oldCreditByAccount.get(accountId) ?? new Prisma.Decimal(0));
            if (delta.greaterThan(0)) {
              await FundValidationService.validateAndLockFunds(tx, {
                accountId,
                requiredAmount: delta.toNumber(),
                module: 'Journal Entries',
                userId: req.user!.id,
                ipAddress: req.headers['x-forwarded-for'] as string,
                userAgent: req.headers['user-agent'],
              });
            }
          }
        }

        // Only after every check above passes: write the metadata/status
        // change and, if planned, rewrite the lines.
        await tx.journalEntry.update({
          where: { id },
          data: {
            postingDate: newDate,
            reference: newRef,
            description: newDesc !== undefined ? (newDesc || null) : undefined,
            status: newStatus
          }
        });

        if (mode === 'amount' && plannedLines) {
          for (const l of plannedLines) {
            await tx.journalEntryLine.update({
              where: { id: l.id },
              data: { debit: l.debit, credit: l.credit, description: l.description }
            });
          }
        } else if (mode === 'lines' && plannedLines) {
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: je.id }
          });
          for (const l of plannedLines) {
            await tx.journalEntryLine.create({
              data: {
                journalEntryId: je.id,
                accountId: l.accountId,
                description: l.description,
                debit: l.debit,
                credit: l.credit,
              }
            });
          }
        }

        // Refresh the affected balance caches on EVERY edit, not only when the
        // entry ends up Posted. An edit that un-posts an entry, or that rewrites
        // its lines, changes what the ledger says just as much as one that posts
        // it — skipping the recalc in those cases left the cache holding the old
        // amounts. Reports read JournalEntryLine directly (single source of
        // truth), so there is no separate ledger table to rewrite here.
        //
        // Accounts that the edit removed from the entry are recalculated too:
        // `accountsBefore` is captured ahead of the line rewrite so an account
        // dropped from the entry still gets its cache corrected.
        for (const accountId of new Set([...accountsBefore, ...(await tx.journalEntryLine.findMany({
          where: { journalEntryId: je.id }, select: { accountId: true }
        })).map((l: any) => l.accountId)])) {
          await AccountingService.recalculateAccountBalance(tx, accountId as string);
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
            // Soft delete removes the entry from POSTED_JOURNAL_FILTER, so the
            // cached balances of every account it touched must be rebuilt. This
            // omission was the primary source of CACHED_BALANCE_DRIFT: the
            // ledger dropped the posting while the cache kept it forever.
            await AccountingService.recalculateBalancesForJournalEntry(tx, id);
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
