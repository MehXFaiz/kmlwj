import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { PERMS } from "../_constants/permissions.js";
function getFinancialYearFromDate(dateInput) {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 7) {
    return `FY ${year}-${year + 1}`;
  } else {
    return `FY ${year - 1}-${year}`;
  }
}
const TARGET_GL_CODES = [
  "1010101",
  // National Bank of Pakistan
  "1010102",
  // NBP Zakat Bank
  "1010103",
  // Cash in Hand
  "1010104",
  // Petty Cash
  "1010301",
  // Advances & Loans
  "1010201"
  // Accounts Receivable
];
async function getOrCreateOpeningEquityAccount(tx) {
  let equityAcc = await tx.account.findFirst({
    where: {
      isDeleted: false,
      OR: [
        { glCode: "3030101" },
        { glCode: "5010101" },
        { accountName: { contains: "Opening Equity", mode: "insensitive" } },
        { accountName: { contains: "Retained Earnings", mode: "insensitive" } },
        { accountType: { name: { equals: "EQUITY", mode: "insensitive" } } }
      ]
    },
    orderBy: { glCode: "asc" }
  });
  if (!equityAcc) {
    let equityType = await tx.accountType.findFirst({
      where: { name: { equals: "EQUITY", mode: "insensitive" } }
    });
    if (!equityType) {
      equityType = await tx.accountType.create({
        data: {
          name: "EQUITY",
          description: "Residual interest in assets after deducting liabilities"
        }
      });
    }
    equityAcc = await tx.account.create({
      data: {
        glCode: "3030101",
        accountName: "Opening Equity / Retained Earnings",
        accountLevel: "GL",
        accountTypeId: equityType.id,
        detailType: "Equity",
        description: "System equity balancing account for financial year opening balances",
        currency: "PKR",
        initialBalance: 0,
        currentBalance: 0,
        isSystemDefined: true,
        subsidiary: ["Global"]
      }
    });
  }
  return equityAcc;
}
var opening_balances_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  if (method === "GET") {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS) && !await verifyPermission(req, res, PERMS.POST_JOURNAL)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions to view opening balances", status: 403 } });
    }
    const { date, financialYear: fyParam } = req.query;
    const selectedDate = date ? new Date(date) : /* @__PURE__ */ new Date();
    const financialYear = fyParam || getFinancialYearFromDate(selectedDate);
    const batch = await prisma.openingBalanceBatch.findUnique({
      where: { financialYear },
      include: {
        lines: {
          include: { account: true }
        },
        journalEntry: {
          include: {
            lines: { include: { account: true } }
          }
        }
      }
    });
    const targetAccountsList = await prisma.account.findMany({
      where: {
        glCode: { in: TARGET_GL_CODES },
        isDeleted: false
      },
      include: { accountType: true }
    });
    const targetAccountMap = {};
    for (const code of TARGET_GL_CODES) {
      const acc = targetAccountsList.find((a) => a.glCode === code);
      const line = batch?.lines.find((l) => l.accountId === acc?.id);
      targetAccountMap[code] = {
        id: acc?.id || null,
        glCode: code,
        accountName: acc?.accountName || null,
        detailType: acc?.detailType || null,
        amount: line ? Number(line.amount) : 0,
        configured: !!acc
      };
    }
    return res.status(200).json({
      status: 200,
      data: {
        financialYear,
        openingDate: batch?.openingDate ? batch.openingDate.toISOString().split("T")[0] : selectedDate.toISOString().split("T")[0],
        batch: batch ? {
          id: batch.id,
          openingDate: batch.openingDate,
          financialYear: batch.financialYear,
          status: batch.status,
          journalEntryId: batch.journalEntryId,
          voucherNo: batch.journalEntry?.voucherNo,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt
        } : null,
        accounts: targetAccountMap
      }
    });
  }
  if (method === "POST") {
    if (!await verifyPermission(req, res, PERMS.POST_JOURNAL)) {
      return res.status(403).json({ error: { message: "Forbidden: Only authorized administrators can save opening balances", status: 403 } });
    }
    const { openingDate, balances } = req.body || {};
    if (!openingDate || isNaN(Date.parse(openingDate))) {
      return res.status(400).json({ error: { message: "Valid opening balance date is required", status: 400 } });
    }
    if (!balances || typeof balances !== "object") {
      return res.status(400).json({ error: { message: "Opening balance amounts object is required", status: 400 } });
    }
    const financialYear = getFinancialYearFromDate(openingDate);
    const parsedDate = new Date(openingDate);
    const targetAccounts = await prisma.account.findMany({
      where: {
        glCode: { in: TARGET_GL_CODES },
        isDeleted: false
      }
    });
    const missingAccounts = TARGET_GL_CODES.filter((code) => !targetAccounts.some((a) => a.glCode === code));
    if (missingAccounts.length > 0) {
      return res.status(400).json({
        error: {
          message: `Required account is not configured in Chart of Accounts (missing GL: ${missingAccounts.join(", ")}).`,
          status: 400
        }
      });
    }
    const accountAmountPairs = [];
    let totalDebit = new Prisma.Decimal(0);
    for (const code of TARGET_GL_CODES) {
      const rawVal = balances[code] ?? 0;
      const numVal = Number(rawVal);
      if (isNaN(numVal) || numVal < 0) {
        return res.status(400).json({ error: { message: `Opening balance amount for GL ${code} must be a valid non-negative number`, status: 400 } });
      }
      const account = targetAccounts.find((a) => a.glCode === code);
      const decAmount = new Prisma.Decimal(numVal);
      accountAmountPairs.push({ account, amount: decAmount });
      totalDebit = totalDebit.plus(decAmount);
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const equityAccount = await getOrCreateOpeningEquityAccount(tx);
        const existingBatch = await tx.openingBalanceBatch.findUnique({
          where: { financialYear },
          include: { journalEntry: true }
        });
        const oldValues = existingBatch ? {
          batchId: existingBatch.id,
          journalEntryId: existingBatch.journalEntryId,
          financialYear: existingBatch.financialYear
        } : null;
        if (existingBatch) {
          await tx.openingBalanceLine.deleteMany({
            where: { batchId: existingBatch.id }
          });
          await tx.journalEntry.update({
            where: { id: existingBatch.journalEntryId },
            data: {
              isDeleted: true,
              deletedAt: /* @__PURE__ */ new Date(),
              deletedBy: req.user.id
            }
          });
          await AccountingService.recalculateBalancesForJournalEntry(tx, existingBatch.journalEntryId);
        }
        const journalLinesPayload = [];
        for (const { account, amount } of accountAmountPairs) {
          if (amount.greaterThan(0)) {
            journalLinesPayload.push({
              accountId: account.id,
              description: `Opening Balance (${account.accountName}) - ${financialYear}`,
              debit: amount.toNumber(),
              credit: 0
            });
          }
        }
        if (totalDebit.greaterThan(0)) {
          journalLinesPayload.push({
            accountId: equityAccount.id,
            description: `Opening Equity Balancing Entry - ${financialYear}`,
            debit: 0,
            credit: totalDebit.toNumber()
          });
        }
        const sumDebit = journalLinesPayload.reduce((s, l) => s + l.debit, 0);
        const sumCredit = journalLinesPayload.reduce((s, l) => s + l.credit, 0);
        const diff = Math.abs(sumDebit - sumCredit);
        if (diff > 0.01) {
          throw new Error(`Opening balances are not balanced. Total Debit: PKR ${sumDebit.toFixed(2)}, Total Credit: PKR ${sumCredit.toFixed(2)}, Difference: PKR ${diff.toFixed(2)}.`);
        }
        const yearSuffix = parsedDate.getFullYear().toString();
        const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const voucherNo = `OP-${yearSuffix}-${randStr}`;
        const refStr = `OPENING-BALANCE-${yearSuffix}`;
        const journalEntry = await tx.journalEntry.create({
          data: {
            voucherNo,
            postingDate: parsedDate,
            subsidiary: "Global",
            reference: refStr,
            description: `Opening Balances - ${financialYear}`,
            postedBy: req.user.fullName || "Administrator",
            status: "Posted",
            voucherType: "JV",
            lines: {
              create: journalLinesPayload.map((l) => ({
                accountId: l.accountId,
                description: l.description,
                debit: l.debit,
                credit: l.credit
              }))
            }
          }
        });
        let batchRecord;
        if (existingBatch) {
          batchRecord = await tx.openingBalanceBatch.update({
            where: { id: existingBatch.id },
            data: {
              openingDate: parsedDate,
              journalEntryId: journalEntry.id,
              status: "Posted",
              createdBy: req.user.id,
              lines: {
                create: accountAmountPairs.map((p) => ({
                  accountId: p.account.id,
                  amount: p.amount
                }))
              }
            },
            include: { lines: true }
          });
        } else {
          batchRecord = await tx.openingBalanceBatch.create({
            data: {
              openingDate: parsedDate,
              financialYear,
              journalEntryId: journalEntry.id,
              status: "Posted",
              createdBy: req.user.id,
              lines: {
                create: accountAmountPairs.map((p) => ({
                  accountId: p.account.id,
                  amount: p.amount
                }))
              }
            },
            include: { lines: true }
          });
        }
        await AccountingService.recalculateBalancesForJournalEntry(tx, journalEntry.id);
        const newValues = {
          batchId: batchRecord.id,
          financialYear: batchRecord.financialYear,
          openingDate: batchRecord.openingDate,
          journalEntryId: journalEntry.id,
          totalDebit: totalDebit.toNumber()
        };
        await logAudit(
          req.user.id,
          existingBatch ? "Update Opening Balances" : "Create Opening Balances",
          "FINANCIAL",
          oldValues,
          newValues,
          req.headers["x-forwarded-for"],
          req.headers["user-agent"]
        );
        return { batch: batchRecord, journalEntry, totalDebit: totalDebit.toNumber() };
      });
      return res.status(200).json({
        status: 200,
        message: `Opening balances for ${financialYear} saved successfully!`,
        data: result
      });
    } catch (err) {
      return res.status(400).json({
        error: {
          message: err.message || "Failed to save opening balances",
          status: 400
        }
      });
    }
  }
});
export {
  opening_balances_default as default,
  getFinancialYearFromDate
};
