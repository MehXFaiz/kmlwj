import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { PERMS } from "../_constants/permissions.js";
import { FinancialYearService } from "../_services/financial-year.service.js";
var financial_years_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method, query, body } = req;
  const action = query.action || body?.action || "";
  if (method === "GET") {
    if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) {
      return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
    }
    const years = await FinancialYearService.getOrCreateFinancialYears();
    const batches = await prisma.openingBalanceBatch.findMany({
      include: {
        lines: { include: { account: true } },
        journalEntry: { select: { voucherNo: true, status: true } }
      }
    });
    const batchMap = new Map(batches.map((b) => [b.financialYear, b]));
    const formattedYears = years.map((fy) => {
      const batch = batchMap.get(fy.code);
      return {
        id: fy.id,
        code: fy.code,
        name: fy.name,
        startDate: fy.startDate.toISOString().split("T")[0],
        endDate: fy.endDate.toISOString().split("T")[0],
        isClosed: fy.isClosed,
        closedAt: fy.closedAt,
        reopenedAt: fy.reopenedAt,
        closingNotes: fy.closingNotes,
        batch: batch ? {
          id: batch.id,
          openingDate: batch.openingDate.toISOString().split("T")[0],
          isAutoRolled: batch.isAutoRolled,
          sourceFinancialYear: batch.sourceFinancialYear,
          sourceClosingDate: batch.sourceClosingDate ? batch.sourceClosingDate.toISOString().split("T")[0] : null,
          adjustmentReason: batch.adjustmentReason,
          status: batch.status,
          voucherNo: batch.journalEntry?.voucherNo,
          linesCount: batch.lines.length
        } : null
      };
    });
    return res.status(200).json({
      status: 200,
      data: {
        financialYears: formattedYears
      }
    });
  }
  if (method === "POST") {
    const targetAction = action || body.action || "validate";
    if (targetAction === "validate") {
      if (!await verifyPermission(req, res, PERMS.VIEW_REPORTS)) {
        return res.status(403).json({ error: { message: "Forbidden: Insufficient permissions", status: 403 } });
      }
      const financialYear = body.financialYear || query.financialYear;
      if (!financialYear) {
        return res.status(400).json({ error: { message: "Financial year parameter is required for validation.", status: 400 } });
      }
      try {
        const validation = await FinancialYearService.validateYearEndClosing(financialYear);
        return res.status(200).json({ status: 200, data: validation });
      } catch (err) {
        return res.status(400).json({ error: { message: err.message || "Validation failed", status: 400 } });
      }
    }
    if (targetAction === "close") {
      if (!await verifyPermission(req, res, PERMS.POST_JOURNAL) && req.user.role !== "Super Admin" && req.user.role !== "Admin") {
        return res.status(403).json({ error: { message: "Forbidden: Only administrators can execute year-end closing", status: 403 } });
      }
      const { financialYear, closingDate, notes } = body || {};
      if (!financialYear || !closingDate) {
        return res.status(400).json({ error: { message: "Financial year and closing date are required.", status: 400 } });
      }
      try {
        const result = await FinancialYearService.executeYearEndClosing(
          financialYear,
          closingDate,
          req.user.id,
          notes
        );
        return res.status(200).json({
          status: 200,
          message: `Financial Year ${result.closedFinancialYear} closed successfully! Closing balances rolled forward to ${result.nextFinancialYear}.`,
          data: result
        });
      } catch (err) {
        return res.status(400).json({ error: { message: err.message || "Year-end closing failed.", status: 400 } });
      }
    }
    if (targetAction === "reopen") {
      if (req.user.role !== "Super Admin" && req.user.role !== "Admin") {
        return res.status(403).json({ error: { message: "Forbidden: Only Administrators can reopen closed financial years.", status: 403 } });
      }
      const { financialYear, reason } = body || {};
      if (!financialYear || !reason) {
        return res.status(400).json({ error: { message: "Financial year and reopening reason are required.", status: 400 } });
      }
      try {
        const result = await FinancialYearService.reopenFinancialYear(financialYear, req.user.id, reason);
        return res.status(200).json({
          status: 200,
          message: `Financial Year ${financialYear} has been reopened successfully.`,
          data: result
        });
      } catch (err) {
        return res.status(400).json({ error: { message: err.message || "Reopening financial year failed.", status: 400 } });
      }
    }
    if (targetAction === "adjust") {
      if (!await verifyPermission(req, res, PERMS.POST_JOURNAL)) {
        return res.status(403).json({ error: { message: "Forbidden: Only authorized users can adjust opening balances", status: 403 } });
      }
      const { batchId, balances, reason } = body || {};
      if (!batchId || !balances || !reason) {
        return res.status(400).json({ error: { message: "Batch ID, balances object, and adjustment reason are required.", status: 400 } });
      }
      try {
        const result = await FinancialYearService.adjustOpeningBalance(batchId, balances, req.user.id, reason);
        return res.status(200).json({
          status: 200,
          message: "Opening balance adjusted successfully with audit trail entry.",
          data: result
        });
      } catch (err) {
        return res.status(400).json({ error: { message: err.message || "Adjustment failed.", status: 400 } });
      }
    }
    return res.status(400).json({ error: { message: "Unknown action specified.", status: 400 } });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  financial_years_default as default
};
