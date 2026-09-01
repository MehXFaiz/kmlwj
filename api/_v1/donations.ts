import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { enforceRestrictedRolePolicy, loadIsPrivileged } from '../_middlewares/rbac.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';
import { validateAmount } from '../_utils/amount.js';
import { isWithinMaxLength, maxLengthError } from '../_utils/text-length.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from '../_utils/soft-delete.js';

function generateVoucherNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JV-${year}${month}-${randomStr}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidBeneficiaryId(beneficiaryId: unknown): beneficiaryId is string {
  return typeof beneficiaryId === 'string' && UUID_RE.test(beneficiaryId);
}

async function getExpenseAccountForDonation(donationType: string, tx: any) {
  let acc = await tx.account.findFirst({
    where: {
      accountType: { name: { equals: 'Expense', mode: 'insensitive' } },
      NOT: { accountName: { contains: 'Salary', mode: 'insensitive' } },
      OR: [
        { accountName: { contains: donationType, mode: 'insensitive' } },
        { accountName: { contains: 'Aid', mode: 'insensitive' } },
        { accountName: { contains: 'Welfare', mode: 'insensitive' } },
        { accountName: { contains: 'Donation', mode: 'insensitive' } }
      ],
      children: { none: {} },
      isLocked: false,
      isDeleted: false
    },
    orderBy: { glCode: 'asc' }
  });

  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { equals: 'Expense', mode: 'insensitive' } },
        NOT: { accountName: { contains: 'Salary', mode: 'insensitive' } },
        children: { none: {} },
        isLocked: false,
        isDeleted: false
      },
      orderBy: { glCode: 'asc' }
    });
  }

  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { equals: 'Expense', mode: 'insensitive' } },
        isLocked: false,
        isDeleted: false
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
  const action = (req.query.action || req.body?.action) as string;

  if (method === 'GET') {
    // VIEW permission allows reading donations
    if (!await verifyPermission(req, res, ['donations.view', PERMS.VIEW_DONATIONS])) return;

    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = getDeletedFilter(req.query);

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where: whereClause,
        include: {
          beneficiary: true,
          bankAccount: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.donation.count({ where: whereClause })
    ]);

    return res.status(200).json({ status: 200, data: donations, meta: { total, page: pageNum, limit: limitNum } });
  }

  // ── All write methods ───────────────────────────────────────────────────────
  // Granular RBAC: PUT / PATCH require donations.update, DELETE requires donations.delete
  if (!await enforceRestrictedRolePolicy(req, res, method === 'DELETE' ? ['donations.delete', PERMS.DELETE_DONATION] : ['donations.update', PERMS.UPDATE_DONATION])) return;

  if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      const id = (req.query.id || req.body?.id) as string;
      if (!id) {
        return res.status(400).json({ error: { message: 'Donation ID is required', status: 400 } });
      }
      const existing = await prisma.donation.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Donation not found', status: 404 } });
      }
      const restored = await prisma.$transaction(async (tx) => {
        const updated = await tx.donation.update({
          where: { id },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        });

        if (updated.status === 'APPROVED') {
          const ref = `DON-${updated.id.substring(0, 8)}`;
          const je = await tx.journalEntry.findFirst({ where: { reference: ref, isDeleted: true } });
          if (je) {
            try {
              await tx.journalEntry.update({
                where: { id: je.id },
                data: { isDeleted: false, deletedAt: null, deletedBy: null }
              });
              await AccountingService.recalculateBalancesForJournalEntry(tx, je.id);
            } catch (e) {
              // Ignore if already restored
            }
          }
        }

        return updated;
      });
      await logAudit(req.user.id, 'Restore Donation', 'DONATION', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Donation restored successfully', data: restored });
    }
  }

  // POST: Create or Approve
  if (method === 'POST') {
    // Action: Approve Donation & Post to Ledger — requires donations.post permission
    if (action === 'approve') {
      if (!await verifyPermission(req, res, ['donations.post', PERMS.POST_LEDGER])) return;


      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: 'Donation ID is required', status: 400 } });

      const donation = await prisma.donation.findUnique({ where: { id }, include: { beneficiary: true } });
      if (!donation) return res.status(404).json({ error: { message: 'Donation not found', status: 404 } });
      if (donation.status === 'APPROVED') {
        return res.status(409).json({
          error: {
            message: 'Transaction has already been posted to the General Ledger.',
            status: 409
          }
        });
      }

      let cashOrBankAccountId: string | null = null;
      if (donation.paymentMethod === 'CASH') {
        const cashAccount = await prisma.account.findFirst({
          where: {
            OR: [
              { accountName: { equals: 'Cash in Hand', mode: 'insensitive' } },
              { accountName: { contains: 'Cash in Hand', mode: 'insensitive' } },
              { accountName: { contains: 'Cash', mode: 'insensitive' } }
            ],
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['SUBSIDIARY', 'GL'] }
          },
          orderBy: { glCode: 'asc' }
        });
        if (!cashAccount) return res.status(400).json({ error: { message: 'Cash account not found in Chart of Accounts', status: 400 } });
        cashOrBankAccountId = cashAccount.id;
      } else {
        if (!donation.bankAccountId) return res.status(400).json({ error: { message: 'Bank account is required for BANK/CHEQUE payments', status: 400 } });
        cashOrBankAccountId = donation.bankAccountId;
      }

      // Perform the transaction
      const result = await prisma.$transaction(async (tx) => {
        const approvedDonation = await tx.donation.update({
          where: { id },
          data: { status: 'APPROVED' }
        });

        const expenseAccount = await getExpenseAccountForDonation(donation.donationType, tx);
        if (!expenseAccount) {
          throw new Error(`Donation Expense account not found in Chart of Accounts for ${donation.donationType}`);
        }

        const postingResult = await AccountingService.postPayment(tx, {
          amount: donation.amount,
          cashOrBankAccountId: cashOrBankAccountId!,
          expenseAccountId: expenseAccount.id,
          reference: `DON-${donation.id.substring(0, 8)}`,
          description: `Donation Given / Disbursement to ${donation.donorName || 'Beneficiary'} - ${donation.donationType === 'CUSTOM' ? ((donation as any).customDonationType || 'Custom') : donation.donationType}`,  
          module: 'Donations Given',
          voucherType: donation.paymentMethod === 'CASH' ? 'CP' : 'BP',
          postingDate: donation.createdAt,
          postedBy: req.user!.id,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        return { approvedDonation, journalEntry: postingResult.journalEntry };
      }, {
        timeout: 15000,
      });

      await logAudit(req.user.id, 'POST_TO_LEDGER', 'DONATION', donation, result.approvedDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


      return res.status(200).json({ status: 200, data: result.approvedDonation, message: 'Donation approved and journal entries created successfully' });
    }

    // Action: Create Donation
    if (!await verifyPermission(req, res, ['donations.create', PERMS.CREATE_DONATION])) return;

    const { beneficiaryId, donorName, donorMobile, donationType, customDonationType, amount, paymentMethod = 'BANK', bankAccountId, chequeNumber, donorBankName, remarks, date } = req.body;

    if (!donorName || !donationType || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }
    if (donationType === 'CUSTOM' && (!customDonationType || !String(customDonationType).trim())) {
      return res.status(400).json({ error: { message: 'Custom Donation / Aid Type is required when "Custom" is selected.', status: 400 } });
    }
    // SQA fix (Critical): the previous `amount <= 0` check was bypassed by any
    // non-numeric string — `"abc" <= 0` is false in JS — letting a NaN amount
    // reach ledger posting. validateAmount() rejects non-numeric input,
    // enforces a sane upper bound, and normalizes to 2 decimal places.
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const parsedAmount = amountCheck.amount;
    if (donationType === 'MONTHLY') {
      if (paymentMethod === 'CASH') {
        return res.status(400).json({ error: { message: 'Monthly donation disbursements must be paid from a Bank Account. Please select Bank as the payment method.', status: 400 } });
      }
      if (!bankAccountId) {
        return res.status(400).json({ error: { message: 'Bank account is required for Monthly donation disbursements.', status: 400 } });
      }
    }

    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE')) {
      if (!bankAccountId) {
        return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payment methods', status: 400 } });
      }
      const bankAcc = await prisma.account.findFirst({
        where: { id: bankAccountId, isDeleted: false, isLocked: false }
      });
      if (!bankAcc) {
        return res.status(400).json({ error: { message: 'Selected bank account was not found or is inactive', status: 400 } });
      }
    }
    if (paymentMethod === 'CHEQUE' && !chequeNumber) {
      return res.status(400).json({ error: { message: 'Cheque number is required for Cheque payment method', status: 400 } });
    }
    // SQA fix: these free-text fields had no max-length validation — only
    // the global request body-size cap bounded them.
    if (!isWithinMaxLength(remarks, 1000)) return res.status(400).json({ error: maxLengthError('Remarks', 1000) });
    if (!isWithinMaxLength(donorBankName, 100)) return res.status(400).json({ error: maxLengthError('Donor bank name', 100) });
    if (!isWithinMaxLength(chequeNumber, 30)) return res.status(400).json({ error: maxLengthError('Cheque number', 30) });
    if (beneficiaryId && !isValidBeneficiaryId(beneficiaryId)) {
      return res.status(400).json({ error: { message: 'Selected recipient is invalid or out of date. Please re-select the recipient from People We Help and try again.', status: 400 } });
    }

    const creationDate = date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date();

    const newDonation = await prisma.$transaction(async (tx) => {
      const createdDonation = await tx.donation.create({
        data: {
          beneficiaryId: beneficiaryId || null,
          donorName,
          donorMobile: donorMobile || null,
          donationType,
          customDonationType: donationType === 'CUSTOM' ? (customDonationType || null) : null,
          amount: parsedAmount,
          paymentMethod,
          bankAccountId: (paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') ? (bankAccountId || null) : null,
          chequeNumber: chequeNumber || null,
          donorBankName: donorBankName || null,
          remarks: remarks || null,
          status: 'APPROVED',
          createdAt: creationDate,
          createdById: req.user!.id,
        },
      });

      let cashOrBankAccountId: string | null = null;
      if (paymentMethod === 'CASH') {
        const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
        cashOrBankAccountId = cashAccount.id;
      } else {
        cashOrBankAccountId = bankAccountId || null;
      }

      if (cashOrBankAccountId) {
        const expenseAccount = await getExpenseAccountForDonation(donationType, tx);
        if (expenseAccount) {
          await AccountingService.postPayment(tx, {
            amount: parsedAmount,
            cashOrBankAccountId,
            expenseAccountId: expenseAccount.id,
            reference: `DON-${createdDonation.id.substring(0, 8)}`,
            description: `Donation Given / Disbursement to ${donorName || 'Beneficiary'} - ${donationType === 'CUSTOM' ? (customDonationType || 'Custom') : donationType}`,  
            module: 'Donations Given',
            voucherType: paymentMethod === 'CASH' ? 'CP' : 'BP',
            postingDate: creationDate,
            postedBy: req.user!.id,
            ipAddress: req.headers['x-forwarded-for'] as string,
            userAgent: req.headers['user-agent']
          });
        }
      }

      return createdDonation;
    }, {
      timeout: 15000,
    });

    await logAudit(req.user.id, 'Create Donation', 'DONATION', null, newDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(201).json({ status: 201, data: newDonation });
  }

  if (method === 'PUT' || method === 'PATCH') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: { message: 'Donation ID is required', status: 400 } });

    const existingDonation = await prisma.donation.findUnique({ where: { id } });
    if (!existingDonation) return res.status(404).json({ error: { message: 'Donation not found', status: 404 } });

    const { beneficiaryId, donorName, donorMobile, donationType, customDonationType, amount, paymentMethod, bankAccountId, chequeNumber, donorBankName, remarks, status } = req.body;

    // Validate custom type on update
    const effectiveDonationType = donationType !== undefined ? donationType : existingDonation.donationType;
    if (effectiveDonationType === 'CUSTOM') {
      const effectiveCustomType = customDonationType !== undefined ? customDonationType : (existingDonation as any).customDonationType;
      if (!effectiveCustomType || !String(effectiveCustomType).trim()) {
        return res.status(400).json({ error: { message: 'Custom Donation / Aid Type is required when "Custom" is selected.', status: 400 } });
      }
    }

    const targetBeneficiaryId = beneficiaryId !== undefined ? beneficiaryId : existingDonation.beneficiaryId;
    const targetStatus = status !== undefined ? status : existingDonation.status;

    if (!isWithinMaxLength(remarks, 1000)) return res.status(400).json({ error: maxLengthError('Remarks', 1000) });
    if (!isWithinMaxLength(donorBankName, 100)) return res.status(400).json({ error: maxLengthError('Donor bank name', 100) });
    if (!isWithinMaxLength(chequeNumber, 30)) return res.status(400).json({ error: maxLengthError('Cheque number', 30) });

    // SQA fix: this PUT/PATCH path previously had no amount validation at all
    // when the caller changed `amount` — a non-numeric or absurd value would
    // flow straight into ledger re-posting below.
    let parsedAmount: number | undefined;
    if (amount !== undefined) {
      const amountCheck = validateAmount(amount);
      if (!amountCheck.valid) {
        return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
      }
      parsedAmount = amountCheck.amount;
    }

    if (targetBeneficiaryId && !isValidBeneficiaryId(targetBeneficiaryId)) {
      return res.status(400).json({ error: { message: 'Selected recipient is invalid or out of date. Please re-select the recipient from People We Help and try again.', status: 400 } });
    }

    const updatedDonation = await prisma.$transaction(async (tx) => {
      // If already approved, delete previous accounting journal entry so we can re-post with updated figures
      if (existingDonation.status === 'APPROVED') {
        const ref = `DON-${existingDonation.id.substring(0, 8)}`;
        const je = await tx.journalEntry.findFirst({ where: { reference: ref } });
        if (je) {
          try {
            await AccountingService.deleteJournalEntry(tx, je.id, req.user!.id, 'Donation Updated');
          } catch (e) {
            // Ignore if already deleted
          }
        }
      }

      const updated = await tx.donation.update({
        where: { id },
        data: {
          beneficiaryId: beneficiaryId !== undefined ? (beneficiaryId || null) : undefined,
          donorName: donorName || undefined,
          donorMobile: donorMobile !== undefined ? (donorMobile || null) : undefined,
          donationType: donationType || undefined,
          customDonationType: donationType !== undefined
            ? (donationType === 'CUSTOM' ? (customDonationType || null) : null)
            : (customDonationType !== undefined ? ((existingDonation as any).donationType === 'CUSTOM' ? customDonationType : null) : undefined),
          amount: parsedAmount !== undefined ? parsedAmount : undefined,
          paymentMethod: paymentMethod || undefined,
          bankAccountId: bankAccountId !== undefined ? (bankAccountId || null) : undefined,
          chequeNumber: chequeNumber !== undefined ? (chequeNumber || null) : undefined,
          donorBankName: donorBankName !== undefined ? (donorBankName || null) : undefined,
          remarks: remarks !== undefined ? (remarks || null) : undefined,
          status: status || undefined,
        },
      });

      const finalStatus = updated.status || 'APPROVED';
      if (finalStatus === 'APPROVED') {
        let cashOrBankAccountId: string | null = null;
        if (updated.paymentMethod === 'CASH') {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          cashOrBankAccountId = cashAccount.id;
        } else {
          cashOrBankAccountId = updated.bankAccountId || null;
        }

        if (cashOrBankAccountId) {
          const expenseAccount = await getExpenseAccountForDonation(updated.donationType, tx);
          if (expenseAccount) {
            await AccountingService.postPayment(tx, {
              amount: Number(updated.amount),
              cashOrBankAccountId,
              expenseAccountId: expenseAccount.id,
              reference: `DON-${updated.id.substring(0, 8)}`,
              description: `Donation Given / Disbursement to ${updated.donorName || 'Beneficiary'} - ${updated.donationType === 'CUSTOM' ? ((updated as any).customDonationType || 'Custom') : updated.donationType}`,  
              module: 'Donations Given',
              voucherType: updated.paymentMethod === 'CASH' ? 'CP' : 'BP',
              postingDate: updated.createdAt,
              postedBy: req.user!.id,
              ipAddress: req.headers['x-forwarded-for'] as string,
              userAgent: req.headers['user-agent']
            });
          }
        }
      }

      return updated;
    }, {
      timeout: 15000,
    });

    await logAudit(req.user.id, 'Update Donation', 'DONATION', existingDonation, updatedDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


    return res.status(200).json({ status: 200, data: updatedDonation });
  }

  if (method === 'DELETE') {
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Admin or Super Admin can permanently delete records', status: 403 } });
    }

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
                if (isPermanent) {
                  await AccountingService.deleteJournalEntry(tx, je.id, req.user!.id, 'Donation Permanently Deleted');
                } else {
                  await tx.journalEntry.update({
                    where: { id: je.id },
                    data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
                  });
                  // The cached Account.currentBalance must follow the ledger: this entry
                  // just moved in/out of POSTED_JOURNAL_FILTER, so rebuild every account
                  // it touches or the balance keeps the deleted transaction's impact.
                  await AccountingService.recalculateBalancesForJournalEntry(tx, je.id);
                }
              } catch (e) {
                // Ignore if already processed
              }
            }
          }
        }

        if (isPermanent) {
          await tx.donation.deleteMany({
            where: { id: { in: donations.map(d => d.id) } }
          });
        } else {
          await tx.donation.updateMany({
            where: { id: { in: donations.map(d => d.id) } },
            data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
          });
        }

        return donations;
      }, {
        timeout: 15000,
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
