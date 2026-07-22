import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';
import { validateAmount } from '../_utils/amount.js';
import { isWithinMaxLength, maxLengthError } from '../_utils/text-length.js';

function isUniqueViolation(err: any): boolean {
  return err?.code === 'P2002';
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;

  if (method === 'GET') {
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const donationType = req.query.donationType as string;
    const paymentMethod = req.query.paymentMethod as string;
    const donorId = req.query.donorId as string;

    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (donationType) whereClause.donationType = donationType;
    if (paymentMethod) whereClause.paymentMethod = paymentMethod;
    if (donorId) whereClause.donorId = donorId;
    if (search) {
      whereClause.OR = [
        { receiptNo: { contains: search, mode: 'insensitive' } },
        { referenceNo: { contains: search, mode: 'insensitive' } },
        { chequeNo: { contains: search, mode: 'insensitive' } },
        { narration: { contains: search, mode: 'insensitive' } },
        { customDonationType: { contains: search, mode: 'insensitive' } },
        { donor: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

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

    // Calculate stats across ALL pages for the current filter
    const [totalAgg, cashAgg] = await Promise.all([
      prisma.donationReceived.aggregate({
        where: { ...whereClause, status: 'POSTED' },
        _sum: { amount: true }
      }),
      prisma.donationReceived.aggregate({
        where: { ...whereClause, status: 'POSTED', paymentMethod: 'CASH' },
        _sum: { amount: true }
      })
    ]);

    const totalAmount = totalAgg._sum.amount || 0;
    const cashAmount = cashAgg._sum.amount || 0;
    const bankAmount = totalAmount - cashAmount;

    return res.status(200).json({
      status: 200,
      data: donations,
      meta: { total, page: pageNum, limit: limitNum },
      stats: {
        totalAmount,
        cashAmount,
        bankAmount,
        totalReceipts: total,
      }
    });
  }

  if (method === 'POST') {
    const {
      receiptDate,
      donorId,
      donationType,
      customDonationType,
      amount,
      paymentMethod,
      cashAccountId,
      bankAccountId,
      chequeNo,
      chequeDate,
      referenceNo,
      narration,
      status
    } = req.body;

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

    // SQA fix: receiptNo previously derived from `count()`, read outside any
    // transaction — two concurrent submissions can read the same count before
    // either commits, generating the same number. The second create() then
    // throws an unhandled unique-constraint error. Generation now uses the
    // max existing numeric suffix (not count, so a deleted receipt can't cause
    // number reuse) and the whole transaction retries on a rare collision.
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
            const postingResult = await AccountingService.postReceipt(tx, {
              amount: parsedAmount,
              cashOrBankAccountId: debitAccountId!,
              incomeAccountKeyword: donationType === 'CUSTOM' ? 'General Donation' : donationType,
              reference: receiptNo,
              description: narration || `Received ${donationType === 'CUSTOM' ? customDonationType : donationType} from ${donor.fullName} (${donor.donorCode})`,
              module: 'Donations Received',
              postedBy: req.user!.id,
              postingDate: receiptDate || new Date(),
              ipAddress: req.headers['x-forwarded-for'] as string,
              userAgent: req.headers['user-agent'] as string,
              voucherType: 'BR'
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
    if (!id) return res.status(400).json({ error: { message: 'Receipt ID is required', status: 400 } });

    const existing = await prisma.donationReceived.findUnique({
      where: { id },
      include: { donor: true }
    });
    if (!existing) return res.status(404).json({ error: { message: 'Donation receipt not found', status: 404 } });

    const { status, narration, referenceNo, chequeNo, chequeDate, amount, donorId, donationType, customDonationType, paymentMethod, receiptDate, cashAccountId, bankAccountId } = req.body;

    const finalDonationType = donationType !== undefined ? donationType : existing.donationType;
    const finalCustomType = customDonationType !== undefined ? customDonationType : existing.customDonationType;
    if (finalDonationType === 'CUSTOM' && (!finalCustomType || !finalCustomType.trim())) {
      return res.status(400).json({ error: { message: 'Custom Donation Type is required when CUSTOM is selected', status: 400 } });
    }

    if (!isWithinMaxLength(narration, 1000)) return res.status(400).json({ error: maxLengthError('Narration', 1000) });
    if (!isWithinMaxLength(referenceNo, 100)) return res.status(400).json({ error: maxLengthError('Reference number', 100) });
    if (!isWithinMaxLength(chequeNo, 30)) return res.status(400).json({ error: maxLengthError('Cheque number', 30) });

    // SQA fix: previously `parseFloat(amount)`/`Number(amount)` with no
    // isNaN/upper-bound check, both here and in the update payload below.
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

          const postingResult = await AccountingService.postReceipt(tx, {
            amount: updatedAmount,
            cashOrBankAccountId: debitAccountId,
            incomeAccountKeyword: updatedType === 'CUSTOM' ? 'General Donation' : updatedType,
            reference: existing.receiptNo,
            description: updatedNarration || `Received ${updatedType === 'CUSTOM' ? updatedCustomType : updatedType} from ${existing.donor.fullName}`,
            module: 'Donations Received',
            postedBy: req.user!.id,
            postingDate: updatedDate,
            ipAddress: req.headers['x-forwarded-for'] as string,
            userAgent: req.headers['user-agent'] as string,
            voucherType: 'BR'
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
        where: { id },
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
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
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
            await AccountingService.deleteJournalEntry(tx, item.journalEntryId, req.user!.id, 'Donation Receipt Deleted');
          } catch (e) {
            // Ignore
          }
        }
        await tx.donationReceived.delete({ where: { id: item.id } });
      }
    });

    for (const item of existingItems) {
      await logAudit(req.user.id, 'Delete Donation Received', 'DONATION_RECEIVED', item, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
    }

    return res.status(200).json({ status: 200, message: `${existingItems.length} donation receipt(s) deleted successfully` });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
