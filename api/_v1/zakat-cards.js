import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { enforceRestrictedRolePolicy } from "../_middlewares/rbac.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, getDeletedFilter } from "../_utils/soft-delete.js";
import { validateAmount } from "../_utils/amount.js";
const CARD_NO_PREFIX = "ZK-";
async function nextCardNumber(tx) {
  const existing = await tx.zakatCard.findMany({
    where: { cardNumber: { startsWith: CARD_NO_PREFIX } },
    select: { cardNumber: true }
  });
  const maxNum = existing.reduce((max, c) => {
    const n = parseInt(c.cardNumber.slice(CARD_NO_PREFIX.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${CARD_NO_PREFIX}${String(maxNum + 1).padStart(6, "0")}`;
}
function isUniqueViolation(err) {
  return err?.code === "P2002";
}
async function resolveZakatExpenseAccount(tx) {
  let acc = await tx.account.findFirst({
    where: {
      accountName: { contains: "Zakat", mode: "insensitive" },
      accountType: { name: { in: ["Expense", "Expenses", "Liability", "Liabilities"], mode: "insensitive" } },
      isLocked: false,
      isDeleted: false,
      children: { none: {} }
    },
    orderBy: { glCode: "asc" }
  });
  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { in: ["Expense", "Expenses"], mode: "insensitive" } },
        isLocked: false,
        isDeleted: false,
        children: { none: {} }
      },
      orderBy: { glCode: "asc" }
    });
  }
  return acc;
}
var zakat_cards_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const method = req.method?.toUpperCase() ?? "";
  if (!await enforceRestrictedRolePolicy(req, res, method === "DELETE" ? ["zakatCards.delete", PERMS.DELETE_ZAKAT_CARD] : ["zakatCards.update", PERMS.UPDATE_ZAKAT_CARD])) return;
  if (method === "GET") {
    if (!await verifyPermission(req, res, ["zakatCards.view", PERMS.VIEW_ZAKAT_CARDS])) return;
  } else if (method === "POST") {
    if (!await verifyPermission(req, res, ["zakatCards.create", PERMS.CREATE_ZAKAT_CARD])) return;
  } else if (method === "DELETE") {
    if (!await verifyPermission(req, res, ["zakatCards.delete", PERMS.DELETE_ZAKAT_CARD])) return;
  } else {
    if (!await verifyPermission(req, res, ["zakatCards.update", PERMS.UPDATE_ZAKAT_CARD])) return;
  }
  const id = req.query.id;
  const action = req.query.action || req.body?.action;
  if (method === "GET") {
    if (action === "eligible-members") {
      const donations = await prisma.donation.findMany({
        where: {
          donationType: "ZAKAT",
          status: "APPROVED",
          isDeleted: false,
          beneficiaryId: { not: null }
        },
        include: {
          beneficiary: true
        },
        orderBy: { createdAt: "desc" }
      });
      const seen = /* @__PURE__ */ new Set();
      const eligible = [];
      for (const d of donations) {
        if (!d.beneficiaryId || !d.beneficiary) continue;
        if (seen.has(d.beneficiaryId)) continue;
        seen.add(d.beneficiaryId);
        eligible.push({
          id: d.beneficiary.id,
          name: d.beneficiary.name,
          cnic: d.beneficiary.cnic,
          mobile: d.beneficiary.mobile,
          address: d.beneficiary.address,
          lastZakatAmount: d.amount,
          lastZakatDate: d.createdAt
        });
      }
      eligible.sort((a, b) => a.name.localeCompare(b.name));
      return res.status(200).json({ status: 200, data: eligible });
    }
    if (id && !req.query.limit) {
      const card = await prisma.zakatCard.findUnique({
        where: { id },
        include: {
          member: true,
          beneficiary: true,
          createdBy: { select: { id: true, fullName: true, email: true } }
        }
      });
      if (!card) return res.status(404).json({ error: { message: "Zakat card not found", status: 404 } });
      return res.status(200).json({ status: 200, data: card });
    }
    const { limit = "1000", page = "1" } = req.query;
    const limitNum = parseInt(limit) || 1e3;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = getDeletedFilter(req.query);
    const [cards, total] = await Promise.all([
      prisma.zakatCard.findMany({
        where: whereClause,
        include: {
          member: true,
          beneficiary: true,
          createdBy: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.zakatCard.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: cards, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    if (action === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      const targetId = id || req.body?.id;
      if (!targetId) {
        return res.status(400).json({ error: { message: "Card ID is required", status: 400 } });
      }
      const existing = await prisma.zakatCard.findUnique({ where: { id: targetId } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Zakat card not found", status: 404 } });
      }
      const restored = await prisma.zakatCard.update({
        where: { id: targetId },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      if (existing.journalEntryId) {
        await prisma.journalEntry.update({
          where: { id: existing.journalEntryId },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        }).catch(() => {
        });
        await AccountingService.recalculateBalancesForJournalEntry(prisma, existing.journalEntryId);
      }
      await logAudit(req.user.id, "Restore Zakat Card", "ZAKAT_CARD", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Zakat card restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    const { beneficiaryId, zakatAmount, issueDate, paymentMethod, bankAccountId } = req.body;
    if (!beneficiaryId || !zakatAmount) {
      return res.status(400).json({ error: { message: "Beneficiary and zakat amount are required", status: 400 } });
    }
    const amountCheck = validateAmount(zakatAmount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: { message: amountCheck.message, status: 400 } });
    }
    const parsedAmount = amountCheck.amount;
    const beneficiary = await prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
    if (!beneficiary) {
      return res.status(404).json({ error: { message: "Beneficiary not found", status: 404 } });
    }
    const zakatDonation = await prisma.donation.findFirst({
      where: { beneficiaryId, donationType: "ZAKAT", status: "APPROVED", isDeleted: false }
    });
    if (!zakatDonation) {
      return res.status(400).json({
        error: { message: "Zakat card can only be issued to beneficiaries with an approved Zakat distribution on record", status: 400 }
      });
    }
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payments", status: 400 } });
    }
    let result;
    for (let attempt = 1; ; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          return runIssuance(tx);
        });
        break;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 5 && err.meta?.target?.includes("cardNumber")) {
          continue;
        }
        throw err;
      }
    }
    async function runIssuance(tx) {
      const cardNumber = await nextCardNumber(tx);
      const zakatAccount = await resolveZakatExpenseAccount(tx);
      if (!zakatAccount) {
        throw Object.assign(
          new Error("No Zakat expense/liability account found in Chart of Accounts. Please create one first."),
          { status: 400 }
        );
      }
      let debitAccountId;
      if (paymentMethod === "CASH" || !paymentMethod) {
        const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
        debitAccountId = cashAccount.id;
      } else {
        debitAccountId = bankAccountId;
      }
      const postingResult = await AccountingService.postTransaction(tx, {
        reference: cardNumber,
        description: `Zakat Card issued to ${beneficiary.name} (${cardNumber})`,
        module: "Zakat Card",
        voucherType: "JV",
        postedBy: req.user.id,
        postingDate: issueDate ? new Date(issueDate) : /* @__PURE__ */ new Date(),
        lines: [
          { accountId: zakatAccount.id, debit: parsedAmount, credit: 0, description: `Zakat disbursement - ${beneficiary.name}` },
          { accountId: debitAccountId, debit: 0, credit: parsedAmount, description: `Zakat payment - ${cardNumber}` }
        ],
        ipAddress: req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"]
      });
      const card = await tx.zakatCard.create({
        data: {
          beneficiaryId,
          memberId: null,
          zakatAmount: parsedAmount,
          issueDate: issueDate ? new Date(issueDate) : /* @__PURE__ */ new Date(),
          cardNumber,
          paymentMethod: paymentMethod || "CASH",
          bankAccountId: bankAccountId || null,
          journalEntryId: postingResult.journalEntry.id,
          createdById: req.user.id
        },
        include: { beneficiary: true, member: true }
      });
      return card;
    }
    await logAudit(
      req.user.id,
      "Issue Zakat Card",
      "ZAKAT_CARD",
      null,
      result,
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
    return res.status(201).json({ status: 201, data: result, message: "Zakat card issued successfully" });
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isSuperAdmin(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can permanently delete records", status: 403 } });
    }
    const targetId = id || req.body?.id;
    if (!targetId) return res.status(400).json({ error: { message: "Card ID is required", status: 400 } });
    const card = await prisma.zakatCard.findUnique({ where: { id: targetId } });
    if (!card) return res.status(404).json({ error: { message: "Zakat card not found", status: 404 } });
    await prisma.$transaction(async (tx) => {
      if (card.journalEntryId) {
        try {
          if (isPermanent) {
            await AccountingService.deleteJournalEntry(tx, card.journalEntryId, req.user.id, "Deleted Zakat Card Permanently");
          } else {
            await tx.journalEntry.update({
              where: { id: card.journalEntryId },
              data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
            });
            await AccountingService.recalculateBalancesForJournalEntry(tx, card.journalEntryId);
          }
        } catch (e) {
        }
      }
      if (isPermanent) {
        await tx.zakatCard.delete({ where: { id: targetId } });
      } else {
        await tx.zakatCard.update({
          where: { id: targetId },
          data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
        });
      }
    });
    await logAudit(
      req.user.id,
      isPermanent ? "Permanent Delete Zakat Card" : "Delete Zakat Card",
      "ZAKAT_CARD",
      card,
      null,
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
    return res.status(200).json({ status: 200, message: "Zakat card deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method not allowed", status: 405 } });
});
export {
  zakat_cards_default as default
};
