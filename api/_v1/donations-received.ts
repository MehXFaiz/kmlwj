import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';

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
        { donor: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const donations = await prisma.donationReceived.findMany({
      where: whereClause,
      include: {
        donor: true,
        cashAccount: true,
        bankAccount: true,
        journalEntry: true,
        createdBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { receiptDate: 'desc' },
    });

    // Calculate stats
    const totalAmount = donations.filter(d => d.status === 'POSTED').reduce((sum, d) => sum + (d.amount || 0), 0);
    const cashAmount = donations.filter(d => d.status === 'POSTED' && d.paymentMethod === 'CASH').reduce((sum, d) => sum + (d.amount || 0), 0);
    const bankAmount = donations.filter(d => d.status === 'POSTED' && d.paymentMethod !== 'CASH').reduce((sum, d) => sum + (d.amount || 0), 0);

    return res.status(200).json({
      status: 200,
      data: donations,
      stats: {
        totalAmount,
        cashAmount,
        bankAmount,
        totalReceipts: donations.length,
      }
    });
  }

  if (method === 'POST') {
    const {
      receiptDate,
      donorId,
      donationType,
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

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be a positive number', status: 400 } });
    }

    const donor = await prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      return res.status(404).json({ error: { message: 'Selected donor not found', status: 404 } });
    }

    let debitAccountId = null;
    if (paymentMethod === 'CASH') {
      if (cashAccountId) {
        debitAccountId = cashAccountId;
      } else {
        const defaultCash = await prisma.account.findFirst({
          where: { accountName: { contains: 'Cash', mode: 'insensitive' } }
        });
        if (!defaultCash) return res.status(400).json({ error: { message: 'No Cash account specified or found in Chart of Accounts', status: 400 } });
        debitAccountId = defaultCash.id;
      }
    } else {
      if (!bankAccountId) {
        const defaultBank = await prisma.account.findFirst({
          where: { accountName: { contains: 'Bank', mode: 'insensitive' } }
        });
        if (!defaultBank) return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque/Online payments', status: 400 } });
        debitAccountId = defaultBank.id;
      } else {
        debitAccountId = bankAccountId;
      }
    }

    // Auto generate receiptNo e.g. REC-2026-0001
    const year = new Date().getFullYear();
    const count = await prisma.donationReceived.count();
    const nextNum = (count + 1).toString().padStart(4, '0');
    const receiptNo = `REC-${year}-${nextNum}`;

    const txStatus = status === 'POSTED' ? 'POSTED' : 'DRAFT';

    const result = await prisma.$transaction(async (tx) => {
      let journalEntryId: string | null = null;

      if (txStatus === 'POSTED') {
        const postingResult = await AccountingService.postReceipt(tx, {
          amount: parsedAmount,
          cashOrBankAccountId: debitAccountId!,
          incomeAccountKeyword: donationType,
          reference: receiptNo,
          description: narration || `Received ${donationType} from ${donor.fullName} (${donor.donorCode})`,
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

    const { status, narration, referenceNo, chequeNo, chequeDate, amount, donorId, donationType, paymentMethod, receiptDate, cashAccountId, bankAccountId } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      let journalEntryId = existing.journalEntryId;
      let newStatus = status !== undefined ? status : existing.status;

      // If changing from DRAFT to POSTED
      if (existing.status === 'DRAFT' && newStatus === 'POSTED') {
        const debitAccountId = existing.cashAccountId || existing.bankAccountId;
        if (!debitAccountId) throw new Error("No Cash/Bank account linked to this receipt");

        const postingResult = await AccountingService.postReceipt(tx, {
          amount: existing.amount,
          cashOrBankAccountId: debitAccountId,
          incomeAccountKeyword: existing.donationType,
          reference: existing.receiptNo,
          description: (narration || existing.narration) || `Received ${existing.donationType} from ${existing.donor.fullName}`,
          module: 'Donations Received',
          postedBy: req.user!.id,
          postingDate: existing.receiptDate,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent'] as string,
          voucherType: 'BR'
        });
        if (postingResult && postingResult.journalEntry) {
          journalEntryId = postingResult.journalEntry.id;
        }
      } 
      // If changing from POSTED to CANCELLED
      else if (existing.status === 'POSTED' && newStatus === 'CANCELLED') {
        if (existing.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user!.id, 'Donation Receipt Cancelled');
            journalEntryId = null;
          } catch (e) {
            // Ignore if already deleted
          }
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
          amount: amount !== undefined ? Number(amount) : undefined,
          donorId: donorId !== undefined ? donorId : undefined,
          donationType: donationType !== undefined ? donationType : undefined,
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
