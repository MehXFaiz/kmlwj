import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { FinancialYearService, parseFinancialYearCode } from "../_services/financial-year.service.js";
import { isPrivilegedUser } from "../_services/permission.service.js";
import { PERMS } from "../_constants/permissions.js";
function getFinancialYearFromDate(dateInput) {
  const d = new Date(dateInput);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  if (month >= 7) {
    return `FY ${year}-${year + 1}`;
  } else {
    return `FY ${year - 1}-${year}`;
  }
}
const PRIMARY_GL_CODES = [
  "1010101",
  // National Bank of Pakistan
  "1010105",
  // HBL Bank Account
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
        { glCode: "3010199" },
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
    if (!await verifyPermission(req, res, ["openingBalances.view", PERMS.VIEW_REPORTS])) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions to view opening balances", status: 403 } });
    }
    const { date, financialYear: fyParam } = req.query;
    const selectedDate = date ? new Date(date) : /* @__PURE__ */ new Date();
    const financialYear = fyParam ? fyParam.startsWith("FY ") ? fyParam : `FY ${fyParam}` : getFinancialYearFromDate(selectedDate);
    const batch = await prisma.openingBalanceBatch.findUnique({
      where: { financialYear },
      include: {
        lines: {
          include: { account: { include: { accountType: true } } }
        },
        journalEntry: {
          include: {
            lines: { include: { account: true } }
          }
        }
      }
    });
    const { startYear } = parseFinancialYearCode(financialYear);
    const prevFyCode = `FY ${startYear - 1}-${startYear}`;
    const previousFyRecord = await prisma.financialYear.findFirst({
      where: { code: prevFyCode }
    });
    const previousBatchRecord = await prisma.openingBalanceBatch.findFirst({
      where: { financialYear: prevFyCode }
    });
    const hasPreviousYear = Boolean(previousFyRecord || previousBatchRecord);
    const allBsAccounts = await prisma.account.findMany({
      where: {
        isDeleted: false,
        accountLevel: "GL"
      },
      include: { accountType: true },
      orderBy: { glCode: "asc" }
    });
    const primaryAccountsMap = {};
    const allAccountsList = [];
    const seenGlCodes = /* @__PURE__ */ new Set();
    for (const acc of allBsAccounts) {
      const glCode = String(acc.glCode || "").trim();
      if (!glCode || seenGlCodes.has(glCode)) {
        continue;
      }
      seenGlCodes.add(glCode);
      const line = batch?.lines.find((l) => l.accountId === acc.id || l.glCode === acc.glCode);
      const amt = line ? Number(line.amount) : Number(acc.initialBalance || 0);
      const accData = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        detailType: acc.detailType,
        accountType: acc.accountType?.name || "Asset",
        amount: amt,
        debitCredit: line?.debitCredit || (["ASSET", "ASSETS"].includes(acc.accountType?.name?.toUpperCase() || "") ? "DEBIT" : "CREDIT"),
        sourceClosingBalance: line?.sourceClosingBalance ? Number(line.sourceClosingBalance) : null
      };
      if (PRIMARY_GL_CODES.includes(acc.glCode)) {
        primaryAccountsMap[acc.glCode] = accData;
      }
      allAccountsList.push(accData);
    }
    return res.status(200).json({
      status: 200,
      data: {
        financialYear,
        openingDate: batch?.openingDate ? batch.openingDate.toISOString().split("T")[0] : `${startYear}-07-01`,
        hasPreviousYear,
        previousFinancialYear: prevFyCode,
        isAutoRolled: batch?.isAutoRolled ?? false,
        isLocked: (batch?.isAutoRolled ?? false) || Boolean(batch?.id),
        sourceFinancialYear: batch?.sourceFinancialYear ?? null,
        sourceClosingDate: batch?.sourceClosingDate ? batch.sourceClosingDate.toISOString().split("T")[0] : null,
        adjustmentReason: batch?.adjustmentReason ?? null,
        batch: batch ? {
          id: batch.id,
          openingDate: batch.openingDate.toISOString().split("T")[0],
          financialYear: batch.financialYear,
          sourceFinancialYear: batch.sourceFinancialYear,
          sourceClosingDate: batch.sourceClosingDate ? batch.sourceClosingDate.toISOString().split("T")[0] : null,
          isAutoRolled: batch.isAutoRolled,
          adjustmentReason: batch.adjustmentReason,
          adjustedAt: batch.adjustedAt,
          status: batch.status,
          journalEntryId: batch.journalEntryId,
          voucherNo: batch.journalEntry?.voucherNo,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt
        } : null,
        accounts: primaryAccountsMap,
        allAccounts: allAccountsList
      }
    });
  }
  if (method === "POST") {
    if (!await verifyPermission(req, res, ["openingBalances.create", "openingBalances.update", PERMS.POST_JOURNAL])) {
      return res.status(403).json({ error: { message: "Forbidden: Only authorized administrators can save opening balances", status: 403 } });
    }
    const { openingDate, balances, isAdjustment, reason } = req.body || {};
    if (!openingDate || isNaN(Date.parse(openingDate))) {
      return res.status(400).json({ error: { message: "Valid opening balance date is required", status: 400 } });
    }
    if (!balances || typeof balances !== "object") {
      return res.status(400).json({ error: { message: "Opening balance amounts object is required", status: 400 } });
    }
    const rawFy = getFinancialYearFromDate(openingDate);
    const financialYear = req.body.financialYear ? req.body.financialYear.startsWith("FY ") ? req.body.financialYear : `FY ${req.body.financialYear}` : rawFy;
    const parsedDate = new Date(openingDate);
    const accountKeys = Object.keys(balances);
    const accounts = await prisma.account.findMany({
      where: {
        OR: [
          { id: { in: accountKeys.filter((k) => k.length === 36) } },
          { glCode: { in: accountKeys } }
        ],
        isDeleted: false
      },
      include: { accountType: true }
    });
    if (accounts.length === 0) {
      return res.status(400).json({ error: { message: "No valid accounts specified in opening balances payload.", status: 400 } });
    }
    const preCheckBatch = await prisma.openingBalanceBatch.findUnique({
      where: { financialYear },
      include: { journalEntry: true }
    });
    if (preCheckBatch) {
      const isPrivileged = await isPrivilegedUser(req);
      const userRole = (req.user?.role || "").toLowerCase();
      const isAdmin = isPrivileged || userRole === "admin" || userRole === "super admin";
      if (!isAdmin) {
        return res.status(403).json({
          error: {
            message: "Opening balances are locked after initial setup. Only an Administrator can add or modify amounts.",
            status: 403
          }
        });
      }
    }
    if (preCheckBatch?.isAutoRolled && !isAdjustment) {
      return res.status(400).json({
        error: {
          message: `Opening balances for ${financialYear} were automatically rolled forward from ${preCheckBatch.sourceFinancialYear}. Silent modification is not allowed. Please use the "Adjust Opening Balance" action with an explicit reason.`,
          status: 400
        }
      });
    }
    if (isAdjustment && (!reason || reason.trim().length < 5)) {
      return res.status(400).json({ error: { message: "An explicit adjustment reason (at least 5 characters) is required when modifying opening balances.", status: 400 } });
    }
    const uniqueAccountsByGl = /* @__PURE__ */ new Map();
    for (const acc of accounts) {
      const gl = String(acc.glCode || "").trim();
      if (!gl) continue;
      if (!uniqueAccountsByGl.has(gl)) {
        uniqueAccountsByGl.set(gl, acc);
      }
    }
    const uniqueAccounts = Array.from(uniqueAccountsByGl.values());
    const accountAmountPairs = [];
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const acc of uniqueAccounts) {
      const key = balances[acc.id] !== void 0 ? acc.id : acc.glCode;
      const rawVal = balances[key] ?? 0;
      const numVal = Number(rawVal);
      if (isNaN(numVal) || numVal < 0) {
        return res.status(400).json({ error: { message: `Opening balance for ${acc.accountName} must be a valid non-negative number`, status: 400 } });
      }
      const decAmount = new Prisma.Decimal(numVal);
      if (decAmount.gt(0)) {
        const typeName = (acc.accountType?.name || "").toUpperCase();
        const isDebitNormal = ["ASSET", "ASSETS", "EXPENSE", "EXPENSES"].includes(typeName);
        const dc = isDebitNormal ? "DEBIT" : "CREDIT";
        if (dc === "DEBIT") totalDebit = totalDebit.plus(decAmount);
        else totalCredit = totalCredit.plus(decAmount);
        accountAmountPairs.push({ account: acc, amount: decAmount, debitCredit: dc });
      }
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const equityAccount = await getOrCreateOpeningEquityAccount(tx);
        const existingBatch = await tx.openingBalanceBatch.findUnique({
          where: { financialYear },
          include: {
            lines: true,
            journalEntry: true
          }
        });
        const oldValues = existingBatch ? {
          batchId: existingBatch.id,
          journalEntryId: existingBatch.journalEntryId,
          financialYear: existingBatch.financialYear
        } : null;
        if (existingBatch?.journalEntryId) {
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
        for (const { account, amount, debitCredit } of accountAmountPairs) {
          journalLinesPayload.push({
            accountId: account.id,
            description: `Opening Balance (${account.accountName}) - ${financialYear}`,
            debit: debitCredit === "DEBIT" ? amount.toNumber() : 0,
            credit: debitCredit === "CREDIT" ? amount.toNumber() : 0
          });
        }
        const netDiff = totalDebit.minus(totalCredit);
        if (!netDiff.isZero()) {
          if (netDiff.gt(0)) {
            journalLinesPayload.push({
              accountId: equityAccount.id,
              description: `Opening Equity Balancing Entry - ${financialYear}`,
              debit: 0,
              credit: netDiff.toNumber()
            });
          } else {
            journalLinesPayload.push({
              accountId: equityAccount.id,
              description: `Opening Equity Balancing Entry - ${financialYear}`,
              debit: netDiff.abs().toNumber(),
              credit: 0
            });
          }
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
            description: isAdjustment ? `Adjusted Opening Balances - ${financialYear}: ${reason}` : `Opening Balances - ${financialYear}`,
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
              adjustmentReason: isAdjustment ? reason : existingBatch.adjustmentReason,
              adjustedById: isAdjustment ? req.user.id : existingBatch.adjustedById,
              adjustedAt: isAdjustment ? /* @__PURE__ */ new Date() : existingBatch.adjustedAt,
              createdBy: req.user.id
            }
          });
          const existingLines = existingBatch.lines || [];
          const existingLineByAccId = /* @__PURE__ */ new Map();
          const existingLineByGl = /* @__PURE__ */ new Map();
          for (const l of existingLines) {
            existingLineByAccId.set(l.accountId, l);
            if (l.glCode) existingLineByGl.set(l.glCode, l);
          }
          const activeAccountIds = /* @__PURE__ */ new Set();
          for (const p of accountAmountPairs) {
            activeAccountIds.add(p.account.id);
            const existingLine = existingLineByAccId.get(p.account.id) || existingLineByGl.get(p.account.glCode);
            if (existingLine) {
              await tx.openingBalanceLine.update({
                where: { id: existingLine.id },
                data: {
                  accountId: p.account.id,
                  glCode: p.account.glCode,
                  debitCredit: p.debitCredit,
                  amount: p.amount.toNumber()
                }
              });
            } else {
              await tx.openingBalanceLine.create({
                data: {
                  batchId: existingBatch.id,
                  accountId: p.account.id,
                  glCode: p.account.glCode,
                  debitCredit: p.debitCredit,
                  amount: p.amount.toNumber()
                }
              });
            }
          }
          const linesToDelete = existingLines.filter(
            (l) => !activeAccountIds.has(l.accountId) && (!l.glCode || !accountAmountPairs.some((p) => p.account.glCode === l.glCode))
          );
          if (linesToDelete.length > 0) {
            await tx.openingBalanceLine.deleteMany({
              where: { id: { in: linesToDelete.map((l) => l.id) } }
            });
          }
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
                  glCode: p.account.glCode,
                  debitCredit: p.debitCredit,
                  amount: p.amount.toNumber()
                }))
              }
            }
          });
        }
        const finalBatch = await tx.openingBalanceBatch.findUnique({
          where: { id: batchRecord.id },
          include: { lines: true }
        });
        await FinancialYearService.getOrCreateYearByCode(financialYear, tx);
        await AccountingService.recalculateBalancesForJournalEntry(tx, journalEntry.id);
        const newValues = {
          batchId: batchRecord.id,
          financialYear: batchRecord.financialYear,
          openingDate: batchRecord.openingDate,
          journalEntryId: journalEntry.id,
          totalDebit: totalDebit.toNumber(),
          isAdjustment: Boolean(isAdjustment),
          reason: reason || null
        };
        await logAudit(
          req.user.id,
          isAdjustment ? "Opening Balance Adjustment" : existingBatch ? "Update Opening Balances" : "Create Opening Balances",
          "FINANCIAL",
          oldValues,
          newValues,
          req.headers["x-forwarded-for"],
          req.headers["user-agent"]
        );
        return { batch: finalBatch, journalEntry, totalDebit: totalDebit.toNumber() };
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
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  opening_balances_default as default,
  getFinancialYearFromDate
};
