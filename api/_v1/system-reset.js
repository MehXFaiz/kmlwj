import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { isSuperAdmin } from "../_utils/soft-delete.js";
import bcrypt from "bcryptjs";
var system_reset_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const userIsSuperAdmin = req.user.role === "Super Admin" || await isSuperAdmin(req);
  if (!userIsSuperAdmin) {
    return res.status(403).json({
      error: {
        message: "Forbidden: Only Super Admin can access and execute ERP System Data Reset.",
        status: 403
      }
    });
  }
  const { password, confirmationText, resetMode = "TRANSACTIONS_ONLY", resetSequences = false } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: { message: "Super Admin password re-authentication is required", status: 400 } });
  }
  if (!confirmationText || confirmationText.trim() !== "RESET ERP DATA") {
    return res.status(400).json({ error: { message: 'Invalid confirmation text. You must type "RESET ERP DATA" exactly.', status: 400 } });
  }
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user.id }
  });
  if (!currentUser) {
    return res.status(401).json({ error: { message: "Authenticated user not found", status: 401 } });
  }
  const isPasswordValid = await bcrypt.compare(password, currentUser.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: { message: "Invalid Super Admin password. Action cancelled.", status: 401 } });
  }
  try {
    const results = await prisma.$transaction(async (tx) => {
      const invItem = await tx.invoiceItem.deleteMany({});
      const inv = await tx.invoice.deleteMany({});
      const addInc = await tx.addIncomeRecord.deleteMany({});
      const simpInc = await tx.simpleIncome.deleteMany({});
      const simpExp = await tx.simpleExpense.deleteMany({});
      const don = await tx.donation.deleteMany({});
      const donRec = await tx.donationReceived.deleteMany({});
      const zakCard = await tx.zakatCard.deleteMany({});
      const hallBook = await tx.hallBooking.deleteMany({});
      const revColl = await tx.revenueCollection.deleteMany({});
      const pettyCashTx = await tx.pettyCashTransaction.deleteMany({});
      const pettyCashRec = await tx.pettyCashReconciliation.deleteMany({});
      const aiIssues = await tx.aiRepairIssue.deleteMany({});
      const aiLogs = await tx.aiRepairLog.deleteMany({});
      let obBatchCount = 0;
      let obLineCount = 0;
      let preservedObJeIds = [];
      if (resetMode === "FULL_FINANCIAL_RESET") {
        obLineCount = (await tx.openingBalanceLine.deleteMany({})).count;
        obBatchCount = (await tx.openingBalanceBatch.deleteMany({})).count;
      } else {
        const obBatches = await tx.openingBalanceBatch.findMany({ select: { journalEntryId: true } });
        preservedObJeIds = obBatches.map((b) => b.journalEntryId).filter(Boolean);
      }
      let jelCount = 0;
      let jeCount = 0;
      if (resetMode === "FULL_FINANCIAL_RESET") {
        jelCount = (await tx.journalEntryLine.deleteMany({})).count;
        jeCount = (await tx.journalEntry.deleteMany({})).count;
      } else {
        jelCount = (await tx.journalEntryLine.deleteMany({
          where: { journalEntryId: { notIn: preservedObJeIds } }
        })).count;
        jeCount = (await tx.journalEntry.deleteMany({
          where: { id: { notIn: preservedObJeIds } }
        })).count;
      }
      let accCount = 0;
      if (resetMode === "FULL_FINANCIAL_RESET") {
        accCount = (await tx.account.updateMany({
          data: { initialBalance: 0, currentBalance: 0 }
        })).count;
      } else {
        const accounts = await tx.account.findMany({ select: { id: true } });
        accCount = accounts.length;
        for (const acc of accounts) {
          const obLines = await tx.journalEntryLine.aggregate({
            where: { accountId: acc.id, journalEntryId: { in: preservedObJeIds } },
            _sum: { debit: true, credit: true }
          });
          const netOb = Number(obLines._sum.debit || 0) - Number(obLines._sum.credit || 0);
          await tx.account.update({
            where: { id: acc.id },
            data: { currentBalance: netOb, initialBalance: netOb }
          });
        }
      }
      const revHeadCount = (await tx.revenueHead.updateMany({ data: { amount: 0 } })).count;
      if (resetSequences) {
        try {
          await tx.$executeRawUnsafe('ALTER SEQUENCE "HallBooking_receiptNo_seq" RESTART WITH 1;');
        } catch (e) {
        }
        try {
          await tx.$executeRawUnsafe('ALTER SEQUENCE "RevenueCollection_receiptNo_seq" RESTART WITH 1;');
        } catch (e) {
        }
      }
      const remainingJEs = await tx.journalEntry.count({
        where: resetMode === "FULL_FINANCIAL_RESET" ? {} : { id: { notIn: preservedObJeIds } }
      });
      if (remainingJEs > 0) {
        throw new Error(`Accounting integrity error: ${remainingJEs} orphan journal entries remain post deletion.`);
      }
      const totals = await tx.journalEntryLine.aggregate({
        _sum: { debit: true, credit: true }
      });
      const totalDebit = Number(totals._sum.debit || 0);
      const totalCredit = Number(totals._sum.credit || 0);
      const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.01;
      if (!isBalanced) {
        throw new Error(`Accounting reconciliation failed: Total Debits (PKR ${totalDebit}) != Total Credits (PKR ${totalCredit}). Transaction rolled back.`);
      }
      return {
        resetMode,
        invItemCount: invItem.count,
        invCount: inv.count,
        addIncomeCount: addInc.count,
        simpleIncomeCount: simpInc.count,
        simpleExpenseCount: simpExp.count,
        donationGivenCount: don.count,
        donationReceivedCount: donRec.count,
        zakatCardCount: zakCard.count,
        hallBookingCount: hallBook.count,
        revenueCollectionCount: revColl.count,
        pettyCashTxCount: pettyCashTx.count,
        pettyCashRecCount: pettyCashRec.count,
        aiIssueCount: aiIssues.count,
        aiLogCount: aiLogs.count,
        obBatchCount,
        obLineCount,
        jelCount,
        jeCount,
        accCount,
        revHeadCount,
        totalDebit,
        totalCredit,
        balanced: isBalanced
      };
    }, { timeout: 6e4 });
    await logAudit(
      req.user.id,
      `ERP DATA RESET (${results.resetMode})`,
      "SYSTEM_ADMINISTRATION",
      null,
      results,
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
    return res.status(200).json({
      status: 200,
      message: `ERP System Data Reset completed successfully (${results.resetMode === "FULL_FINANCIAL_RESET" ? "Full Financial Reset" : "Transactions Only"}).`,
      data: results
    });
  } catch (error) {
    console.error("System Reset Error:", error);
    return res.status(500).json({
      error: {
        message: "ERP reset failed. No data was deleted because the database transaction was rolled back.",
        details: error?.message || "Database transaction failure",
        status: 500
      }
    });
  }
});
export {
  system_reset_default as default
};
