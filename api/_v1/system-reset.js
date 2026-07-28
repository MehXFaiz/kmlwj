import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin } from "../_utils/soft-delete.js";
var system_reset_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  if (!await verifyPermission(req, res, PERMS.SYSTEM_SETTINGS) && !await isSuperAdmin(req)) {
    return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can reset system financial data", status: 403 } });
  }
  try {
    const results = await prisma.$transaction(async (tx) => {
      const zcCount = await tx.zakatCard.deleteMany({});
      const jelCount = await tx.journalEntryLine.deleteMany({});
      const jeCount = await tx.journalEntry.deleteMany({});
      const donGivenCount = await tx.donation.deleteMany({});
      const donRecvCount = await tx.donationReceived.deleteMany({});
      const seCount = await tx.simpleExpense.deleteMany({});
      const siCount = await tx.simpleIncome.deleteMany({});
      const rcCount = await tx.revenueCollection.deleteMany({});
      const invItemCount = await tx.invoiceItem.deleteMany({});
      const invCount = await tx.invoice.deleteMany({});
      const hbCount = await tx.hallBooking.deleteMany({});
      const accUpdate = await tx.account.updateMany({
        data: {
          initialBalance: 0,
          currentBalance: 0
        }
      });
      const revHeadUpdate = await tx.revenueHead.updateMany({
        data: { amount: 0 }
      });
      return {
        zcCount: zcCount.count,
        jelCount: jelCount.count,
        jeCount: jeCount.count,
        donGivenCount: donGivenCount.count,
        donRecvCount: donRecvCount.count,
        seCount: seCount.count,
        siCount: siCount.count,
        rcCount: rcCount.count,
        invItemCount: invItemCount.count,
        invCount: invCount.count,
        hbCount: hbCount.count,
        accCount: accUpdate.count,
        revHeadCount: revHeadUpdate.count
      };
    }, { timeout: 6e4 });
    await logAudit(
      req.user.id,
      "Reset System Financial Data",
      "SYSTEM_SETTINGS",
      null,
      results,
      req.headers["x-forwarded-for"],
      req.headers["user-agent"]
    );
    const message = "System financial data has been successfully reset.\n\nAll calculations are now starting from zero.\n\nMaster data has been preserved.";
    return res.status(200).json({
      status: 200,
      message,
      data: results
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        message: "Failed to reset financial data",
        details: error?.message,
        status: 500
      }
    });
  }
});
export {
  system_reset_default as default
};
