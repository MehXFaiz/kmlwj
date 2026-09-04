import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { enforceRestrictedRolePolicy } from "../_middlewares/rbac.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { validateAmount } from "../_utils/amount.js";
import { isWithinMaxLength, maxLengthError } from "../_utils/text-length.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from "../_utils/soft-delete.js";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidBeneficiaryId(beneficiaryId) {
  return typeof beneficiaryId === "string" && UUID_RE.test(beneficiaryId);
}
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
function normalizeMonthAndYear(inputMonth, inputDate, inputDisbursementMonth) {
  let dateObj = /* @__PURE__ */ new Date();
  const candidateMonthKey = inputDisbursementMonth || (inputMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(inputMonth.trim()) ? inputMonth : void 0);
  if (candidateMonthKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(candidateMonthKey.trim())) {
    const [y, m] = candidateMonthKey.trim().split("-").map(Number);
    dateObj = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  } else if (inputMonth && typeof inputMonth === "string") {
    const parts = inputMonth.trim().split(/\s+/);
    if (parts.length === 2) {
      const monthIdx2 = MONTH_NAMES.findIndex((m) => m.toLowerCase() === parts[0].toLowerCase());
      const yr = Number(parts[1]);
      if (monthIdx2 !== -1 && !isNaN(yr) && yr > 2e3 && yr < 2100) {
        dateObj = new Date(Date.UTC(yr, monthIdx2, 1, 12, 0, 0));
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
  const disbursementMonth = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
  const monthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;
  const financialYear = `${year}`;
  return { disbursementMonth, monthLabel, financialYear, dateObj };
}
function normalizeDonationType(rawType) {
  const norm = (rawType || "").toUpperCase().trim();
  if (norm === "ZAKAT" || norm.includes("ZAKAT")) {
    return { enumType: "ZAKAT", isZakat: true, displayCategory: "Zakat" };
  }
  if (norm === "MONTHLY" || norm === "DONATION" || norm === "GENERAL_DONATION") {
    return { enumType: "MONTHLY", isZakat: false, displayCategory: "Donation" };
  }
  return { enumType: rawType || "MONTHLY", isZakat: false, displayCategory: "Donation" };
}
async function getExpenseAccountForDonation(donationType, tx) {
  const { isZakat } = normalizeDonationType(donationType);
  if (isZakat) {
    let zakatAcc = await tx.account.findFirst({
      where: {
        accountType: { name: { equals: "Expense", mode: "insensitive" } },
        accountName: { contains: "Zakat", mode: "insensitive" },
        children: { none: {} },
        isLocked: false,
        isDeleted: false
      },
      orderBy: { glCode: "asc" }
    });
    if (zakatAcc) return zakatAcc;
  }
  const primaryCode = isZakat ? "4060104" : "4060101";
  let acc = await tx.account.findFirst({
    where: {
      glCode: primaryCode,
      isLocked: false,
      isDeleted: false
    }
  });
  if (acc) return acc;
  acc = await tx.account.findFirst({
    where: {
      accountType: { name: { equals: "Expense", mode: "insensitive" } },
      NOT: { accountName: { contains: "Salary", mode: "insensitive" } },
      OR: [
        { accountName: { contains: isZakat ? "Zakat" : "Donation", mode: "insensitive" } },
        { accountName: { contains: "Aid", mode: "insensitive" } },
        { accountName: { contains: "Welfare", mode: "insensitive" } }
      ],
      children: { none: {} },
      isLocked: false,
      isDeleted: false
    },
    orderBy: { glCode: "asc" }
  });
  if (acc) return acc;
  acc = await tx.account.findFirst({
    where: {
      accountType: { name: { equals: "Expense", mode: "insensitive" } },
      NOT: { accountName: { contains: "Salary", mode: "insensitive" } },
      children: { none: {} },
      isLocked: false,
      isDeleted: false
    },
    orderBy: { glCode: "asc" }
  });
  return acc;
}
var donations_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    if (!await verifyPermission(req, res, ["donations.view", PERMS.VIEW_DONATIONS])) return;
    if (action === "check-duplicate") {
      const { disbursementMonth, donationType = "DONATION", bankAccountId } = req.query;
      if (!disbursementMonth) {
        return res.status(200).json({ status: 200, isDuplicate: false });
      }
      const { enumType, displayCategory, isZakat } = normalizeDonationType(donationType);
      const typeFilter = isZakat ? { donationType: "ZAKAT" } : { donationType: { in: ["MONTHLY", "GENERAL_DONATION", "CUSTOM"] } };
      const whereClause2 = {
        isDeleted: false,
        status: { in: ["APPROVED", "DISBURSED"] },
        disbursementMonth: String(disbursementMonth).trim(),
        ...typeFilter
      };
      if (bankAccountId) {
        whereClause2.bankAccountId = String(bankAccountId);
      } else {
        whereClause2.bankAccountId = null;
      }
      const existingPosting = await prisma.donation.findFirst({
        where: whereClause2,
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
      limit = "500",
      page = "1",
      month: queryMonth,
      type: queryType,
      beneficiaryId,
      paymentMethod,
      status: queryStatus,
      startDate,
      endDate,
      search
    } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 500;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = getDeletedFilter(req.query);
    if (queryMonth) {
      whereClause.disbursementMonth = String(queryMonth).trim();
    }
    if (queryType && queryType !== "All" && queryType !== "ALL") {
      const { enumType } = normalizeDonationType(queryType);
      whereClause.donationType = enumType;
    }
    if (beneficiaryId && beneficiaryId !== "All" && beneficiaryId !== "ALL") {
      whereClause.beneficiaryId = String(beneficiaryId);
    }
    if (paymentMethod && paymentMethod !== "All" && paymentMethod !== "ALL") {
      whereClause.paymentMethod = String(paymentMethod).toUpperCase();
    }
    if (queryStatus && queryStatus !== "All" && queryStatus !== "ALL") {
      whereClause.status = String(queryStatus).toUpperCase();
    }
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = /* @__PURE__ */ new Date(`${endDate}T23:59:59.999Z`);
    }
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { voucherNo: { contains: q, mode: "insensitive" } },
        { donorName: { contains: q, mode: "insensitive" } },
        { remarks: { contains: q, mode: "insensitive" } },
        { customDonationType: { contains: q, mode: "insensitive" } },
        { beneficiary: { name: { contains: q, mode: "insensitive" } } },
        { beneficiary: { cnic: { contains: q, mode: "insensitive" } } },
        { beneficiary: { mobile: { contains: q, mode: "insensitive" } } }
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
          createdBy: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.donation.count({ where: whereClause })
    ]);
    return res.status(200).json({
      status: 200,
      data: donations,
      meta: { total, page: pageNum, limit: limitNum }
    });
  }
  if (!await enforceRestrictedRolePolicy(
    req,
    res,
    method === "DELETE" ? ["donations.delete", PERMS.DELETE_DONATION] : ["donations.update", PERMS.UPDATE_DONATION, "donations.create", PERMS.CREATE_DONATION]
  )) return;
  if (action === "restore") {
    if (!await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
    }
    const id = req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: { message: "Donation ID is required", status: 400 } });
    const existing = await prisma.donation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: { message: "Donation not found", status: 404 } });
    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.donation.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      if (updated.status === "APPROVED" && updated.journalEntryId) {
        try {
          await tx.journalEntry.update({
            where: { id: updated.journalEntryId },
            data: { isDeleted: false, deletedAt: null, deletedBy: null }
          });
          await AccountingService.recalculateBalancesForJournalEntry(tx, updated.journalEntryId);
        } catch (e) {
        }
      }
      return updated;
    });
    await logAudit(req.user.id, "Restore Donation", "DONATION", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Donation restored successfully", data: restored });
  }
  if (method === "POST") {
    if (action === "approve") {
      if (!await verifyPermission(req, res, ["donations.post", PERMS.POST_LEDGER])) return;
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: "Donation ID is required", status: 400 } });
      const donation = await prisma.donation.findUnique({
        where: { id },
        include: { beneficiary: true, bankAccount: true }
      });
      if (!donation) return res.status(404).json({ error: { message: "Donation record not found", status: 404 } });
      if (donation.status === "APPROVED") {
        return res.status(409).json({
          error: { message: "Transaction has already been posted to the General Ledger.", status: 409 }
        });
      }
      const { disbursementMonth: disbursementMonth2, monthLabel: monthLabel2 } = normalizeMonthAndYear(donation.disbursementMonth || void 0, donation.createdAt);
      const { enumType: enumType2, isZakat: isZakat2, displayCategory: displayCategory2 } = normalizeDonationType(donation.donationType);
      let cashOrBankAccountId = null;
      if (donation.paymentMethod === "CASH") {
        const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
        cashOrBankAccountId = cashAccount.id;
      } else if (donation.paymentMethod === "BANK" || donation.paymentMethod === "CHEQUE") {
        cashOrBankAccountId = donation.bankAccountId || null;
      }
      const typeFilter = isZakat2 ? { donationType: "ZAKAT" } : { donationType: { in: ["MONTHLY", "GENERAL_DONATION", "CUSTOM"] } };
      const duplicate = await prisma.donation.findFirst({
        where: {
          id: { not: donation.id },
          isDeleted: false,
          status: { in: ["APPROVED", "DISBURSED"] },
          bankAccountId: cashOrBankAccountId || null,
          disbursementMonth: disbursementMonth2,
          ...typeFilter
        }
      });
      if (duplicate) {
        return res.status(409).json({
          error: {
            message: `Monthly ${displayCategory2} for ${monthLabel2} has already been posted.`,
            status: 409
          }
        });
      }
      const result = await prisma.$transaction(async (tx) => {
        const expenseAccount = await getExpenseAccountForDonation(donation.donationType, tx);
        if (!expenseAccount) {
          throw new Error(`Donation Expense account not found in Chart of Accounts for ${donation.donationType}`);
        }
        const voucherNo = donation.voucherNo || `MDON-${disbursementMonth2.replace("-", "")}-${donation.id.slice(0, 4).toUpperCase()}`;
        let journalEntryId = null;
        if (cashOrBankAccountId) {
          const postingResult = await AccountingService.postPayment(tx, {
            amount: Number(donation.amount),
            cashOrBankAccountId,
            expenseAccountId: expenseAccount.id,
            reference: voucherNo,
            description: `Monthly ${displayCategory2} Disbursement - ${monthLabel2}${donation.remarks ? ` (${donation.remarks})` : ""}`,
            module: "Donations",
            voucherType: donation.paymentMethod === "CASH" ? "CP" : "BP",
            postingDate: donation.createdAt,
            postedBy: req.user.id,
            ipAddress: req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"]
          });
          journalEntryId = postingResult.journalEntry.id;
        } else {
          const donationFundAccount = isZakat2 ? await tx.account.findFirst({ where: { accountName: { contains: "Zakat", mode: "insensitive" }, accountType: { name: { in: ["Revenue", "REVENUE"] } }, isDeleted: false } }) || await AccountingService.ensureGeneralDonationAccount(tx) : await AccountingService.ensureGeneralDonationAccount(tx);
          const postingResult = await AccountingService.postTransaction(tx, {
            reference: voucherNo,
            voucherNo,
            description: `Monthly ${displayCategory2} Disbursement from Donation Fund - ${monthLabel2}${donation.remarks ? ` (${donation.remarks})` : ""}`,
            module: "Donations",
            voucherType: "JV",
            postedBy: req.user.id,
            postingDate: donation.createdAt || /* @__PURE__ */ new Date(),
            ipAddress: req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"],
            lines: [
              {
                accountId: expenseAccount.id,
                debit: Number(donation.amount),
                credit: 0,
                description: `Monthly ${displayCategory2} Aid Expense`
              },
              {
                accountId: donationFundAccount.id,
                debit: 0,
                credit: Number(donation.amount),
                description: `Deducted from ${displayCategory2} Fund Pool`
              }
            ]
          });
          journalEntryId = postingResult.journalEntry.id;
        }
        const approvedDonation = await tx.donation.update({
          where: { id },
          data: {
            status: "APPROVED",
            journalEntryId,
            voucherNo,
            month: donation.month || monthLabel2,
            disbursementMonth: disbursementMonth2,
            postedAt: /* @__PURE__ */ new Date(),
            postedById: req.user.id
          },
          include: { beneficiary: true, bankAccount: true, journalEntry: { select: { id: true, voucherNo: true, status: true, postingDate: true } } }
        });
        return { approvedDonation };
      }, { timeout: 15e3 });
      await logAudit(req.user.id, "POST_TO_LEDGER", "DONATION", donation, result.approvedDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({
        status: 200,
        data: result.approvedDonation,
        message: `${monthLabel2} monthly ${displayCategory2} of Rs. ${Number(donation.amount).toLocaleString()} posted successfully.`
      });
    }
    if (!await verifyPermission(req, res, ["donations.create", PERMS.CREATE_DONATION])) return;
    const {
      month: rawMonth,
      disbursementMonth: rawDisbursementMonth,
      date,
      donationType: rawDonationType = "DONATION",
      customDonationType,
      amount,
      paymentMethod = "BANK",
      bankAccountId,
      chequeNumber,
      donorBankName,
      donorName: rawDonorName,
      donorMobile,
      beneficiaryId,
      beneficiaries,
      remarks,
      status: requestedStatus = "APPROVED"
    } = req.body;
    const { enumType, isZakat, displayCategory } = normalizeDonationType(rawDonationType);
    const { disbursementMonth, monthLabel, financialYear, dateObj } = normalizeMonthAndYear(rawMonth, date, rawDisbursementMonth);
    if (!amount) {
      return res.status(400).json({ error: { message: "Donation Amount is required.", status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const parsedAmount = amountCheck.amount;
    if (paymentMethod === "BANK" || paymentMethod === "CHEQUE") {
      if (bankAccountId) {
        const bankAcc = await prisma.account.findFirst({
          where: { id: bankAccountId, isDeleted: false, isLocked: false }
        });
        if (!bankAcc) {
          return res.status(400).json({ error: { message: "Selected bank account was not found or is inactive in Chart of Accounts.", status: 400 } });
        }
      }
    }
    if (beneficiaryId && !isValidBeneficiaryId(beneficiaryId)) {
      return res.status(400).json({ error: { message: "Selected recipient is invalid. Please select from People We Help.", status: 400 } });
    }
    let beneficiariesJson = null;
    if (Array.isArray(beneficiaries) && beneficiaries.length > 0) {
      let sumAllocated = 0;
      beneficiariesJson = beneficiaries.map((b) => {
        const itemAmt = Number(b.amount) || 0;
        sumAllocated += itemAmt;
        return {
          id: b.id || b.beneficiaryId || null,
          name: String(b.name || b.recipientName || "Beneficiary").trim(),
          cnic: b.cnic || null,
          mobile: b.mobile || null,
          amount: itemAmt,
          remarks: b.remarks || null
        };
      });
      if (Math.abs(sumAllocated - parsedAmount) > 1) {
        return res.status(400).json({
          error: {
            message: `The sum of beneficiary allocations (Rs. ${sumAllocated.toLocaleString()}) does not match the total disbursement amount (Rs. ${parsedAmount.toLocaleString()}).`,
            status: 400
          }
        });
      }
    }
    if (!isWithinMaxLength(remarks, 1e3)) return res.status(400).json({ error: maxLengthError("Remarks", 1e3) });
    if (!isWithinMaxLength(donorBankName, 100)) return res.status(400).json({ error: maxLengthError("Donor bank name", 100) });
    if (!isWithinMaxLength(chequeNumber, 30)) return res.status(400).json({ error: maxLengthError("Cheque number", 30) });
    const donorName = rawDonorName && rawDonorName.trim() ? rawDonorName.trim() : `Monthly ${displayCategory} Disbursement - ${monthLabel}`;
    const isDirectPost = requestedStatus === "APPROVED" || requestedStatus === "POSTED";
    const newDonation = await prisma.$transaction(async (tx) => {
      let cashOrBankAccountId = null;
      if (paymentMethod === "CASH") {
        const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
        cashOrBankAccountId = cashAccount.id;
      } else if (paymentMethod === "BANK" || paymentMethod === "CHEQUE") {
        cashOrBankAccountId = bankAccountId || null;
      }
      if (isDirectPost) {
        const typeFilter = isZakat ? { donationType: "ZAKAT" } : { donationType: { in: ["MONTHLY", "GENERAL_DONATION", "CUSTOM"] } };
        const existingDuplicate = await tx.donation.findFirst({
          where: {
            isDeleted: false,
            status: { in: ["APPROVED", "DISBURSED"] },
            bankAccountId: cashOrBankAccountId || null,
            disbursementMonth,
            ...typeFilter
          }
        });
        if (existingDuplicate) {
          throw new Error(`DUPLICATE_MONTHLY_POSTING:Monthly ${displayCategory} for ${monthLabel} has already been posted.`);
        }
      }
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const voucherNo = `MDON-${disbursementMonth.replace("-", "")}-${randomStr}`;
      let journalEntryId = null;
      if (isDirectPost) {
        const expenseAccount = await getExpenseAccountForDonation(enumType, tx);
        if (!expenseAccount) {
          throw new Error(`Donation Expense account not found in Chart of Accounts for ${enumType}`);
        }
        if (cashOrBankAccountId) {
          const postingResult = await AccountingService.postPayment(tx, {
            amount: parsedAmount,
            cashOrBankAccountId,
            expenseAccountId: expenseAccount.id,
            reference: voucherNo,
            description: `Monthly ${displayCategory} Disbursement - ${monthLabel}${remarks ? ` (${remarks})` : ""}`,
            module: "Donations",
            voucherType: paymentMethod === "CASH" ? "CP" : "BP",
            postingDate: dateObj,
            postedBy: req.user.id,
            ipAddress: req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"]
          });
          journalEntryId = postingResult.journalEntry.id;
        } else {
          const donationFundAccount = isZakat ? await tx.account.findFirst({ where: { accountName: { contains: "Zakat", mode: "insensitive" }, accountType: { name: { in: ["Revenue", "REVENUE"] } }, isDeleted: false } }) || await AccountingService.ensureGeneralDonationAccount(tx) : await AccountingService.ensureGeneralDonationAccount(tx);
          const postingResult = await AccountingService.postTransaction(tx, {
            reference: voucherNo,
            voucherNo,
            description: `Monthly ${displayCategory} Disbursement from Donation Fund - ${monthLabel}${remarks ? ` (${remarks})` : ""}`,
            module: "Donations",
            voucherType: "JV",
            postedBy: req.user.id,
            postingDate: dateObj,
            ipAddress: req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"],
            lines: [
              {
                accountId: expenseAccount.id,
                debit: parsedAmount,
                credit: 0,
                description: `Monthly ${displayCategory} Aid Expense`
              },
              {
                accountId: donationFundAccount.id,
                debit: 0,
                credit: parsedAmount,
                description: `Deducted from ${displayCategory} Fund Pool`
              }
            ]
          });
          journalEntryId = postingResult.journalEntry.id;
        }
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
          donationType: enumType,
          customDonationType: enumType === "CUSTOM" ? customDonationType || null : null,
          amount: parsedAmount,
          paymentMethod,
          bankAccountId: paymentMethod === "BANK" || paymentMethod === "CHEQUE" ? bankAccountId || null : null,
          chequeNumber: chequeNumber || null,
          donorBankName: donorBankName || null,
          remarks: remarks || null,
          journalEntryId,
          status: isDirectPost ? "APPROVED" : "PENDING",
          postedAt: isDirectPost ? /* @__PURE__ */ new Date() : null,
          postedById: isDirectPost ? req.user.id : null,
          createdAt: dateObj,
          createdById: req.user.id
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
      timeout: 2e4
    }).catch((err) => {
      if (err.message && err.message.startsWith("DUPLICATE_MONTHLY_POSTING:")) {
        const msg = err.message.replace("DUPLICATE_MONTHLY_POSTING:", "");
        return res.status(409).json({ error: { message: msg, status: 409 } });
      }
      throw err;
    });
    if (!newDonation) return;
    await logAudit(req.user.id, "Create Monthly Donation", "DONATION", null, newDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({
      status: 201,
      data: newDonation,
      message: `${monthLabel} monthly ${displayCategory} of Rs. ${parsedAmount.toLocaleString()} posted successfully.`
    });
  }
  if (method === "PUT" || method === "PATCH") {
    const id = req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: { message: "Donation ID is required", status: 400 } });
    const existingDonation = await prisma.donation.findUnique({ where: { id } });
    if (!existingDonation) return res.status(404).json({ error: { message: "Donation record not found", status: 404 } });
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
    let parsedAmount;
    if (amount !== void 0) {
      const amountCheck = validateAmount(amount);
      if (!amountCheck.valid) {
        return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
      }
      parsedAmount = amountCheck.amount;
    }
    const { enumType, isZakat, displayCategory } = normalizeDonationType(rawDonationType || existingDonation.donationType);
    const { disbursementMonth, monthLabel, financialYear, dateObj } = normalizeMonthAndYear(
      rawMonth || existingDonation.disbursementMonth || void 0,
      date || existingDonation.createdAt,
      rawDisbursementMonth
    );
    const targetBankAccountId = bankAccountId !== void 0 ? bankAccountId || null : existingDonation.bankAccountId;
    const targetStatus = status !== void 0 ? status : existingDonation.status;
    const isApproved = targetStatus === "APPROVED";
    const updatedDonation = await prisma.$transaction(async (tx) => {
      if (existingDonation.status === "APPROVED" && existingDonation.journalEntryId) {
        try {
          await AccountingService.deleteJournalEntry(tx, existingDonation.journalEntryId, req.user.id, "Donation Updated");
        } catch (e) {
        }
      }
      if (isApproved) {
        const typeFilter = isZakat ? { donationType: "ZAKAT" } : { donationType: { in: ["MONTHLY", "GENERAL_DONATION", "CUSTOM"] } };
        const existingDuplicate = await tx.donation.findFirst({
          where: {
            id: { not: existingDonation.id },
            isDeleted: false,
            status: { in: ["APPROVED", "DISBURSED"] },
            bankAccountId: targetBankAccountId || null,
            disbursementMonth,
            ...typeFilter
          }
        });
        if (existingDuplicate) {
          throw new Error(`DUPLICATE_MONTHLY_POSTING:Monthly ${displayCategory} for ${monthLabel} has already been posted.`);
        }
      }
      const effectiveAmount = parsedAmount !== void 0 ? parsedAmount : existingDonation.amount;
      const effectivePaymentMethod = paymentMethod || existingDonation.paymentMethod;
      const voucherNo = existingDonation.voucherNo || `MDON-${disbursementMonth.replace("-", "")}-${existingDonation.id.slice(0, 4).toUpperCase()}`;
      let journalEntryId = null;
      if (isApproved) {
        let cashOrBankAccountId = null;
        if (effectivePaymentMethod === "CASH") {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          cashOrBankAccountId = cashAccount.id;
        } else if (effectivePaymentMethod === "BANK" || effectivePaymentMethod === "CHEQUE") {
          cashOrBankAccountId = targetBankAccountId || null;
        }
        const expenseAccount = await getExpenseAccountForDonation(enumType, tx);
        if (expenseAccount) {
          if (cashOrBankAccountId) {
            const postingResult = await AccountingService.postPayment(tx, {
              amount: effectiveAmount,
              cashOrBankAccountId,
              expenseAccountId: expenseAccount.id,
              reference: voucherNo,
              description: `Monthly ${displayCategory} Disbursement - ${monthLabel}${remarks ? ` (${remarks})` : ""}`,
              module: "Donations",
              voucherType: effectivePaymentMethod === "CASH" ? "CP" : "BP",
              postingDate: dateObj,
              postedBy: req.user.id,
              ipAddress: req.headers["x-forwarded-for"],
              userAgent: req.headers["user-agent"]
            });
            journalEntryId = postingResult.journalEntry.id;
          } else {
            const donationFundAccount = isZakat ? await tx.account.findFirst({ where: { accountName: { contains: "Zakat", mode: "insensitive" }, accountType: { name: { in: ["Revenue", "REVENUE"] } }, isDeleted: false } }) || await AccountingService.ensureGeneralDonationAccount(tx) : await AccountingService.ensureGeneralDonationAccount(tx);
            const postingResult = await AccountingService.postTransaction(tx, {
              reference: voucherNo,
              voucherNo,
              description: `Monthly ${displayCategory} Disbursement from Donation Fund - ${monthLabel}${remarks ? ` (${remarks})` : ""}`,
              module: "Donations",
              voucherType: "JV",
              postedBy: req.user.id,
              postingDate: dateObj,
              ipAddress: req.headers["x-forwarded-for"],
              userAgent: req.headers["user-agent"],
              lines: [
                {
                  accountId: expenseAccount.id,
                  debit: effectiveAmount,
                  credit: 0,
                  description: `Monthly ${displayCategory} Aid Expense`
                },
                {
                  accountId: donationFundAccount.id,
                  debit: 0,
                  credit: effectiveAmount,
                  description: `Deducted from ${displayCategory} Fund Pool`
                }
              ]
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
          beneficiaryId: beneficiaryId !== void 0 ? beneficiaryId || null : void 0,
          beneficiaries: beneficiaries !== void 0 ? beneficiaries : void 0,
          donorName: donorName || void 0,
          donorMobile: donorMobile !== void 0 ? donorMobile || null : void 0,
          donationType: enumType,
          customDonationType: enumType === "CUSTOM" ? customDonationType || null : null,
          amount: parsedAmount !== void 0 ? parsedAmount : void 0,
          paymentMethod: paymentMethod || void 0,
          bankAccountId: targetBankAccountId,
          chequeNumber: chequeNumber !== void 0 ? chequeNumber || null : void 0,
          donorBankName: donorBankName !== void 0 ? donorBankName || null : void 0,
          remarks: remarks !== void 0 ? remarks || null : void 0,
          journalEntryId,
          status: status || void 0,
          postedAt: isApproved ? existingDonation.postedAt || /* @__PURE__ */ new Date() : null,
          postedById: isApproved ? existingDonation.postedById || req.user.id : null
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
      timeout: 2e4
    }).catch((err) => {
      if (err.message && err.message.startsWith("DUPLICATE_MONTHLY_POSTING:")) {
        const msg = err.message.replace("DUPLICATE_MONTHLY_POSTING:", "");
        return res.status(409).json({ error: { message: msg, status: 409 } });
      }
      throw err;
    });
    if (!updatedDonation) return;
    await logAudit(req.user.id, "Update Donation", "DONATION", existingDonation, updatedDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedDonation });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Admin or Super Admin can permanently delete records", status: 403 } });
    }
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Donation ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid ID provided", status: 400 } });
    }
    try {
      const deletedDonations = await prisma.$transaction(async (tx) => {
        const donations = await tx.donation.findMany({
          where: { id: { in: ids } }
        });
        if (donations.length === 0) {
          throw new Error("No records found to delete");
        }
        for (const donation of donations) {
          if (donation.status === "APPROVED" && donation.journalEntryId) {
            try {
              if (isPermanent) {
                await AccountingService.deleteJournalEntry(tx, donation.journalEntryId, req.user.id, "Donation Permanently Deleted");
              } else {
                await tx.journalEntry.update({
                  where: { id: donation.journalEntryId },
                  data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
                });
                await AccountingService.recalculateBalancesForJournalEntry(tx, donation.journalEntryId);
              }
            } catch (e) {
            }
          }
        }
        if (isPermanent) {
          await tx.donation.deleteMany({
            where: { id: { in: donations.map((d) => d.id) } }
          });
        } else {
          await tx.donation.updateMany({
            where: { id: { in: donations.map((d) => d.id) } },
            data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
          });
        }
        return donations;
      }, {
        timeout: 2e4
      });
      await logAudit(
        req.user.id,
        "Delete Donation",
        "DONATION",
        null,
        { count: deletedDonations.length, ids: deletedDonations.map((d) => d.id) },
        req.headers["x-forwarded-for"],
        req.headers["user-agent"]
      );
      return res.status(200).json({
        status: 200,
        message: `${deletedDonations.length} donation disbursement(s) deleted successfully`,
        data: deletedDonations
      });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message || "Failed to delete donation(s)", status: 400 } });
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  donations_default as default
};
