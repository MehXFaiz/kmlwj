import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';

function generateVoucherNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JV-${year}${month}-${randomStr}`;
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const action = req.query.action as string;

  if (method === 'GET') {
    const donations = await prisma.donation.findMany({
      include: {
        beneficiary: true,
        bankAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ status: 200, data: donations });
  }

  if (method === 'POST') {
    // Action: Approve Donation
    if (action === 'approve') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: 'Donation ID is required', status: 400 } });

      const donation = await prisma.donation.findUnique({ where: { id }, include: { beneficiary: true } });
      if (!donation) return res.status(404).json({ error: { message: 'Donation not found', status: 404 } });
      if (donation.status === 'APPROVED') return res.status(400).json({ error: { message: 'Donation is already approved', status: 400 } });

      // Find required accounts (Donation Revenue/Income)
      const revenueAccount = await prisma.account.findFirst({
        where: {
          type: 'Revenue',
          accountName: { contains: 'Donation', mode: 'insensitive' }
        }
      });
      if (!revenueAccount) return res.status(400).json({ error: { message: 'Donation Revenue account not found in Chart of Accounts', status: 400 } });

      let debitAccountId: string | null = null;
      if (donation.paymentMethod === 'CASH') {
        const cashAccount = await prisma.account.findFirst({
          where: { accountName: { contains: 'Cash', mode: 'insensitive' } }
        });
        if (!cashAccount) return res.status(400).json({ error: { message: 'Cash account not found in Chart of Accounts', status: 400 } });
        debitAccountId = cashAccount.id;
      } else {
        if (!donation.bankAccountId) return res.status(400).json({ error: { message: 'Bank account is required for BANK/CHEQUE payments', status: 400 } });
        debitAccountId = donation.bankAccountId;
      }

      // Perform the transaction
      const result = await prisma.$transaction(async (tx) => {
        const approvedDonation = await tx.donation.update({
          where: { id },
          data: { status: 'APPROVED' }
        });

        const postingResult = await AccountingService.postReceipt(tx, {
          amount: donation.amount,
          cashOrBankAccountId: debitAccountId!,
          incomeAccountId: revenueAccount.id,
          reference: `DON-${donation.id.substring(0, 8)}`,
          description: `Donation Received from ${donation.donorName || 'Donor'} - ${donation.donationType}`,
          module: 'Donations',
          postedBy: req.user!.id,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        return { approvedDonation, journalEntry: postingResult.journalEntry };
      });

      await logAudit(req.user.id, 'Approve Donation', 'DONATION', donation, result.approvedDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return res.status(200).json({ status: 200, data: result.approvedDonation, message: 'Donation approved and journal entries created successfully' });
    }

    // Action: Create Donation
    const { beneficiaryId, donorName, donorMobile, donationType, amount, paymentMethod, bankAccountId, chequeNumber, donorBankName, remarks } = req.body;

    if (!donorName || !donationType || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be greater than 0', status: 400 } });
    }
    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payment methods', status: 400 } });
    }
    if (paymentMethod === 'CHEQUE' && !chequeNumber) {
      return res.status(400).json({ error: { message: 'Cheque number is required for Cheque payment method', status: 400 } });
    }

    const newDonation = await prisma.donation.create({
      data: {
        beneficiaryId: beneficiaryId || null,
        donorName,
        donorMobile: donorMobile || null,
        donationType,
        amount: parseFloat(amount),
        paymentMethod,
        bankAccountId: bankAccountId || null,
        chequeNumber: chequeNumber || null,
        donorBankName: donorBankName || null,
        remarks: remarks || null,
        createdById: req.user.id,
      },
    });

    await logAudit(req.user.id, 'Create Donation', 'DONATION', null, newDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newDonation });
  }

  if (method === 'PUT') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: { message: 'Donation ID is required', status: 400 } });

    const existingDonation = await prisma.donation.findUnique({ where: { id } });
    if (!existingDonation) return res.status(404).json({ error: { message: 'Donation not found', status: 404 } });
    if (existingDonation.status !== 'PENDING') return res.status(400).json({ error: { message: 'Only pending donations can be updated', status: 400 } });

    const { beneficiaryId, donorName, donorMobile, donationType, amount, paymentMethod, bankAccountId, chequeNumber, donorBankName, remarks, status } = req.body;

    const updatedDonation = await prisma.donation.update({
      where: { id },
      data: {
        beneficiaryId: beneficiaryId !== undefined ? (beneficiaryId || null) : undefined,
        donorName: donorName || undefined,
        donorMobile: donorMobile !== undefined ? (donorMobile || null) : undefined,
        donationType: donationType || undefined,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        paymentMethod: paymentMethod || undefined,
        bankAccountId: bankAccountId !== undefined ? (bankAccountId || null) : undefined,
        chequeNumber: chequeNumber !== undefined ? (chequeNumber || null) : undefined,
        donorBankName: donorBankName !== undefined ? (donorBankName || null) : undefined,
        remarks: remarks !== undefined ? (remarks || null) : undefined,
        status: status || undefined,
      },
    });

    await logAudit(req.user.id, 'Update Donation', 'DONATION', existingDonation, updatedDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedDonation });
  }

  if (method === 'DELETE') {
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Donation ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: { message: 'No valid ID provided', status: 400 } });
    }

    try {
      const deletedDonations = await prisma.$transaction(async (tx) => {
        const donations = await tx.donation.findMany({
          where: { id: { in: ids } }
        });

        if (donations.length === 0) {
          throw new Error('No records found to delete');
        }

        for (const donation of donations) {
          if (donation.status === 'APPROVED') {
            const ref = `DON-${donation.id.substring(0, 8)}`;
            const je = await tx.journalEntry.findFirst({
              where: { reference: ref }
            });
            if (je) {
              try {
                await AccountingService.deleteJournalEntry(tx, je.id, req.user!.id, 'Donation Deleted');
              } catch (e) {
                // Ignore if already deleted
              }
            }
          }
        }

        await tx.donation.deleteMany({
          where: { id: { in: donations.map(d => d.id) } }
        });

        return donations;
      });

      await logAudit(
        req.user.id,
        'Delete Donation',
        'DONATION',
        null,
        { count: deletedDonations.length, ids: deletedDonations.map(d => d.id) },
        req.headers['x-forwarded-for'] as string,
        req.headers['user-agent']
      );

      return res.status(200).json({
        status: 200,
        message: `${deletedDonations.length} donation(s) deleted successfully`,
        data: deletedDonations
      });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message || 'Failed to delete donation(s)', status: 400 } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
