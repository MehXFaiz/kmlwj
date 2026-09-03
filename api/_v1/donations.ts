import type { VercelResponse } from '@vercel/node';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidBeneficiaryId(beneficiaryId: unknown): beneficiaryId is string {
  return typeof beneficiaryId === 'string' && UUID_RE.test(beneficiaryId);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Normalizes input date/month into standardized YYYY-MM key and formatted label (e.g. "September 2026")
 */
function normalizeMonthAndYear(inputMonth?: string, inputDate?: string | Date, inputDisbursementMonth?: string) {
  let dateObj = new Date();

  const candidateMonthKey = inputDisbursementMonth || (inputMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(inputMonth.trim()) ? inputMonth : undefined);

  if (candidateMonthKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(candidateMonthKey.trim())) {
    const [y, m] = candidateMonthKey.trim().split('-').map(Number);
    dateObj = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  } else if (inputMonth && typeof inputMonth === 'string') {
    const parts = inputMonth.trim().split(/\s+/);
    if (parts.length === 2) {
      const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === parts[0].toLowerCase());
      const yr = Number(parts[1]);
      if (monthIdx !== -1 && !isNaN(yr) && yr > 2000 && yr < 2100) {
        dateObj = new Date(Date.UTC(yr, monthIdx, 1, 12, 0, 0));
      }
    }
  } else if (inputDate) {
    const parsed = new Date(inputDate);
    if (!isNaN(parsed.getTime())) {
      dateObj = parsed;
    }
  }

  const year = dateObj.getFullYear();
  const monthIdx = dateObj.getMonth();
  const disbursementMonth = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const monthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;
  const financialYear = `${year}`;

  return { disbursementMonth, monthLabel, financialYear, dateObj };
}

/**
 * Normalizes donation type into standard categorization ('DONATION' vs 'ZAKAT')
 */
function normalizeDonationType(rawType: string): { enumType: string; isZakat: boolean; displayCategory: string } {
  const norm = (rawType || '').toUpperCase().trim();
  if (norm === 'ZAKAT' || norm.includes('ZAKAT')) {
    return { enumType: 'ZAKAT', isZakat: true, displayCategory: 'Zakat' };
  }
  if (norm === 'MONTHLY' || norm === 'DONATION' || norm === 'GENERAL_DONATION') {
    return { enumType: 'MONTHLY', isZakat: false, displayCategory: 'Donation' };
  }
  return { enumType: rawType || 'MONTHLY', isZakat: false, displayCategory: 'Donation' };
}

/**
 * Resolves the appropriate Expense account for Donation vs Zakat
 */
async function getExpenseAccountForDonation(donationType: string, tx: any) {
  const { isZakat } = normalizeDonationType(donationType);

  if (isZakat) {
    let zakatAcc = await tx.account.findFirst({
      where: {
        accountType: { name: { equals: 'Expense', mode: 'insensitive' } },
        accountName: { contains: 'Zakat', mode: 'insensitive' },
        children: { none: {} },
        isLocked: false,
        isDeleted: false
      },
      orderBy: { glCode: 'asc' }
    });
    if (zakatAcc) return zakatAcc;
  }

  // 1. Check primary standard codes
  const primaryCode = isZakat ? '4060104' : '4060101'; // 4060101 = Monthly Donations
  let acc = await tx.account.findFirst({
    where: {
      glCode: primaryCode,
      isLocked: false,
      isDeleted: false
    }
  });
  if (acc) return acc;

  // 2. Check keyword matching under Expense accounts
  acc = await tx.account.findFirst({
    where: {
      accountType: { name: { equals: 'Expense', mode: 'insensitive' } },
      NOT: { accountName: { contains: 'Salary', mode: 'insensitive' } },
      OR: [
        { accountName: { contains: isZakat ? 'Zakat' : 'Donation', mode: 'insensitive' } },
        { accountName: { contains: 'Aid', mode: 'insensitive' } },
        { accountName: { contains: 'Welfare', mode: 'insensitive' } }
      ],
      children: { none: {} },
      isLocked: false,
      isDeleted: false
    },
    orderBy: { glCode: 'asc' }
  });
  if (acc) return acc;

  // 3. Fallback to any leaf Expense account
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

  return acc;
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const action = (req.query.action || req.body?.action) as string;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    if (!await verifyPermission(req, res, ['donations.view', PERMS.VIEW_DONATIONS])) return;

    // Action: Check Duplicate for Month + Type + Bank Account
    if (action === 'check-duplicate') {
      const { disbursementMonth, donationType = 'DONATION', bankAccountId } = req.query as any;

      if (!disbursementMonth || !bankAccountId) {
        return res.status(200).json({ status: 200, isDuplicate: false });
      }

      const { enumType, displayCategory, isZakat } = normalizeDonationType(donationType);

      const typeFilter = isZakat
        ? { donationType: 'ZAKAT' as any }
        : { donationType: { in: ['MONTHLY', 'GENERAL_DONATION', 'CUSTOM'] } };

      const existingPosting = await prisma.donation.findFirst({
        where: {
          isDeleted: false,
          status: { in: ['APPROVED', 'DISBURSED'] },
          bankAccountId: String(bankAccountId),
          disbursementMonth: String(disbursementMonth).trim(),
          ...typeFilter
        },
        include: {
          bankAccount: { select: { id: true, accountName: true, glCode: true } }
        }
      });

      if (existingPosting) {
        const { monthLabel } = normalizeMonthAndYear(existingPosting.disbursementMonth || disbursementMonth);
        return res.status(200).json({
          status: 200,
          isDuplicate: true,
          message: `Monthly ${displayCategory} for ${monthLabel} has already been posted for this bank account.`,
          data: existingPosting
        });
      }

      return res.status(200).json({ status: 200, isDuplicate: false });
    }

    const {
      limit = '500',
      page = '1',
      month: queryMonth,
      type: queryType,
      beneficiaryId,
      paymentMethod,
      status: queryStatus,
      startDate,
      endDate,
      search
    } = req.query as any;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 500;
    const skip = (pageNum - 1) * limitNum;
    const whereClause: any = getDeletedFilter(req.query);

    if (queryMonth) {
      whereClause.disbursementMonth = String(queryMonth).trim();
    }
    if (queryType && queryType !== 'All' && queryType !== 'ALL') {
      const { enumType } = normalizeDonationType(queryType);
      whereClause.donationType = enumType;
    }
    if (beneficiaryId && beneficiaryId !== 'All' && beneficiaryId !== 'ALL') {
      whereClause.beneficiaryId = String(beneficiaryId);
    }
    if (paymentMethod && paymentMethod !== 'All' && paymentMethod !== 'ALL') {
      whereClause.paymentMethod = String(paymentMethod).toUpperCase();
    }
    if (queryStatus && queryStatus !== 'All' && queryStatus !== 'ALL') {
      whereClause.status = String(queryStatus).toUpperCase();
    }
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { voucherNo: { contains: q, mode: 'insensitive' } },
        { donorName: { contains: q, mode: 'insensitive' } },
        { remarks: { contains: q, mode: 'insensitive' } },
        { customDonationType: { contains: q, mode: 'insensitive' } },
        { beneficiary: { name: { contains: q, mode: 'insensitive' } } },
        { beneficiary: { cnic: { contains: q, mode: 'insensitive' } } },
        { beneficiary: { mobile: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where: whereClause,
        include: {
          beneficiary: true,
          bankAccount: true,
          journalEntry: {
            select: { id: true, voucherNo: true, status: true, postingDate: true }
          },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.donation.count({ where: whereClause })
    ]);

    return res.status(200).json({
      status: 200,
      data: donations,
      meta: { total, page: pageNum, limit: limitNum }
    });
  }

  // ── Write Permissions Enforcement ──────────────────────────────────────────
  if (!await enforceRestrictedRolePolicy(
    req,
    res,
    method === 'DELETE'
      ? ['donations.delete', PERMS.DELETE_DONATION]
      : ['donations.update', PERMS.UPDATE_DONATION, 'donations.create', PERMS.CREATE_DONATION]
  )) return;

  // ── Restore ────────────────────────────────────────────────────────────────
  if (action === 'restore') {
    if (!await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
    }
    const id = (req.query.id || req.body?.id) as string;
    if (!id) return res.status(400).json({ error: { message: 'Donation ID is required', status: 400 } });

    const existing = await prisma.donation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: { message: 'Donation not found', status: 404 } });

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.donation.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });

      if (updated.status === 'APPROVED' && updated.journalEntryId) {
        try {
          await tx.journalEntry.update({
            where: { id: updated.journalEntryId },
            data: { isDeleted: false, deletedAt: null, deletedBy: null }
          });
          await AccountingService.recalculateBalancesForJournalEntry(tx, updated.journalEntryId);
        } catch (e) {
          // Ignore if already restored
        }
      }

      return updated;
    });

    await logAudit(req.user.id, 'Restore Donation', 'DONATION', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
    return res.status(200).json({ status: 200, message: 'Donation restored successfully', data: restored });
  }

  // ── POST: Approve or Create ────────────────────────────────────────────────
  if (method === 'POST') {
    // Action: Approve Existing Donation & Post to Ledger
    if (action === 'approve') {
      if (!await verifyPermission(req, res, ['donations.post', PERMS.POST_LEDGER])) return;

      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: 'Donation ID is required', status: 400 } });

      const donation = await prisma.donation.findUnique({
        where: { id },
        include: { beneficiary: true, bankAccount: true }
      });
      if (!donation) return res.status(404).json({ error: { message: 'Donation record not found', status: 404 } });
      if (donation.status === 'APPROVED') {
        return res.status(409).json({
          error: { message: 'Transaction has already been posted to the General Ledger.', status: 409 }
        });
      }

      const { disbursementMonth, monthLabel } = normalizeMonthAndYear(donation.disbursementMonth || undefined, donation.createdAt);
      const { enumType, isZakat, displayCategory } = normalizeDonationType(donation.donationType);

      let cashOrBankAccountId: string | null = null;
      if (donation.paymentMethod === 'CASH') {
        const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
        cashOrBankAccountId = cashAccount.id;
      } else {
        if (!donation.bankAccountId) {
          return res.status(400).json({ error: { message: 'Bank account is required for BANK/CHEQUE payments', status: 400 } });
        }
        cashOrBankAccountId = donation.bankAccountId;
      }

      // Check Monthly Duplicate before posting
      if (cashOrBankAccountId && donation.paymentMethod !== 'CASH') {
        const typeFilter = isZakat
          ? { donationType: 'ZAKAT' as any }
          : { donationType: { in: ['MONTHLY', 'GENERAL_DONATION', 'CUSTOM'] } };

        const duplicate = await prisma.donation.findFirst({
          where: {
            id: { not: donation.id },
            isDeleted: false,
            status: { in: ['APPROVED', 'DISBURSED'] },
            bankAccountId: cashOrBankAccountId,
            disbursementMonth,
            ...typeFilter
          }
        });

        if (duplicate) {
          return res.status(409).json({
            error: {
              message: `Monthly ${displayCategory} for ${monthLabel} has already been posted for this bank account.`,
              status: 409
            }
          });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const expenseAccount = await getExpenseAccountForDonation(donation.donationType, tx);
        if (!expenseAccount) {
          throw new Error(`Donation Expense account not found in Chart of Accounts for ${donation.donationType}`);
        }

        const voucherNo = donation.voucherNo || `MDON-${disbursementMonth.replace('-', '')}-${donation.id.slice(0, 4).toUpperCase()}`;

        const postingResult = await AccountingService.postPayment(tx, {
          amount: Number(donation.amount),
          cashOrBankAccountId: cashOrBankAccountId!,
          expenseAccountId: expenseAccount.id,
          reference: voucherNo,
          description: `Monthly ${displayCategory} Disbursement - ${monthLabel}${donation.remarks ? ` (${donation.remarks})` : ''}`,
          module: 'Donations',
          voucherType: donation.paymentMethod === 'CASH' ? 'CP' : 'BP',
          postingDate: donation.createdAt,
          postedBy: req.user!.id,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        const approvedDonation = await tx.donation.update({
          where: { id },
          data: {
            status: 'APPROVED',
            journalEntryId: postingResult.journalEntry.id,
            voucherNo,
            month: donation.month || monthLabel,
            disbursementMonth,
            postedAt: new Date(),
            postedById: req.user!.id,
          },
          include: { beneficiary: true, bankAccount: true, journalEntry: { select: { id: true, voucherNo: true, status: true, postingDate: true } } }
        });

        return { approvedDonation, journalEntry: postingResult.journalEntry };
      }, { timeout: 15000 });

      await logAudit(req.user.id, 'POST_TO_LEDGER', 'DONATION', donation, result.approvedDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return res.status(200).json({
        status: 200,
        data: result.approvedDonation,
        message: `${monthLabel} monthly ${displayCategory} of Rs. ${Number(donation.amount).toLocaleString()} posted successfully.`
      });
    }

    // Action: Create & Auto-Post Monthly Donation Disbursement
    if (!await verifyPermission(req, res, ['donations.create', PERMS.CREATE_DONATION])) return;

    const {
      month: rawMonth,
      disbursementMonth: rawDisbursementMonth,
      date,
      donationType: rawDonationType = 'DONATION',
      customDonationType,
      amount,
      paymentMethod = 'BANK',
      bankAccountId,
      chequeNumber,
      donorBankName,
      donorName: rawDonorName,
      donorMobile,
      beneficiaryId,
      beneficiaries,
      remarks,
      status: requestedStatus = 'APPROVED'
    } = req.body;

    const { enumType, isZakat, displayCategory } = normalizeDonationType(rawDonationType);
    const { disbursementMonth, monthLabel, financialYear, dateObj } = normalizeMonthAndYear(rawMonth, date, rawDisbursementMonth);

    if (!amount) {
      return res.status(400).json({ error: { message: 'Donation Amount is required.', status: 400 } });
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const parsedAmount = amountCheck.amount;

    // Validate Bank Account
    if (paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') {
      if (!bankAccountId) {
        return res.status(400).json({ error: { message: 'Bank Account is required for bank disbursement.', status: 400 } });
      }
      const bankAcc = await prisma.account.findFirst({
        where: { id: bankAccountId, isDeleted: false, isLocked: false }
      });
      if (!bankAcc) {
        return res.status(400).json({ error: { message: 'Selected bank account was not found or is inactive in Chart of Accounts.', status: 400 } });
      }
    }

    // Validate Beneficiary if provided
    if (beneficiaryId && !isValidBeneficiaryId(beneficiaryId)) {
      return res.status(400).json({ error: { message: 'Selected recipient is invalid. Please select from People We Help.', status: 400 } });
    }

    // Validate Beneficiaries array if provided
    let beneficiariesJson: any = null;
    if (Array.isArray(beneficiaries) && beneficiaries.length > 0) {
      let sumAllocated = 0;
      beneficiariesJson = beneficiaries.map((b: any) => {
        const itemAmt = Number(b.amount) || 0;
        sumAllocated += itemAmt;
        return {
          id: b.id || b.beneficiaryId || null,
          name: String(b.name || b.recipientName || 'Beneficiary').trim(),
          cnic: b.cnic || null,
          mobile: b.mobile || null,
          amount: itemAmt,
          remarks: b.remarks || null
        };
      });

      // If beneficiaries are specified with amounts, ensure sum matches total
      if (Math.abs(sumAllocated - parsedAmount) > 1) {
        return res.status(400).json({
          error: {
            message: `The sum of beneficiary allocations (Rs. ${sumAllocated.toLocaleString()}) does not match the total disbursement amount (Rs. ${parsedAmount.toLocaleString()}).`,
            status: 400
          }
        });
      }
    }

    // Max length validations
    if (!isWithinMaxLength(remarks, 1000)) return res.status(400).json({ error: maxLengthError('Remarks', 1000) });
    if (!isWithinMaxLength(donorBankName, 100)) return res.status(400).json({ error: maxLengthError('Donor bank name', 100) });
    if (!isWithinMaxLength(chequeNumber, 30)) return res.status(400).json({ error: maxLengthError('Cheque number', 30) });

    const donorName = rawDonorName && rawDonorName.trim()
      ? rawDonorName.trim()
      : `Monthly ${displayCategory} Disbursement - ${monthLabel}`;

    const isDirectPost = requestedStatus === 'APPROVED' || requestedStatus === 'POSTED';

    // ── Server-side Duplicate Prevention inside Atomic Transaction ─────────
    const newDonation = await prisma.$transaction(async (tx) => {
      let cashOrBankAccountId: string | null = null;
      if (paymentMethod === 'CASH') {
        const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
        cashOrBankAccountId = cashAccount.id;
      } else {
        cashOrBankAccountId = bankAccountId || null;
      }

      // Check for existing monthly posting on this bank account & category
      if (isDirectPost && cashOrBankAccountId && paymentMethod !== 'CASH') {
        const typeFilter = isZakat
          ? { donationType: 'ZAKAT' as any }
          : { donationType: { in: ['MONTHLY', 'GENERAL_DONATION', 'CUSTOM'] } };

        const existingDuplicate = await tx.donation.findFirst({
          where: {
            isDeleted: false,
            status: { in: ['APPROVED', 'DISBURSED'] },
            bankAccountId: cashOrBankAccountId,
            disbursementMonth,
            ...typeFilter
          }
        });

        if (existingDuplicate) {
          throw new Error(`DUPLICATE_MONTHLY_POSTING:Monthly ${displayCategory} for ${monthLabel} has already been posted for this bank account.`);
        }
      }

      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const voucherNo = `MDON-${disbursementMonth.replace('-', '')}-${randomStr}`;

      let journalEntryId: string | null = null;

      if (isDirectPost && cashOrBankAccountId) {
        const expenseAccount = await getExpenseAccountForDonation(enumType, tx);
        if (!expenseAccount) {
          throw new Error(`Donation Expense account not found in Chart of Accounts for ${enumType}`);
        }

        const postingResult = await AccountingService.postPayment(tx, {
          amount: parsedAmount,
          cashOrBankAccountId,
          expenseAccountId: expenseAccount.id,
          reference: voucherNo,
          description: `Monthly ${displayCategory} Disbursement - ${monthLabel}${remarks ? ` (${remarks})` : ''}`,
          module: 'Donations',
          voucherType: paymentMethod === 'CASH' ? 'CP' : 'BP',
          postingDate: dateObj,
          postedBy: req.user!.id,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        journalEntryId = postingResult.journalEntry.id;
      }

      const createdDonation = await tx.donation.create({
        data: {
          month: monthLabel,
          disbursementMonth,
          financialYear,
          voucherNo,
          beneficiaryId: beneficiaryId || null,
          beneficiaries: beneficiariesJson,
          donorName,
          donorMobile: donorMobile || null,
          donationType: enumType as any,
          customDonationType: enumType === 'CUSTOM' ? (customDonationType || null) : null,
          amount: parsedAmount,
          paymentMethod: paymentMethod as any,
          bankAccountId: (paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') ? (bankAccountId || null) : null,
          chequeNumber: chequeNumber || null,
          donorBankName: donorBankName || null,
          remarks: remarks || null,
          journalEntryId,
          status: isDirectPost ? 'APPROVED' : 'PENDING',
          postedAt: isDirectPost ? new Date() : null,
          postedById: isDirectPost ? req.user!.id : null,
          createdAt: dateObj,
          createdById: req.user!.id,
        },
        include: {
          beneficiary: true,
          bankAccount: true,
          journalEntry: { select: { id: true, voucherNo: true, status: true, postingDate: true } },
          createdBy: { select: { id: true, fullName: true, email: true } }
        }
      });

      return createdDonation;
    }, {
      timeout: 20000,
    }).catch((err) => {
      if (err.message && err.message.startsWith('DUPLICATE_MONTHLY_POSTING:')) {
        const msg = err.message.replace('DUPLICATE_MONTHLY_POSTING:', '');
        return res.status(409).json({ error: { message: msg, status: 409 } });
      }
      throw err;
    });

    if (!newDonation) return;

    await logAudit(req.user.id, 'Create Monthly Donation', 'DONATION', null, newDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({
      status: 201,
      data: newDonation,
      message: `${monthLabel} monthly ${displayCategory} of Rs. ${parsedAmount.toLocaleString()} posted successfully.`
    });
  }

  // ── PUT / PATCH: Update ────────────────────────────────────────────────────
  if (method === 'PUT' || method === 'PATCH') {
    const id = (req.query.id || req.body?.id) as string;
    if (!id) return res.status(400).json({ error: { message: 'Donation ID is required', status: 400 } });

    const existingDonation = await prisma.donation.findUnique({ where: { id } });
    if (!existingDonation) return res.status(404).json({ error: { message: 'Donation record not found', status: 404 } });

    const {
      month: rawMonth,
      disbursementMonth: rawDisbursementMonth,
      date,
      donationType: rawDonationType,
      customDonationType,
      amount,
      paymentMethod,
      bankAccountId,
      chequeNumber,
      donorBankName,
      donorName,
      donorMobile,
      beneficiaryId,
      beneficiaries,
      remarks,
      status
    } = req.body;

    let parsedAmount: number | undefined;
    if (amount !== undefined) {
      const amountCheck = validateAmount(amount);
      if (!amountCheck.valid) {
        return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
      }
      parsedAmount = amountCheck.amount;
    }

    const { enumType, isZakat, displayCategory } = normalizeDonationType(rawDonationType || existingDonation.donationType);
    const { disbursementMonth, monthLabel, financialYear, dateObj } = normalizeMonthAndYear(
      rawMonth || existingDonation.disbursementMonth || undefined,
      date || existingDonation.createdAt,
      rawDisbursementMonth
    );

    const targetBankAccountId = bankAccountId !== undefined ? (bankAccountId || null) : existingDonation.bankAccountId;
    const targetStatus = status !== undefined ? status : existingDonation.status;
    const isApproved = targetStatus === 'APPROVED';

    const updatedDonation = await prisma.$transaction(async (tx) => {
      // If already posted, reverse previous journal entry so we can re-post fresh figures
      if (existingDonation.status === 'APPROVED' && existingDonation.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existingDonation.journalEntryId, req.user!.id, 'Donation Updated');
        } catch (e) {
          // Ignore if already deleted
        }
      }

      // Check duplicate if updated month / bank / type
      if (isApproved && targetBankAccountId && (paymentMethod !== 'CASH')) {
        const typeFilter = isZakat
          ? { donationType: 'ZAKAT' as any }
          : { donationType: { in: ['MONTHLY', 'GENERAL_DONATION', 'CUSTOM'] } };

        const existingDuplicate = await tx.donation.findFirst({
          where: {
            id: { not: existingDonation.id },
            isDeleted: false,
            status: { in: ['APPROVED', 'DISBURSED'] },
            bankAccountId: targetBankAccountId,
            disbursementMonth,
            ...typeFilter
          }
        });

        if (existingDuplicate) {
          throw new Error(`DUPLICATE_MONTHLY_POSTING:Monthly ${displayCategory} for ${monthLabel} has already been posted for this bank account.`);
        }
      }

      const effectiveAmount = parsedAmount !== undefined ? parsedAmount : existingDonation.amount;
      const effectivePaymentMethod = paymentMethod || existingDonation.paymentMethod;
      const voucherNo = existingDonation.voucherNo || `MDON-${disbursementMonth.replace('-', '')}-${existingDonation.id.slice(0, 4).toUpperCase()}`;

      let journalEntryId: string | null = null;

      if (isApproved) {
        let cashOrBankAccountId: string | null = null;
        if (effectivePaymentMethod === 'CASH') {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          cashOrBankAccountId = cashAccount.id;
        } else {
          cashOrBankAccountId = targetBankAccountId;
        }

        if (cashOrBankAccountId) {
          const expenseAccount = await getExpenseAccountForDonation(enumType, tx);
          if (expenseAccount) {
            const postingResult = await AccountingService.postPayment(tx, {
              amount: effectiveAmount,
              cashOrBankAccountId,
              expenseAccountId: expenseAccount.id,
              reference: voucherNo,
              description: `Monthly ${displayCategory} Disbursement - ${monthLabel}${remarks ? ` (${remarks})` : ''}`,
              module: 'Donations',
              voucherType: effectivePaymentMethod === 'CASH' ? 'CP' : 'BP',
              postingDate: dateObj,
              postedBy: req.user!.id,
              ipAddress: req.headers['x-forwarded-for'] as string,
              userAgent: req.headers['user-agent']
            });
            journalEntryId = postingResult.journalEntry.id;
          }
        }
      }

      const updated = await tx.donation.update({
        where: { id },
        data: {
          month: monthLabel,
          disbursementMonth,
          financialYear,
          voucherNo,
          beneficiaryId: beneficiaryId !== undefined ? (beneficiaryId || null) : undefined,
          beneficiaries: beneficiaries !== undefined ? beneficiaries : undefined,
          donorName: donorName || undefined,
          donorMobile: donorMobile !== undefined ? (donorMobile || null) : undefined,
          donationType: enumType as any,
          customDonationType: enumType === 'CUSTOM' ? (customDonationType || null) : null,
          amount: parsedAmount !== undefined ? parsedAmount : undefined,
          paymentMethod: paymentMethod || undefined,
          bankAccountId: targetBankAccountId,
          chequeNumber: chequeNumber !== undefined ? (chequeNumber || null) : undefined,
          donorBankName: donorBankName !== undefined ? (donorBankName || null) : undefined,
          remarks: remarks !== undefined ? (remarks || null) : undefined,
          journalEntryId,
          status: status || undefined,
          postedAt: isApproved ? (existingDonation.postedAt || new Date()) : null,
          postedById: isApproved ? (existingDonation.postedById || req.user!.id) : null,
        },
        include: {
          beneficiary: true,
          bankAccount: true,
          journalEntry: { select: { id: true, voucherNo: true, status: true, postingDate: true } },
          createdBy: { select: { id: true, fullName: true, email: true } }
        }
      });

      return updated;
    }, {
      timeout: 20000,
    }).catch((err) => {
      if (err.message && err.message.startsWith('DUPLICATE_MONTHLY_POSTING:')) {
        const msg = err.message.replace('DUPLICATE_MONTHLY_POSTING:', '');
        return res.status(409).json({ error: { message: msg, status: 409 } });
      }
      throw err;
    });

    if (!updatedDonation) return;

    await logAudit(req.user.id, 'Update Donation', 'DONATION', existingDonation, updatedDonation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedDonation });
  }

  // ── DELETE: Soft or Permanent Delete ───────────────────────────────────────
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
          if (donation.status === 'APPROVED' && donation.journalEntryId) {
            try {
              if (isPermanent) {
                await AccountingService.deleteJournalEntry(tx, donation.journalEntryId, req.user!.id, 'Donation Permanently Deleted');
              } else {
                await tx.journalEntry.update({
                  where: { id: donation.journalEntryId },
                  data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
                });
                await AccountingService.recalculateBalancesForJournalEntry(tx, donation.journalEntryId);
              }
            } catch (e) {
              // Ignore
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
        timeout: 20000,
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
        message: `${deletedDonations.length} donation disbursement(s) deleted successfully`,
        data: deletedDonations
      });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message || 'Failed to delete donation(s)', status: 400 } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
