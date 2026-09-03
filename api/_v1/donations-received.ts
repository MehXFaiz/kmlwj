import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { enforceRestrictedRolePolicy } from '../_middlewares/rbac.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';
import { validateAmount } from '../_utils/amount.js';
import { isWithinMaxLength, maxLengthError } from '../_utils/text-length.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from '../_utils/soft-delete.js';

function donationTitleFragment(donationType: string, customType?: string | null): string {
  const map: Record<string, string> = {
    ZAKAT: 'Zakat',
    FITRA: 'Fitra',
    SADQA: 'Sadqa',
    QURBANI: 'Qurbani',
    GENERAL_DONATION: 'General Donation',
    HALL_DONATION: 'Hall Donation',
    MARRIAGE_DONATION: 'Marriage Donation',
    BUILDING_FUND: 'Building Fund',
    MEDICAL_DONATION: 'Medical Donation',
    EDUCATION_DONATION: 'Education Donation',
    MONTHLY: 'Monthly Donation',
    MARRIAGE: 'Marriage',
    MEDICAL: 'Medical',
    EMERGENCY: 'Emergency',
    EDUCATION: 'Education',
    CUSTOM: customType || 'Custom',
  };
  return map[donationType] || 'Donation';
}

function isUniqueViolation(err: any): boolean {
  return err?.code === 'P2002';
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  // RBAC: PUT/PATCH/DELETE always blocked for non-privileged roles
  if (!await enforceRestrictedRolePolicy(req, res)) return;

  const { method } = req;
  const id = (req.params?.id || req.query.id || req.body?.id) as string;
  const action = (req.query.action || req.body?.action) as string;

  if (method === 'GET') {
    if (!await verifyPermission(req, res, [PERMS.VIEW_DONATIONS_RECEIVED, 'donations.view'])) return;

    // Single record lookup by ID (e.g. GET /api/donations/:id or GET /api/donations?id=...)
    if (id && action !== 'check-duplicate') {
      const singleDonation = await prisma.donationReceived.findFirst({
        where: { id, isDeleted: false },
        include: {
          donor: true,
          cashAccount: true,
          bankAccount: true,
          journalEntry: true,
          createdBy: { select: { id: true, fullName: true, email: true } }
        }
      });

      if (!singleDonation) {
        return res.status(404).json({ error: { message: 'Donation record not found', status: 404 } });
      }

      return res.status(200).json({ status: 200, data: singleDonation });
    }

    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const donationType = req.query.donationType as string;
    const paymentMethod = req.query.paymentMethod as string;
    const donorId = req.query.donorId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const date = req.query.date as string;

    const whereClause: any = { ...getDeletedFilter(req.query) };
    if (status && status !== 'ALL') whereClause.status = status;
    if (donationType && donationType !== 'ALL') whereClause.donationType = donationType;
    if (paymentMethod && paymentMethod !== 'ALL') whereClause.paymentMethod = paymentMethod;
    if (donorId && donorId !== 'ALL') whereClause.donorId = donorId;

    if (startDate || endDate) {
      whereClause.receiptDate = {};
      if (startDate) whereClause.receiptDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.receiptDate.lte = end;
      }
    } else if (date) {
      const d = new Date(date);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      whereClause.receiptDate = { gte: start, lte: end };
    }

    if (search) {
      whereClause.OR = [
        { receiptNo: { contains: search, mode: 'insensitive' } },
        { referenceNo: { contains: search, mode: 'insensitive' } },
        { chequeNo: { contains: search, mode: 'insensitive' } },
        { narration: { contains: search, mode: 'insensitive' } },
        { customDonationType: { contains: search, mode: 'insensitive' } },
        { donor: { fullName: { contains: search, mode: 'insensitive' } } },
        { donor: { mobile: { contains: search, mode: 'insensitive' } } },
        { donor: { donorCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const currentYear = new Date().getFullYear();
    const currentMonthIdx = new Date().getMonth();
    const startOfMonth = new Date(currentYear, currentMonthIdx, 1);
    const endOfMonth = new Date(currentYear, currentMonthIdx + 1, 1);

    const [donations, total] = await Promise.all([
      prisma.donationReceived.findMany({
        where: whereClause,
        include: {
          donor: true,
          cashAccount: true,
          bankAccount: true,
          journalEntry: true,
          createdBy: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { receiptDate: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.donationReceived.count({ where: whereClause })
    ]);

    const [totalAgg, cashAgg, bankAgg, chequeAgg, monthAgg] = await Promise.all([
      prisma.donationReceived.aggregate({
        where: { ...whereClause, status: 'POSTED' },
        _sum: { amount: true }
      }),
      prisma.donationReceived.aggregate({
        where: { ...whereClause, status: 'POSTED', paymentMethod: 'CASH' },
        _sum: { amount: true }
      }),
      prisma.donationReceived.aggregate({
        where: { ...whereClause, status: 'POSTED', paymentMethod: { in: ['BANK', 'ONLINE'] } },
        _sum: { amount: true }
      }),
      prisma.donationReceived.aggregate({
        where: { ...whereClause, status: 'POSTED', paymentMethod: 'CHEQUE' },
        _sum: { amount: true }
      }),
      prisma.donationReceived.aggregate({
        where: {
          ...whereClause,
          status: 'POSTED',
          receiptDate: { gte: startOfMonth, lt: endOfMonth }
        },
        _sum: { amount: true }
      })
    ]);

    const totalAmount = totalAgg._sum.amount || 0;
    const cashAmount = cashAgg._sum.amount || 0;
    const bankAmount = bankAgg._sum.amount || 0;
    const chequeAmount = chequeAgg._sum.amount || 0;
    const currentMonthAmount = monthAgg._sum.amount || 0;

    return res.status(200).json({
      status: 200,
      data: donations,
      meta: { total, page: pageNum, limit: limitNum },
      stats: {
        totalAmount,
        cashAmount,
        bankAmount,
        chequeAmount,
        currentMonthAmount,
        totalReceipts: total,
      }
    });
  }

  if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: 'Receipt ID is required', status: 400 } });
      }
      const existing = await prisma.donationReceived.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Donation receipt not found', status: 404 } });
      }
      const restored = await prisma.donationReceived.update({
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
      await logAudit(req.user.id, 'Restore Donation Received', 'DONATION_RECEIVED', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Donation receipt restored successfully', data: restored });
    }
  }

  if (method === 'POST') {
    if (!await verifyPermission(req, res, [PERMS.CREATE_DONATION_RECEIVED, 'donations.create'])) return;

    const {
      receiptDate: rawReceiptDate,
      donationDate: rawDonationDate,
      donorId,
      donationType,
      customDonationType,
      amount,
      paymentMethod,
      cashAccountId,
      bankAccountId,
      chequeNo: rawChequeNo,
      chequeNumber: rawChequeNumber,
      chequeDate,
      referenceNo: rawReferenceNo,
      referenceNumber: rawReferenceNumber,
      narration: rawNarration,
      notes: rawNotes,
      status
    } = req.body;

    const receiptDate = rawReceiptDate || rawDonationDate || new Date();
    const chequeNo = rawChequeNo || rawChequeNumber || null;
    const referenceNo = rawReferenceNo || rawReferenceNumber || null;
    const narration = rawNarration || rawNotes || null;

    if (!donorId || !donationType || amount === undefined || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields (donorId, donationType, amount, paymentMethod)', status: 400 } });
    }

    if (donationType === 'CUSTOM' && (!customDonationType || !customDonationType.trim())) {
      return res.status(400).json({ error: { message: 'Custom Donation Type is required when CUSTOM is selected', status: 400 } });
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }

    if (!isWithinMaxLength(narration, 1000)) return res.status(400).json({ error: maxLengthError('Narration', 1000) });
    if (!isWithinMaxLength(referenceNo, 100)) return res.status(400).json({ error: maxLengthError('Reference number', 100) });
    if (!isWithinMaxLength(chequeNo, 30)) return res.status(400).json({ error: maxLengthError('Cheque number', 30) });
    const parsedAmount = amountCheck.amount;

    const donor = await prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      return res.status(404).json({ error: { message: 'Selected donor not found', status: 404 } });
    }

    let debitAccountId = null;
    if (paymentMethod === 'CASH') {
      const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
      debitAccountId = cashAccount.id;
    } else {
      if (!bankAccountId) {
        const defaultBank = await prisma.account.findFirst({
          where: {
            accountName: { contains: 'Bank', mode: 'insensitive' },
            children: { none: {} },
            isLocked: false
          },
          orderBy: { glCode: 'asc' }
        });
        if (!defaultBank) return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque/Online payments', status: 400 } });
        debitAccountId = defaultBank.id;
      } else {
        debitAccountId = bankAccountId;
      }
    }

    const year = new Date().getFullYear();
    const receiptPrefix = `REC-${year}-`;

    async function nextReceiptNo(tx: any): Promise<string> {
      const existing = await tx.donationReceived.findMany({
        where: { receiptNo: { startsWith: receiptPrefix } },
        select: { receiptNo: true },
      });
      const maxNum = existing.reduce((max: number, r: { receiptNo: string }) => {
        const n = parseInt(r.receiptNo.slice(receiptPrefix.length), 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
      return `${receiptPrefix}${String(maxNum + 1).padStart(4, '0')}`;
    }

    const txStatus = status === 'POSTED' ? 'POSTED' : 'DRAFT';

    let result: any;
    for (let attempt = 1; ; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const receiptNo = await nextReceiptNo(tx);
          let journalEntryId: string | null = null;

          if (txStatus === 'POSTED') {
            const isGeneralDonation = donationType === 'CUSTOM' || donationType === 'GENERAL_DONATION' || donationType === 'DONATION';
            const generalDonationAccount = isGeneralDonation
              ? await AccountingService.ensureGeneralDonationAccount(tx)
              : null;
            const postingResult = await AccountingService.postReceipt(tx, {
              amount: parsedAmount,
              cashOrBankAccountId: debitAccountId!,
              incomeAccountId: generalDonationAccount ? generalDonationAccount.id : undefined,
              incomeAccountKeyword: generalDonationAccount ? undefined : donationType,
              reference: `DONATION-${receiptNo}`,
              description: narration || `Received ${donationType === 'CUSTOM' ? customDonationType : donationType} from ${donor.fullName} (${donor.donorCode})`,
              module: 'Donations Received',
              postedBy: req.user!.id,
              postingDate: receiptDate ? new Date(receiptDate) : new Date(),
              ipAddress: req.headers['x-forwarded-for'] as string,
              userAgent: req.headers['user-agent'] as string,
              voucherType: paymentMethod === 'CASH' ? 'CR' : 'BR'
            });
            if (postingResult && postingResult.journalEntry) {
              journalEntryId = postingResult.journalEntry.id;
            }
          }

          const newReceipt = await tx.donationReceived.create({
            data: {
              receiptNo,
              receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
              donorId,
              donationType,
              customDonationType: donationType === 'CUSTOM' ? customDonationType : null,
              amount: parsedAmount,
              paymentMethod,
              cashAccountId: paymentMethod === 'CASH' ? debitAccountId : null,
              bankAccountId: paymentMethod !== 'CASH' ? debitAccountId : null,
              chequeNo: chequeNo || null,
              chequeDate: chequeDate ? new Date(chequeDate) : null,
              referenceNo: referenceNo || null,
              narration: narration || null,
              journalEntryId,
              status: txStatus,
              createdById: req.user!.id
            },
            include: {
              donor: true,
              cashAccount: true,
              bankAccount: true,
              journalEntry: true
            }
          });

          return newReceipt;
        });
        break;
      } catch (err: any) {
        if (isUniqueViolation(err) && attempt < 5 &&
            (err.meta?.target as string[] | undefined)?.includes('receiptNo')) {
          continue;
        }
        throw err;
      }
    }

    await logAudit(req.user.id, 'Create Donation Received', 'DONATION_RECEIVED', null, result, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: result });
  }

  if (method === 'PUT' || method === 'PATCH') {
    if (!await verifyPermission(req, res, [PERMS.RECORD_INCOME, 'donations.update'])) return;
    const targetId = id || req.query.id || req.body?.id;
    if (!targetId) return res.status(400).json({ error: { message: 'Receipt ID is required', status: 400 } });

    const existing = await prisma.donationReceived.findUnique({
      where: { id: targetId },
      include: { donor: true }
    });
    if (!existing) return res.status(404).json({ error: { message: 'Donation receipt not found', status: 404 } });

    const {
      status,
      narration: rawNarration,
      notes: rawNotes,
      referenceNo: rawReferenceNo,
      referenceNumber: rawReferenceNumber,
      chequeNo: rawChequeNo,
      chequeNumber: rawChequeNumber,
      chequeDate,
      amount,
      donorId,
      donationType,
      customDonationType,
      paymentMethod,
      receiptDate: rawReceiptDate,
      donationDate: rawDonationDate,
      cashAccountId,
      bankAccountId
    } = req.body;

    const narration = rawNarration !== undefined ? rawNarration : rawNotes;
    const referenceNo = rawReferenceNo !== undefined ? rawReferenceNo : rawReferenceNumber;
    const chequeNo = rawChequeNo !== undefined ? rawChequeNo : rawChequeNumber;
    const receiptDate = rawReceiptDate !== undefined ? rawReceiptDate : rawDonationDate;

    const finalDonationType = donationType !== undefined ? donationType : existing.donationType;
    const finalCustomType = customDonationType !== undefined ? customDonationType : existing.customDonationType;
    if (finalDonationType === 'CUSTOM' && (!finalCustomType || !finalCustomType.trim())) {
      return res.status(400).json({ error: { message: 'Custom Donation Type is required when CUSTOM is selected', status: 400 } });
    }

    if (!isWithinMaxLength(narration, 1000)) return res.status(400).json({ error: maxLengthError('Narration', 1000) });
    if (!isWithinMaxLength(referenceNo, 100)) return res.status(400).json({ error: maxLengthError('Reference number', 100) });
    if (!isWithinMaxLength(chequeNo, 30)) return res.status(400).json({ error: maxLengthError('Cheque number', 30) });

    let parsedAmount: number | undefined;
    if (amount !== undefined) {
      const amountCheck = validateAmount(amount);
      if (!amountCheck.valid) {
        return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
      }
      parsedAmount = amountCheck.amount;
    }

    const result = await prisma.$transaction(async (tx) => {
      let journalEntryId = existing.journalEntryId;
      let newStatus = status !== undefined ? status : existing.status;

      // If changing to or remaining POSTED when edited
      if (newStatus === 'POSTED') {
        if (existing.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, 'Donation Receipt Updated');
          } catch (e) {}
        }

        let debitAccountId: string | null = null;
        const currentMethod = paymentMethod !== undefined ? paymentMethod : existing.paymentMethod;
        if (currentMethod === 'CASH') {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          debitAccountId = cashAccount.id;
        } else {
          debitAccountId = bankAccountId !== undefined ? bankAccountId : (existing.bankAccountId || existing.cashAccountId);
        }

        if (debitAccountId) {
          const updatedAmount = parsedAmount !== undefined ? parsedAmount : existing.amount;
          const updatedType = donationType !== undefined ? donationType : existing.donationType;
          const updatedCustomType = customDonationType !== undefined ? customDonationType : existing.customDonationType;
          const updatedNarration = narration !== undefined ? narration : existing.narration;
          const updatedDate = receiptDate !== undefined ? new Date(receiptDate) : existing.receiptDate;

          const isGeneralDonation = updatedType === 'CUSTOM' || updatedType === 'GENERAL_DONATION' || updatedType === 'DONATION';
          const generalDonationAccount = isGeneralDonation
            ? await AccountingService.ensureGeneralDonationAccount(tx)
            : null;
          const postingResult = await AccountingService.postReceipt(tx, {
            amount: updatedAmount,
            cashOrBankAccountId: debitAccountId,
            incomeAccountId: generalDonationAccount ? generalDonationAccount.id : undefined,
            incomeAccountKeyword: generalDonationAccount ? undefined : updatedType,
            reference: `DONATION-${existing.receiptNo}`,
            description: updatedNarration || `Received ${updatedType === 'CUSTOM' ? updatedCustomType : updatedType} from ${existing.donor.fullName}`,
            module: 'Donations Received',
            postedBy: req.user!.id,
            postingDate: updatedDate,
            ipAddress: req.headers['x-forwarded-for'] as string,
            userAgent: req.headers['user-agent'] as string,
            voucherType: currentMethod === 'CASH' ? 'CR' : 'BR'
          });
          if (postingResult && postingResult.journalEntry) {
            journalEntryId = postingResult.journalEntry.id;
          }
        }
      } 
      // If changing from POSTED to another status (DRAFT/CANCELLED)
      else if (existing.status === 'POSTED' && newStatus !== 'POSTED') {
        if (existing.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, `Donation Receipt status changed to ${newStatus}`);
            journalEntryId = null;
          } catch (e) {}
        }
      }

      const updated = await tx.donationReceived.update({
        where: { id: targetId },
        data: {
          status: newStatus,
          journalEntryId,
          narration: narration !== undefined ? (narration || null) : undefined,
          referenceNo: referenceNo !== undefined ? (referenceNo || null) : undefined,
          chequeNo: chequeNo !== undefined ? (chequeNo || null) : undefined,
          chequeDate: chequeDate !== undefined ? (chequeDate ? new Date(chequeDate) : null) : undefined,
          amount: parsedAmount !== undefined ? parsedAmount : undefined,
          donorId: donorId !== undefined ? donorId : undefined,
          donationType: donationType !== undefined ? donationType : undefined,
          customDonationType: donationType !== undefined
            ? (donationType === 'CUSTOM' ? customDonationType : null)
            : (customDonationType !== undefined ? (existing.donationType === 'CUSTOM' ? customDonationType : null) : undefined),
          paymentMethod: paymentMethod !== undefined ? paymentMethod : undefined,
          receiptDate: receiptDate !== undefined ? (receiptDate ? new Date(receiptDate) : undefined) : undefined,
          cashAccountId: cashAccountId !== undefined ? (cashAccountId || null) : undefined,
          bankAccountId: bankAccountId !== undefined ? (bankAccountId || null) : undefined,
        },
        include: {
          donor: true,
          cashAccount: true,
          bankAccount: true,
          journalEntry: true
        }
      });

      return updated;
    });

    await logAudit(req.user.id, 'Update Donation Received', 'DONATION_RECEIVED', existing, result, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(200).json({ status: 200, data: result });
  }

  if (method === 'DELETE') {
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Admin or Super Admin can permanently delete records', status: 403 } });
    }

    if (!await verifyPermission(req, res, [PERMS.RECORD_INCOME, 'donations.delete'])) return;

    const idsRaw = req.params?.id || req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Receipt ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: { message: 'No valid ID provided', status: 400 } });
    }

    const existingItems = await prisma.donationReceived.findMany({ where: { id: { in: ids } } });
    if (existingItems.length === 0) {
      return res.status(404).json({ error: { message: 'Donation receipt(s) not found', status: 404 } });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of existingItems) {
        if (item.journalEntryId) {
          try {
            if (isPermanent) {
              await AccountingService.deleteJournalEntry(tx, item.journalEntryId, req.user!.id, 'Donation Receipt Permanently Deleted');
            } else {
              await tx.journalEntry.update({
                where: { id: item.journalEntryId },
                data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
              });
              await AccountingService.recalculateBalancesForJournalEntry(tx, item.journalEntryId);
            }
          } catch (e) {
            // Ignore
          }
        }
        if (isPermanent) {
          await tx.donationReceived.delete({ where: { id: item.id } });
        } else {
          await tx.donationReceived.update({
            where: { id: item.id },
            data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
          });
        }
      }
    });

    for (const item of existingItems) {
      await logAudit(req.user.id, isPermanent ? 'Permanent Delete Donation Received' : 'Soft Delete Donation Received', 'DONATION_RECEIVED', item, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
    }


    return res.status(200).json({ status: 200, message: `${existingItems.length} donation receipt(s) deleted successfully` });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
