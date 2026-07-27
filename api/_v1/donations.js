import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { validateAmount } from "../_utils/amount.js";
import { isWithinMaxLength, maxLengthError } from "../_utils/text-length.js";
import { notify } from "../_utils/notify.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
function generateVoucherNumber() {
  const date = /* @__PURE__ */ new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JV-${year}${month}-${randomStr}`;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidBeneficiaryId(beneficiaryId) {
  return typeof beneficiaryId === "string" && UUID_RE.test(beneficiaryId);
}
async function getExpenseAccountForDonation(donationType, tx) {
  let acc = await tx.account.findFirst({
    where: {
      accountType: { name: { equals: "Expense", mode: "insensitive" } },
      NOT: { accountName: { contains: "Salary", mode: "insensitive" } },
      OR: [
        { accountName: { contains: donationType, mode: "insensitive" } },
        { accountName: { contains: "Aid", mode: "insensitive" } },
        { accountName: { contains: "Welfare", mode: "insensitive" } },
        { accountName: { contains: "Donation", mode: "insensitive" } }
      ],
      children: { none: {} },
      isLocked: false,
      isDeleted: false
    },
    orderBy: { glCode: "asc" }
  });
  if (!acc) {
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
  }
  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { equals: "Expense", mode: "insensitive" } },
        isLocked: false,
        isDeleted: false
      },
      orderBy: { glCode: "asc" }
    });
  }
  return acc;
}
async function checkMonthlyRestriction(beneficiaryId, donationDate, excludeId) {
  if (!beneficiaryId) return false;
  const startOfMonth = new Date(donationDate.getFullYear(), donationDate.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(donationDate.getFullYear(), donationDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const existingApproved = await prisma.donation.findFirst({
    where: {
      beneficiaryId,
      status: "APPROVED",
      isDeleted: false,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth
      },
      ...excludeId ? { NOT: { id: excludeId } } : {}
    }
  });
  return !!existingApproved;
}
var donations_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    if (!await verifyPermission(req, res, PERMS.MANAGE_DONATIONS)) return;
    const { limit = "100", page = "1" } = req.query;
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
          createdBy: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.donation.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: donations, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      const id = req.query.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ error: { message: "Donation ID is required", status: 400 } });
      }
      const existing = await prisma.donation.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Donation not found", status: 404 } });
      }
      const restored = await prisma.donation.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, "Restore Donation", "DONATION", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Donation restored successfully", data: restored });
    }
  }
  if (!await verifyPermission(req, res, PERMS.RECORD_EXPENSE)) return;
  if (method === "POST") {
    if (action === "approve") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: "Donation ID is required", status: 400 } });
      const donation = await prisma.donation.findUnique({ where: { id }, include: { beneficiary: true } });
      if (!donation) return res.status(404).json({ error: { message: "Donation not found", status: 404 } });
      if (donation.status === "APPROVED") return res.status(400).json({ error: { message: "Donation is already approved", status: 400 } });
      if (donation.beneficiaryId) {
        const hasDuplicate = await checkMonthlyRestriction(donation.beneficiaryId, donation.createdAt, donation.id);
        if (hasDuplicate) {
          return res.status(400).json({
            error: {
              message: "This beneficiary has already received a donation for this month. The next donation can only be issued next month.",
              status: 400
            }
          });
        }
      }
      let cashOrBankAccountId = null;
      if (donation.paymentMethod === "CASH") {
        const cashAccount = await prisma.account.findFirst({
          where: {
            OR: [
              { accountName: { equals: "Cash in Hand", mode: "insensitive" } },
              { accountName: { contains: "Cash in Hand", mode: "insensitive" } },
              { accountName: { contains: "Cash", mode: "insensitive" } }
            ],
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ["SUBSIDIARY", "GL"] }
          },
          orderBy: { glCode: "asc" }
        });
        if (!cashAccount) return res.status(400).json({ error: { message: "Cash account not found in Chart of Accounts", status: 400 } });
        cashOrBankAccountId = cashAccount.id;
      } else {
        if (!donation.bankAccountId) return res.status(400).json({ error: { message: "Bank account is required for BANK/CHEQUE payments", status: 400 } });
        cashOrBankAccountId = donation.bankAccountId;
      }
      const result = await prisma.$transaction(async (tx) => {
        const approvedDonation = await tx.donation.update({
          where: { id },
          data: { status: "APPROVED" }
        });
        const expenseAccount = await getExpenseAccountForDonation(donation.donationType, tx);
        if (!expenseAccount) {
          throw new Error(`Donation Expense account not found in Chart of Accounts for ${donation.donationType}`);
        }
        const postingResult = await AccountingService.postPayment(tx, {
          amount: donation.amount,
          cashOrBankAccountId,
          expenseAccountId: expenseAccount.id,
          reference: `DON-${donation.id.substring(0, 8)}`,
          description: `Donation Given / Disbursement to ${donation.donorName || "Beneficiary"} - ${donation.donationType === "CUSTOM" ? donation.customDonationType || "Custom" : donation.donationType}`,
          module: "Donations Given",
          voucherType: "BP",
          postedBy: req.user.id,
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"]
        });
        return { approvedDonation, journalEntry: postingResult.journalEntry };
      }, {
        timeout: 15e3
      });
      await logAudit(req.user.id, "Approve Donation", "DONATION", donation, result.approvedDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      await notify(req, {
        title: "Aid Disbursement Posted",
        message: `Donation of PKR ${Number(donation.amount).toLocaleString()} to ${donation.donorName || "Beneficiary"} posted to ledger.`,
        module: "Donations Given",
        recordId: donation.id,
        actionType: "APPROVE"
      });
      return res.status(200).json({ status: 200, data: result.approvedDonation, message: "Donation approved and journal entries created successfully" });
    }
    const { beneficiaryId, donorName, donorMobile, donationType, customDonationType, amount, paymentMethod, bankAccountId, chequeNumber, donorBankName, remarks } = req.body;
    if (!donorName || !donationType || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    if (donationType === "CUSTOM" && (!customDonationType || !String(customDonationType).trim())) {
      return res.status(400).json({ error: { message: 'Custom Donation / Aid Type is required when "Custom" is selected.', status: 400 } });
    }
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const parsedAmount = amountCheck.amount;
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payment methods", status: 400 } });
    }
    if (paymentMethod === "CHEQUE" && !chequeNumber) {
      return res.status(400).json({ error: { message: "Cheque number is required for Cheque payment method", status: 400 } });
    }
    if (!isWithinMaxLength(remarks, 1e3)) return res.status(400).json({ error: maxLengthError("Remarks", 1e3) });
    if (!isWithinMaxLength(donorBankName, 100)) return res.status(400).json({ error: maxLengthError("Donor bank name", 100) });
    if (!isWithinMaxLength(chequeNumber, 30)) return res.status(400).json({ error: maxLengthError("Cheque number", 30) });
    if (beneficiaryId && !isValidBeneficiaryId(beneficiaryId)) {
      return res.status(400).json({ error: { message: "Selected recipient is invalid or out of date. Please re-select the recipient from People We Help and try again.", status: 400 } });
    }
    if (beneficiaryId) {
      const hasDuplicate = await checkMonthlyRestriction(beneficiaryId, /* @__PURE__ */ new Date());
      if (hasDuplicate) {
        return res.status(400).json({
          error: {
            message: "This beneficiary has already received a donation for this month. The next donation can only be issued next month.",
            status: 400
          }
        });
      }
    }
    const newDonation = await prisma.$transaction(async (tx) => {
      const createdDonation = await tx.donation.create({
        data: {
          beneficiaryId: beneficiaryId || null,
          donorName,
          donorMobile: donorMobile || null,
          donationType,
          customDonationType: donationType === "CUSTOM" ? customDonationType || null : null,
          amount: parsedAmount,
          paymentMethod,
          bankAccountId: bankAccountId || null,
          chequeNumber: chequeNumber || null,
          donorBankName: donorBankName || null,
          remarks: remarks || null,
          status: "APPROVED",
          createdById: req.user.id
        }
      });
      let cashOrBankAccountId = null;
      if (paymentMethod === "CASH") {
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
            description: `Donation Given / Disbursement to ${donorName || "Beneficiary"} - ${donationType === "CUSTOM" ? customDonationType || "Custom" : donationType}`,
            module: "Donations Given",
            voucherType: "BP",
            postedBy: req.user.id,
            ipAddress: req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"]
          });
        }
      }
      return createdDonation;
    }, {
      timeout: 15e3
    });
    await logAudit(req.user.id, "Create Donation", "DONATION", null, newDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    await notify(req, {
      title: "Aid Disbursement Recorded",
      message: `New ${donationType === "CUSTOM" ? customDonationType || "Custom" : donationType} disbursement of PKR ${Number(amount).toLocaleString()} to ${donorName}.`,
      module: "Donations Given",
      recordId: newDonation.id,
      actionType: "CREATE"
    });
    return res.status(201).json({ status: 201, data: newDonation });
  }
  if (method === "PUT" || method === "PATCH") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: { message: "Donation ID is required", status: 400 } });
    const existingDonation = await prisma.donation.findUnique({ where: { id } });
    if (!existingDonation) return res.status(404).json({ error: { message: "Donation not found", status: 404 } });
    const { beneficiaryId, donorName, donorMobile, donationType, customDonationType, amount, paymentMethod, bankAccountId, chequeNumber, donorBankName, remarks, status } = req.body;
    const effectiveDonationType = donationType !== void 0 ? donationType : existingDonation.donationType;
    if (effectiveDonationType === "CUSTOM") {
      const effectiveCustomType = customDonationType !== void 0 ? customDonationType : existingDonation.customDonationType;
      if (!effectiveCustomType || !String(effectiveCustomType).trim()) {
        return res.status(400).json({ error: { message: 'Custom Donation / Aid Type is required when "Custom" is selected.', status: 400 } });
      }
    }
    const targetBeneficiaryId = beneficiaryId !== void 0 ? beneficiaryId : existingDonation.beneficiaryId;
    const targetStatus = status !== void 0 ? status : existingDonation.status;
    if (!isWithinMaxLength(remarks, 1e3)) return res.status(400).json({ error: maxLengthError("Remarks", 1e3) });
    if (!isWithinMaxLength(donorBankName, 100)) return res.status(400).json({ error: maxLengthError("Donor bank name", 100) });
    if (!isWithinMaxLength(chequeNumber, 30)) return res.status(400).json({ error: maxLengthError("Cheque number", 30) });
    let parsedAmount;
    if (amount !== void 0) {
      const amountCheck = validateAmount(amount);
      if (!amountCheck.valid) {
        return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
      }
      parsedAmount = amountCheck.amount;
    }
    if (targetBeneficiaryId && !isValidBeneficiaryId(targetBeneficiaryId)) {
      return res.status(400).json({ error: { message: "Selected recipient is invalid or out of date. Please re-select the recipient from People We Help and try again.", status: 400 } });
    }
    if (targetStatus === "APPROVED" && targetBeneficiaryId) {
      const hasDuplicate = await checkMonthlyRestriction(targetBeneficiaryId, existingDonation.createdAt, existingDonation.id);
      if (hasDuplicate) {
        return res.status(400).json({
          error: {
            message: "This beneficiary has already received a donation for this month. The next donation can only be issued next month.",
            status: 400
          }
        });
      }
    }
    const updatedDonation = await prisma.$transaction(async (tx) => {
      if (existingDonation.status === "APPROVED") {
        const ref = `DON-${existingDonation.id.substring(0, 8)}`;
        const je = await tx.journalEntry.findFirst({ where: { reference: ref } });
        if (je) {
          try {
            await AccountingService.deleteJournalEntry(tx, je.id, req.user.id, "Donation Updated");
          } catch (e) {
          }
        }
      }
      const updated = await tx.donation.update({
        where: { id },
        data: {
          beneficiaryId: beneficiaryId !== void 0 ? beneficiaryId || null : void 0,
          donorName: donorName || void 0,
          donorMobile: donorMobile !== void 0 ? donorMobile || null : void 0,
          donationType: donationType || void 0,
          customDonationType: donationType !== void 0 ? donationType === "CUSTOM" ? customDonationType || null : null : customDonationType !== void 0 ? existingDonation.donationType === "CUSTOM" ? customDonationType : null : void 0,
          amount: parsedAmount !== void 0 ? parsedAmount : void 0,
          paymentMethod: paymentMethod || void 0,
          bankAccountId: bankAccountId !== void 0 ? bankAccountId || null : void 0,
          chequeNumber: chequeNumber !== void 0 ? chequeNumber || null : void 0,
          donorBankName: donorBankName !== void 0 ? donorBankName || null : void 0,
          remarks: remarks !== void 0 ? remarks || null : void 0,
          status: status || void 0
        }
      });
      const finalStatus = updated.status || "APPROVED";
      if (finalStatus === "APPROVED") {
        let cashOrBankAccountId = null;
        if (updated.paymentMethod === "CASH") {
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
              description: `Donation Given / Disbursement to ${updated.donorName || "Beneficiary"} - ${updated.donationType === "CUSTOM" ? updated.customDonationType || "Custom" : updated.donationType}`,
              module: "Donations Given",
              voucherType: "BP",
              postedBy: req.user.id,
              ipAddress: req.headers["x-forwarded-for"],
              userAgent: req.headers["user-agent"]
            });
          }
        }
      }
      return updated;
    }, {
      timeout: 15e3
    });
    await logAudit(req.user.id, "Update Donation", "DONATION", existingDonation, updatedDonation, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    await notify(req, {
      title: "Aid Disbursement Updated",
      message: `Donation to ${updatedDonation.donorName || "Beneficiary"} updated (PKR ${Number(updatedDonation.amount).toLocaleString()}).`,
      module: "Donations Given",
      recordId: updatedDonation.id,
      actionType: "UPDATE"
    });
    return res.status(200).json({ status: 200, data: updatedDonation });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
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
          if (donation.status === "APPROVED") {
            const ref = `DON-${donation.id.substring(0, 8)}`;
            const je = await tx.journalEntry.findFirst({
              where: { reference: ref }
            });
            if (je) {
              try {
                if (isPermanent) {
                  await AccountingService.deleteJournalEntry(tx, je.id, req.user.id, "Donation Permanently Deleted");
                } else {
                  await tx.journalEntry.update({
                    where: { id: je.id },
                    data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
                  });
                }
              } catch (e) {
              }
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
        timeout: 15e3
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
      await notify(req, {
        title: deletedDonations.length > 1 ? "Aid Disbursements Deleted" : "Aid Disbursement Deleted",
        message: deletedDonations.length > 1 ? `${deletedDonations.length} donation records deleted.` : `Donation to ${deletedDonations[0].donorName || "Beneficiary"} (PKR ${Number(deletedDonations[0].amount).toLocaleString()}) deleted.`,
        module: "Donations Given",
        recordId: deletedDonations.length === 1 ? deletedDonations[0].id : null,
        actionType: "DELETE",
        visibility: "ADMIN_ONLY"
      });
      return res.status(200).json({
        status: 200,
        message: `${deletedDonations.length} donation(s) deleted successfully`,
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
