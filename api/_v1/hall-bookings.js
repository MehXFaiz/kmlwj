import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { enforceRestrictedRolePolicy } from "../_middlewares/rbac.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
import { PERMS } from "../_constants/permissions.js";
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from "../_utils/soft-delete.js";
function generateVoucherNumber() {
  const date = /* @__PURE__ */ new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BR-${year}${month}-${randomStr}`;
}
function normalizeTiming(t) {
  if (t == null) return null;
  const s = String(t).trim().toLowerCase();
  if (!s) return null;
  if (s === "full day" || s === "fullday" || s === "full-day") return "full day";
  return s;
}
function timingsConflict(existingTimings, requestedTimings) {
  const e = normalizeTiming(existingTimings);
  const r = normalizeTiming(requestedTimings);
  if (!e || !r) return true;
  if (e === "full day" || r === "full day") return true;
  return e === r;
}
const HALL_BOOKING_STATUSES = ["Pending", "Confirmed", "POSTED", "Cancelled", "Refunded"];
const ALLOWED_STATUS_TRANSITIONS = {
  Pending: ["Pending", "Confirmed", "POSTED", "Cancelled", "Refunded"],
  Confirmed: ["Confirmed", "POSTED", "Cancelled", "Refunded"],
  POSTED: ["POSTED", "Cancelled", "Refunded"],
  Cancelled: ["Cancelled"],
  Refunded: ["Refunded"]
};
function isKnownStatus(value) {
  return HALL_BOOKING_STATUSES.includes(value);
}
function extractHallIds(inputHallId, inputHallIds) {
  const raw = [];
  if (Array.isArray(inputHallIds)) {
    for (const item of inputHallIds) {
      if (item && typeof item === "string") raw.push(item.trim());
      else if (item && typeof item === "object" && item.hallId) raw.push(String(item.hallId).trim());
    }
  } else if (typeof inputHallIds === "string" && inputHallIds.trim()) {
    raw.push(...inputHallIds.split(",").map((s) => s.trim()).filter(Boolean));
  }
  if (typeof inputHallId === "string" && inputHallId.trim()) {
    raw.push(...inputHallId.split(",").map((s) => s.trim()).filter(Boolean));
  }
  return Array.from(new Set(raw.filter(Boolean)));
}
function getBookingHallIds(booking) {
  if (!booking) return [];
  const ids = [];
  if (Array.isArray(booking.hallIds)) {
    for (const hid of booking.hallIds) {
      if (hid && typeof hid === "string") ids.push(hid.trim());
    }
  }
  if (booking.hallId && typeof booking.hallId === "string") {
    ids.push(booking.hallId.trim());
  }
  return Array.from(new Set(ids.filter(Boolean)));
}
function getStandardHallRate(hallName) {
  const n = (hallName || "").toLowerCase();
  if (n.includes("bagh") || n.includes("hajiani") || n.includes("hajiyani") || n.includes("kareema")) return 46e3;
  if (n.includes("annexy") || n.includes("anexy") || n.includes("gosha") || n.includes("anxy")) return 36e3;
  if (n.includes("sadaya") || n.includes("sada")) return 28e3;
  if (n.includes("zikarya") || n.includes("zikriya") || n.includes("zakaria") || n.includes("zakriya")) return 28e3;
  return 28e3;
}
function buildHallRevenueCreditLines(params) {
  const { hallIds, hallAccountsMap, hallDetails, netAmount, bookerName } = params;
  if (!hallIds.length || netAmount <= 0) return [];
  if (hallIds.length === 1) {
    const hid = hallIds[0];
    const acc = hallAccountsMap.get(hid);
    const hallLabel = acc?.accountName || acc?.name || "Selected Hall";
    return [
      {
        accountId: hid,
        debit: 0,
        credit: netAmount,
        description: `Revenue: Hall Booking Receipt for ${bookerName} - ${hallLabel}`
      }
    ];
  }
  const detailList = Array.isArray(hallDetails) ? hallDetails : [];
  const weights = hallIds.map((hid) => {
    const detail = detailList.find((d) => d && d.hallId === hid);
    const explicitCharge = detail ? Number(detail.charges ?? detail.amount ?? 0) : 0;
    if (explicitCharge > 0) return explicitCharge;
    const acc = hallAccountsMap.get(hid);
    return getStandardHallRate(acc?.accountName || acc?.name || "");
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0) || hallIds.length;
  const lines = [];
  let allocatedSum = 0;
  hallIds.forEach((hid, idx) => {
    const acc = hallAccountsMap.get(hid);
    const hallLabel = acc?.accountName || acc?.name || `Hall ${idx + 1}`;
    const isLast = idx === hallIds.length - 1;
    const share = isLast ? Math.round((netAmount - allocatedSum) * 100) / 100 : Math.round(netAmount * weights[idx] / totalWeight * 100) / 100;
    allocatedSum = Math.round((allocatedSum + share) * 100) / 100;
    if (share > 0) {
      lines.push({
        accountId: hid,
        debit: 0,
        credit: share,
        description: `Revenue: Hall Booking Receipt for ${bookerName} - ${hallLabel}`
      });
    }
  });
  return lines;
}
var hall_bookings_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const method = req.method?.toUpperCase() ?? "";
  if (!await enforceRestrictedRolePolicy(req, res, method === "DELETE" ? ["hallBookings.delete", PERMS.DELETE_HALL_BOOKING] : ["hallBookings.update", PERMS.UPDATE_HALL_BOOKING])) return;
  if (method === "GET") {
    if (!await verifyPermission(req, res, ["hallBookings.view", PERMS.VIEW_HALL_BOOKINGS])) return;
  } else if (method === "POST") {
    if (!await verifyPermission(req, res, ["hallBookings.create", PERMS.CREATE_HALL_BOOKING])) return;
  } else if (method === "DELETE") {
    if (!await verifyPermission(req, res, ["hallBookings.delete", PERMS.DELETE_HALL_BOOKING])) return;
  } else if (method === "PUT" || method === "PATCH") {
    if (!await verifyPermission(req, res, ["hallBookings.update", PERMS.UPDATE_HALL_BOOKING])) return;
  }
  const action = req.query.action;
  if (method === "GET") {
    if (req.url?.includes("/check-availability") || action === "check-availability") {
      const requestedHallIds = extractHallIds(req.query.hallId, req.query.hallIds);
      const dateParam = req.query.bookingDate || req.query.programDate;
      const excludeId = req.query.excludeId;
      const requestedTimings = req.query.timings;
      if (requestedHallIds.length === 0 || !dateParam) {
        return res.status(400).json({ error: { message: "hallId (or hallIds) and bookingDate (or programDate) are required parameters", status: 400 } });
      }
      const dateOnlyStr = typeof dateParam === "string" && dateParam.includes("T") ? dateParam.split("T")[0] : typeof dateParam === "string" ? dateParam : new Date(dateParam).toISOString().split("T")[0];
      const startOfDay = /* @__PURE__ */ new Date(`${dateOnlyStr}T00:00:00.000Z`);
      const endOfDay = /* @__PURE__ */ new Date(`${dateOnlyStr}T23:59:59.999Z`);
      if (isNaN(startOfDay.getTime())) {
        return res.status(400).json({ error: { message: "Invalid date format", status: 400 } });
      }
      const sameDayBookings = await prisma.hallBooking.findMany({
        where: {
          isDeleted: false,
          programDate: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: {
            in: ["Confirmed", "Pending", "POSTED"]
          },
          id: excludeId ? { not: excludeId } : void 0
        },
        include: {
          hallAccount: true,
          createdBy: true
        }
      });
      if (typeof requestedTimings === "undefined") {
        return res.status(200).json({ available: true });
      }
      const conflictBooking = sameDayBookings.find((b) => {
        const existingHallIds = getBookingHallIds(b);
        const hallOverlap = existingHallIds.some((hid) => requestedHallIds.includes(hid));
        return hallOverlap && timingsConflict(b.timings, requestedTimings);
      });
      if (conflictBooking) {
        const existingHallIds = getBookingHallIds(conflictBooking);
        const overlappingHallIds = existingHallIds.filter((hid) => requestedHallIds.includes(hid));
        const overlappingAccounts = await prisma.account.findMany({
          where: { id: { in: overlappingHallIds } },
          select: { id: true, accountName: true }
        });
        const conflictHallName = overlappingAccounts.length > 0 ? overlappingAccounts.map((a) => a.accountName).join(", ") : Array.isArray(conflictBooking.hallNames) && conflictBooking.hallNames.length > 0 ? conflictBooking.hallNames.join(", ") : conflictBooking.hallAccount?.accountName || "Selected Hall";
        const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
        await logAudit(
          req.user.id,
          "Duplicate Booking Attempt",
          "REVENUE",
          null,
          {
            user: req.user.fullName || req.user.email,
            hall: conflictHallName,
            bookingDate: dateParam,
            attemptedBy: req.user.id,
            ipAddress,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          },
          ipAddress,
          req.headers["user-agent"]
        );
        return res.status(200).json({
          available: false,
          bookedBy: conflictBooking.bookerName,
          bookingDate: conflictBooking.programDate.toISOString().split("T")[0],
          hallName: conflictHallName,
          conflictingHallIds: overlappingHallIds,
          receiptNo: conflictBooking.receiptNo,
          status: conflictBooking.status
        });
      }
      return res.status(200).json({ available: true });
    }
    const id = req.query.id;
    if (id && !req.query.limit) {
      const booking = await prisma.hallBooking.findUnique({
        where: { id },
        include: {
          hallAccount: true,
          bankAccount: true,
          createdBy: { select: { id: true, fullName: true, email: true } }
        }
      });
      if (!booking) return res.status(404).json({ error: { message: "Booking not found", status: 404 } });
      return res.status(200).json({ status: 200, data: booking });
    }
    const { limit = "100", page = "1", startDate, endDate, hallId } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = getDeletedFilter(req.query);
    if (hallId) {
      whereClause.OR = [
        { hallId },
        { hallIds: { has: hallId } }
      ];
    }
    if (startDate || endDate) {
      whereClause.bookingDate = {};
      if (startDate) {
        const start = /* @__PURE__ */ new Date(`${startDate}T00:00:00.000Z`);
        if (isNaN(start.getTime())) return res.status(400).json({ error: { message: "Invalid startDate format", status: 400 } });
        whereClause.bookingDate.gte = start;
      }
      if (endDate) {
        const end = /* @__PURE__ */ new Date(`${endDate}T00:00:00.000Z`);
        if (isNaN(end.getTime())) return res.status(400).json({ error: { message: "Invalid endDate format", status: 400 } });
        whereClause.bookingDate.lt = end;
      }
    }
    const [bookings, total] = await Promise.all([
      prisma.hallBooking.findMany({
        where: whereClause,
        include: {
          hallAccount: true,
          bankAccount: true,
          createdBy: { select: { id: true, fullName: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.hallBooking.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: bookings, meta: { total, page: pageNum, limit: limitNum } });
  }
  if (method === "PUT" || method === "POST" || method === "PATCH") {
    const action2 = req.query.action || req.body?.action;
    const id = req.query.id || req.body?.id;
    if (action2 === "restore") {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: "Forbidden: Only Super Admin can restore records", status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: "Booking ID is required", status: 400 } });
      }
      const existing = await prisma.hallBooking.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: "Booking not found", status: 404 } });
      }
      const restored = await prisma.hallBooking.update({
        where: { id },
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
      await logAudit(req.user.id, "Restore Hall Booking", "REVENUE", existing, restored, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, message: "Hall booking restored successfully", data: restored });
    }
  }
  if (method === "POST") {
    if (action === "approve") {
      if (!await verifyPermission(req, res, PERMS.POST_LEDGER)) return;
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: "Booking ID is required", status: 400 } });
      const booking = await prisma.hallBooking.findUnique({ where: { id }, include: { hallAccount: true } });
      if (!booking) return res.status(404).json({ error: { message: "Booking not found", status: 404 } });
      if (booking.status === "POSTED") {
        return res.status(409).json({
          error: { message: "Transaction has already been posted to the General Ledger.", status: 409 }
        });
      }
      const checkNetAmt = Number(booking.netAmount ?? booking.hallCharges ?? 0);
      const checkRecAmt = Number(booking.receivedAmount ?? 0);
      const checkRemAmt = Number(booking.remainingAmount ?? checkNetAmt - checkRecAmt);
      if (checkRemAmt > 0) {
        return res.status(400).json({
          error: { message: `Cannot post hall booking: Remaining amount must be 0 before posting to ledger. (Remaining: Rs. ${Math.round(checkRemAmt).toLocaleString()})`, status: 400 }
        });
      }
      const bookingHallIds = getBookingHallIds(booking);
      if (bookingHallIds.length === 0) return res.status(400).json({ error: { message: "Revenue account (Hall) is required to post.", status: 400 } });
      const hallAccountsList2 = await prisma.account.findMany({
        where: { id: { in: bookingHallIds } }
      });
      const hallAccountsMap2 = new Map(hallAccountsList2.map((a) => [a.id, a]));
      const hallSummaryLabel2 = Array.isArray(booking.hallNames) && booking.hallNames.length > 0 ? booking.hallNames.join(", ") : hallAccountsList2.length > 0 ? hallAccountsList2.map((a) => a.accountName).join(", ") : booking.hallAccount?.accountName || "Selected Hall";
      let debitAccountId2 = null;
      if (booking.paymentMethod === "CASH") {
        const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
        debitAccountId2 = cashAccount.id;
      } else {
        if (!booking.bankAccountId) return res.status(400).json({ error: { message: "Bank account is required for BANK/CHEQUE payments", status: 400 } });
        debitAccountId2 = booking.bankAccountId;
      }
      const result = await prisma.$transaction(async (tx) => {
        const netAmt = Number(booking.netAmount ?? booking.hallCharges);
        const recAmt = Number(booking.receivedAmount ?? 0);
        const remAmt = Number(booking.remainingAmount ?? netAmt - recAmt);
        const lines = [];
        if (recAmt > 0) {
          lines.push({
            accountId: debitAccountId2,
            debit: recAmt,
            credit: 0,
            description: `Receipt: Hall Booking Receipt for ${booking.bookerName} - ${hallSummaryLabel2}`
          });
        }
        if (remAmt > 0) {
          const arAccount = await AccountingService.getOrCreateAccountsReceivable(tx);
          lines.push({
            accountId: arAccount.id,
            debit: remAmt,
            credit: 0,
            description: `Outstanding Receivable: Hall Booking Receipt for ${booking.bookerName} - ${hallSummaryLabel2}`
          });
        }
        if (netAmt > 0) {
          lines.push(...buildHallRevenueCreditLines({
            hallIds: bookingHallIds,
            hallAccountsMap: hallAccountsMap2,
            hallDetails: booking.hallDetails,
            netAmount: netAmt,
            bookerName: booking.bookerName
          }));
        }
        let postingResult = null;
        if (lines.length > 0) {
          postingResult = await AccountingService.postTransaction(tx, {
            voucherType: "BR",
            postingDate: booking.bookingDate || /* @__PURE__ */ new Date(),
            reference: `HB-${booking.receiptNo}`,
            description: `Hall Booking Receipt for ${booking.bookerName} - ${hallSummaryLabel2}`,
            module: "Hall Booking",
            postedBy: req.user.id,
            lines,
            ipAddress: req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"]
          });
        }
        const approvedBooking = await tx.hallBooking.update({
          where: { id },
          data: {
            status: "POSTED",
            journalEntryId: postingResult ? postingResult.journalEntry.id : null
          }
        });
        return { approvedBooking, journalEntry: postingResult ? postingResult.journalEntry : null };
      });
      await logAudit(req.user.id, "POST_TO_LEDGER", "Hall Bookings", booking, result.approvedBooking, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result.approvedBooking, message: "Booking posted and journal entries created successfully" });
    }
    if (action === "revert") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: "Booking ID is required", status: 400 } });
      const booking = await prisma.hallBooking.findUnique({ where: { id } });
      if (!booking) return res.status(404).json({ error: { message: "Booking not found", status: 404 } });
      if (booking.status !== "POSTED") return res.status(400).json({ error: { message: "Booking is not posted", status: 400 } });
      const result = await prisma.$transaction(async (tx) => {
        if (booking.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, booking.journalEntryId, req.user.id, "Hall Booking Reverted");
          } catch (e) {
          }
        }
        const revertedBooking = await tx.hallBooking.update({
          where: { id },
          data: {
            status: "Pending",
            journalEntryId: null
          }
        });
        return revertedBooking;
      });
      await logAudit(req.user.id, "Revert Hall Booking", "REVENUE", booking, result, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result, message: "Booking reverted from ledger successfully" });
    }
    const { bookingDate, bookerName, fatherHusbandName, address, mobile, programDate, programType, functionType, timeFrom, timeTo, timings, hallId, hallIds: rawHallIds, hallNames: rawHallNames, hallDetails: rawHallDetails, isForJamaat, amount, hallCharges, discount, netAmount, receivedAmount, paymentMethod, bankAccountId, chequeNumber, chequeBankName, remarks } = req.body;
    if (bookerName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(bookerName))) {
      return res.status(400).json({ error: { message: "Booker name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (fatherHusbandName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherHusbandName))) {
      return res.status(400).json({ error: { message: "Father / husband name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (address && !/^[a-zA-Z0-9\s.,#/-]{3,160}$/.test(String(address))) {
      return res.status(400).json({ error: { message: "Address contains unsupported characters", status: 400 } });
    }
    if (mobile && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: "Mobile number must contain exactly 11 digits", status: 400 } });
    }
    if (chequeNumber && !/^\d{6,20}$/.test(String(chequeNumber))) {
      return res.status(400).json({ error: { message: "Cheque number must contain only digits (6-20 digits)", status: 400 } });
    }
    if (chequeBankName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(chequeBankName))) {
      return res.status(400).json({ error: { message: "Cheque bank name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    const resolvedHallIds = extractHallIds(hallId, rawHallIds);
    const primaryHallId = resolvedHallIds[0] || "";
    const rawHallCharges = hallCharges ?? amount;
    if (!bookerName || !programDate || !primaryHallId || rawHallCharges == null || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    const parsedProgramDateForValidation = new Date(programDate);
    if (isNaN(parsedProgramDateForValidation.getTime())) {
      return res.status(400).json({ error: { message: "Invalid program date", status: 400 } });
    }
    const requestedCreateStatus = req.body.status;
    if (requestedCreateStatus !== void 0 && !isKnownStatus(requestedCreateStatus)) {
      return res.status(400).json({ error: { message: `Status must be one of: ${HALL_BOOKING_STATUSES.join(", ")}`, status: 400 } });
    }
    if (requestedCreateStatus === "POSTED" && !await verifyPermission(req, res, PERMS.POST_LEDGER)) {
      return res.status(403).json({ error: { message: "Forbidden: insufficient permission to create a POSTED booking", status: 403 } });
    }
    const parsedHallCharges = Math.round(parseFloat(rawHallCharges) * 100) / 100;
    if (isNaN(parsedHallCharges) || parsedHallCharges <= 0) {
      return res.status(400).json({ error: { message: "Hall Charges must be greater than 0", status: 400 } });
    }
    const parsedDiscount = discount != null ? Math.round(parseFloat(discount) * 100) / 100 : 0;
    if (isNaN(parsedDiscount) || parsedDiscount < 0) {
      return res.status(400).json({ error: { message: "Discount cannot be negative", status: 400 } });
    }
    if (parsedDiscount > parsedHallCharges) {
      return res.status(400).json({ error: { message: "Discount cannot exceed Hall Charges", status: 400 } });
    }
    const calculatedNetAmount = Math.round((parsedHallCharges - parsedDiscount) * 100) / 100;
    const parsedReceivedAmount = receivedAmount != null ? Math.round(parseFloat(receivedAmount) * 100) / 100 : 0;
    if (isNaN(parsedReceivedAmount) || parsedReceivedAmount < 0) {
      return res.status(400).json({ error: { message: "Received Amount cannot be negative", status: 400 } });
    }
    if (parsedReceivedAmount > calculatedNetAmount) {
      return res.status(400).json({ error: { message: "Received Amount cannot exceed Net Amount", status: 400 } });
    }
    const calculatedRemainingAmount = Math.round((calculatedNetAmount - parsedReceivedAmount) * 100) / 100;
    if (requestedCreateStatus === "POSTED" && calculatedRemainingAmount > 0) {
      return res.status(400).json({ error: { message: `Cannot set status to POSTED: Remaining amount must be 0 before posting to ledger. (Remaining: Rs. ${Math.round(calculatedRemainingAmount).toLocaleString()})`, status: 400 } });
    }
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payment methods", status: 400 } });
    }
    let debitAccountId = null;
    if (paymentMethod === "CASH") {
      const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
      debitAccountId = cashAccount.id;
    } else {
      debitAccountId = bankAccountId;
    }
    const hallAccountsList = await prisma.account.findMany({
      where: { id: { in: resolvedHallIds } }
    });
    const hallAccountsMap = new Map(hallAccountsList.map((a) => [a.id, a]));
    const resolvedHallNames = Array.isArray(rawHallNames) && rawHallNames.length > 0 ? rawHallNames.map(String) : resolvedHallIds.map((hid) => hallAccountsMap.get(hid)?.accountName || "Selected Hall");
    const hallSummaryLabel = resolvedHallNames.join(", ");
    const eventDateStr = programDate || bookingDate;
    const dateOnlyStr = typeof eventDateStr === "string" && eventDateStr.includes("T") ? eventDateStr.split("T")[0] : typeof eventDateStr === "string" ? eventDateStr : new Date(eventDateStr).toISOString().split("T")[0];
    const startOfDay = /* @__PURE__ */ new Date(`${dateOnlyStr}T00:00:00.000Z`);
    const endOfDay = /* @__PURE__ */ new Date(`${dateOnlyStr}T23:59:59.999Z`);
    const sameDayBookings = await prisma.hallBooking.findMany({
      where: {
        isDeleted: false,
        programDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: ["Confirmed", "Pending", "POSTED"]
        }
      },
      include: {
        hallAccount: true
      }
    });
    if (typeof timings === "undefined") {
      return res.status(200).json({ available: true });
    }
    const conflictBooking = sameDayBookings.find((b) => {
      const existingHallIds = getBookingHallIds(b);
      const hallOverlap = existingHallIds.some((hid) => resolvedHallIds.includes(hid));
      return hallOverlap && timingsConflict(b.timings, timings);
    });
    if (conflictBooking) {
      const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
      await logAudit(
        req.user.id,
        "Duplicate Booking Attempt",
        "REVENUE",
        null,
        {
          user: req.user.fullName || req.user.email,
          hall: conflictBooking.hallAccount?.accountName || "Selected Hall",
          bookingDate: eventDateStr,
          attemptedBy: req.user.id,
          ipAddress,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        ipAddress,
        req.headers["user-agent"]
      );
      return res.status(409).json({
        success: false,
        message: "One or more selected halls are already booked for the selected date and time slot. Please choose another date, time, or hall."
      });
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const sameDayInTx = await tx.hallBooking.findMany({
          where: {
            isDeleted: false,
            programDate: { gte: startOfDay, lte: endOfDay },
            status: { in: ["Confirmed", "Pending", "POSTED"] }
          }
        });
        if (sameDayInTx.some((b) => getBookingHallIds(b).some((hid) => resolvedHallIds.includes(hid)) && timingsConflict(b.timings, timings))) {
          throw Object.assign(new Error("One or more selected halls are already booked for the selected date and time slot. Please choose another date, time, or hall."), { status: 409 });
        }
        const softDeletedSameSlot = await tx.hallBooking.findMany({
          where: {
            isDeleted: true,
            hallId: primaryHallId,
            programDate: { gte: startOfDay, lte: endOfDay },
            timings: timings || null
          },
          select: { id: true, timings: true }
        });
        for (const deletedBooking of softDeletedSameSlot) {
          await tx.hallBooking.update({
            where: { id: deletedBooking.id },
            data: { timings: `${deletedBooking.timings || "Slot"}#deleted-${deletedBooking.id.slice(0, 8)}` }
          });
        }
        const lastBooking = await tx.hallBooking.findFirst({
          orderBy: { receiptNo: "desc" },
          select: { receiptNo: true }
        });
        const parsedCustomReceiptNo = req.body.receiptNo ? parseInt(req.body.receiptNo, 10) : req.body.slipNo ? parseInt(req.body.slipNo, 10) : null;
        const receiptNo = parsedCustomReceiptNo && !isNaN(parsedCustomReceiptNo) && parsedCustomReceiptNo > 0 ? parsedCustomReceiptNo : (lastBooking?.receiptNo || 0) + 1;
        const bookingDateOnlyStr = bookingDate ? typeof bookingDate === "string" && bookingDate.includes("T") ? bookingDate.split("T")[0] : typeof bookingDate === "string" ? bookingDate : new Date(bookingDate).toISOString().split("T")[0] : null;
        const refundDateOnlyStr = req.body.refundDate ? typeof req.body.refundDate === "string" && req.body.refundDate.includes("T") ? req.body.refundDate.split("T")[0] : typeof req.body.refundDate === "string" ? req.body.refundDate : new Date(req.body.refundDate).toISOString().split("T")[0] : null;
        let newBooking = await tx.hallBooking.create({
          data: {
            receiptNo,
            bookingDate: bookingDateOnlyStr ? /* @__PURE__ */ new Date(`${bookingDateOnlyStr}T00:00:00.000Z`) : void 0,
            bookerName,
            fatherHusbandName: fatherHusbandName || null,
            address: address || null,
            mobile: mobile || null,
            programDate: /* @__PURE__ */ new Date(`${dateOnlyStr}T00:00:00.000Z`),
            programType: programType || null,
            functionType: functionType || null,
            timeFrom: timeFrom || null,
            timeTo: timeTo || null,
            timings: timings || null,
            hallId: primaryHallId,
            hallIds: resolvedHallIds,
            hallNames: resolvedHallNames,
            hallDetails: rawHallDetails || null,
            isForJamaat: Boolean(isForJamaat),
            hallCharges: parsedHallCharges,
            discount: parsedDiscount,
            netAmount: calculatedNetAmount,
            receivedAmount: parsedReceivedAmount,
            remainingAmount: calculatedRemainingAmount,
            refundAmount: req.body.refundAmount != null ? parseFloat(req.body.refundAmount) : 0,
            refundDate: refundDateOnlyStr ? /* @__PURE__ */ new Date(`${refundDateOnlyStr}T00:00:00.000Z`) : null,
            refundReason: req.body.refundReason || null,
            paymentMethod,
            bankAccountId: bankAccountId || null,
            chequeNumber: chequeNumber || null,
            chequeBankName: chequeBankName || null,
            status: req.body.status || "Confirmed",
            remarks: remarks || null,
            createdById: req.user.id
          },
          include: {
            hallAccount: true,
            journalEntry: true
          }
        });
        if (newBooking.status === "POSTED" && calculatedNetAmount > 0) {
          const lines = [];
          if (parsedReceivedAmount > 0) {
            lines.push({
              accountId: debitAccountId,
              debit: parsedReceivedAmount,
              credit: 0,
              description: `Receipt: Hall Booking Receipt for ${bookerName} - ${hallSummaryLabel}`
            });
          }
          if (calculatedRemainingAmount > 0) {
            const arAccount = await AccountingService.getOrCreateAccountsReceivable(tx);
            lines.push({
              accountId: arAccount.id,
              debit: calculatedRemainingAmount,
              credit: 0,
              description: `Outstanding Receivable: Hall Booking Receipt for ${bookerName} - ${hallSummaryLabel}`
            });
          }
          lines.push(...buildHallRevenueCreditLines({
            hallIds: resolvedHallIds,
            hallAccountsMap,
            hallDetails: rawHallDetails,
            netAmount: calculatedNetAmount,
            bookerName
          }));
          const postingResult = await AccountingService.postTransaction(tx, {
            voucherType: "BR",
            postingDate: newBooking.bookingDate || /* @__PURE__ */ new Date(),
            reference: `HB-${newBooking.receiptNo}`,
            description: `Hall Booking Receipt for ${bookerName} - ${hallSummaryLabel}`,
            module: "Hall Booking",
            postedBy: req.user.id,
            lines,
            ipAddress: req.headers["x-forwarded-for"],
            userAgent: req.headers["user-agent"]
          });
          newBooking = await tx.hallBooking.update({
            where: { id: newBooking.id },
            data: { journalEntryId: postingResult.journalEntry.id },
            include: { hallAccount: true, journalEntry: true }
          });
        }
        return newBooking;
      }, { maxWait: 15e3, timeout: 3e4 });
      await logAudit(req.user.id, "Create & Post Hall Booking", "REVENUE", null, result, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(201).json({ status: 201, data: result });
    } catch (err) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
        await logAudit(
          req.user.id,
          "Duplicate Booking Attempt",
          "REVENUE",
          null,
          {
            user: req.user.fullName || req.user.email,
            hall: hallId,
            bookingDate: programDate || bookingDate,
            attemptedBy: req.user.id,
            ipAddress,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          },
          ipAddress,
          req.headers["user-agent"]
        );
        return res.status(409).json({
          success: false,
          message: "This hall is already booked on the selected date. Please choose another date."
        });
      }
      throw err;
    }
  }
  if (method === "DELETE") {
    const isPermanent = req.query.permanent === "true" || req.query.action === "permanent_delete" || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: "Forbidden: Only Admin or Super Admin can permanently delete records", status: 403 } });
    }
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Booking ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid booking ID provided", status: 400 } });
    }
    try {
      const affectedBookings = await prisma.$transaction(async (tx) => {
        const bookings = await tx.hallBooking.findMany({
          where: { id: { in: ids } }
        });
        if (bookings.length === 0) {
          throw new Error("No hall bookings found to delete");
        }
        for (const booking of bookings) {
          if (booking.journalEntryId) {
            try {
              if (isPermanent) {
                await AccountingService.deleteJournalEntry(tx, booking.journalEntryId, req.user.id, "Hall Booking Permanently Deleted");
              } else {
                await tx.journalEntry.update({
                  where: { id: booking.journalEntryId },
                  data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
                });
                await AccountingService.recalculateBalancesForJournalEntry(tx, booking.journalEntryId);
              }
            } catch (e) {
            }
          }
        }
        if (isPermanent) {
          await tx.hallBooking.deleteMany({
            where: { id: { in: bookings.map((b) => b.id) } }
          });
        } else {
          await tx.hallBooking.updateMany({
            where: { id: { in: bookings.map((b) => b.id) } },
            data: { isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), deletedBy: req.user.id }
          });
        }
        return bookings;
      });
      await logAudit(
        req.user.id,
        isPermanent ? "Permanent Delete Hall Booking" : "Delete Hall Booking",
        "REVENUE",
        null,
        { count: affectedBookings.length, ids: affectedBookings.map((b) => b.id), permanent: isPermanent },
        req.headers["x-forwarded-for"],
        req.headers["user-agent"]
      );
      return res.status(200).json({
        status: 200,
        message: `${affectedBookings.length} hall booking(s) deleted successfully`,
        data: affectedBookings
      });
    } catch (err) {
      return res.status(400).json({ error: { message: err.message || "Failed to delete hall booking(s)", status: 400 } });
    }
  }
  if (method === "PUT") {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: { message: "Booking ID is required", status: 400 } });
    }
    const existingBooking = await prisma.hallBooking.findUnique({ where: { id } });
    if (!existingBooking) {
      return res.status(404).json({ error: { message: "Booking not found", status: 404 } });
    }
    const { bookingDate, bookerName, fatherHusbandName, address, mobile, programDate, programType, functionType, timeFrom, timeTo, timings, hallId, hallIds: rawHallIds, hallNames: rawHallNames, hallDetails: rawHallDetails, isForJamaat, amount, hallCharges, discount, receivedAmount, paymentMethod, bankAccountId, chequeNumber, chequeBankName, remarks } = req.body;
    if (bookerName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(bookerName))) {
      return res.status(400).json({ error: { message: "Booker name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (fatherHusbandName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherHusbandName))) {
      return res.status(400).json({ error: { message: "Father / husband name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    if (address && !/^[a-zA-Z0-9\s.,#/-]{3,160}$/.test(String(address))) {
      return res.status(400).json({ error: { message: "Address contains unsupported characters", status: 400 } });
    }
    if (mobile && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: "Mobile number must contain exactly 11 digits", status: 400 } });
    }
    if (chequeNumber && !/^\d{6,20}$/.test(String(chequeNumber))) {
      return res.status(400).json({ error: { message: "Cheque number must contain only digits (6-20 digits)", status: 400 } });
    }
    if (chequeBankName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(chequeBankName))) {
      return res.status(400).json({ error: { message: "Cheque bank name can only contain letters, spaces, hyphens, and dots", status: 400 } });
    }
    const resolvedHallIds = extractHallIds(hallId, rawHallIds);
    const primaryHallId = resolvedHallIds[0] || "";
    const rawHallCharges = hallCharges ?? amount;
    if (!bookerName || !programDate || !primaryHallId || rawHallCharges == null || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    const parsedProgramDateForValidationPut = new Date(programDate);
    if (isNaN(parsedProgramDateForValidationPut.getTime())) {
      return res.status(400).json({ error: { message: "Invalid program date", status: 400 } });
    }
    const requestedUpdateStatus = req.body.status;
    if (requestedUpdateStatus !== void 0 && !isKnownStatus(requestedUpdateStatus)) {
      return res.status(400).json({ error: { message: `Status must be one of: ${HALL_BOOKING_STATUSES.join(", ")}`, status: 400 } });
    }
    if (requestedUpdateStatus !== void 0 && isKnownStatus(existingBooking.status)) {
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[existingBooking.status];
      if (!allowedNext.includes(requestedUpdateStatus)) {
        return res.status(400).json({ error: { message: `Cannot change booking status from '${existingBooking.status}' to '${requestedUpdateStatus}'.`, status: 400 } });
      }
    }
    const parsedHallCharges = Math.round(parseFloat(rawHallCharges) * 100) / 100;
    if (isNaN(parsedHallCharges) || parsedHallCharges <= 0) {
      return res.status(400).json({ error: { message: "Hall Charges must be greater than 0", status: 400 } });
    }
    const parsedDiscount = discount != null ? Math.round(parseFloat(discount) * 100) / 100 : 0;
    if (isNaN(parsedDiscount) || parsedDiscount < 0) {
      return res.status(400).json({ error: { message: "Discount cannot be negative", status: 400 } });
    }
    if (parsedDiscount > parsedHallCharges) {
      return res.status(400).json({ error: { message: "Discount cannot exceed Hall Charges", status: 400 } });
    }
    const calculatedNetAmount = Math.round((parsedHallCharges - parsedDiscount) * 100) / 100;
    const parsedReceivedAmount = receivedAmount != null ? Math.round(parseFloat(receivedAmount) * 100) / 100 : 0;
    if (isNaN(parsedReceivedAmount) || parsedReceivedAmount < 0) {
      return res.status(400).json({ error: { message: "Received Amount cannot be negative", status: 400 } });
    }
    if (parsedReceivedAmount > calculatedNetAmount) {
      return res.status(400).json({ error: { message: "Received Amount cannot exceed Net Amount", status: 400 } });
    }
    const calculatedRemainingAmount = Math.round((calculatedNetAmount - parsedReceivedAmount) * 100) / 100;
    if (requestedUpdateStatus === "POSTED" && calculatedRemainingAmount > 0) {
      return res.status(400).json({ error: { message: `Cannot set status to POSTED: Remaining amount must be 0 before posting to ledger. (Remaining: Rs. ${Math.round(calculatedRemainingAmount).toLocaleString()})`, status: 400 } });
    }
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payment methods", status: 400 } });
    }
    const hallAccountsList = await prisma.account.findMany({
      where: { id: { in: resolvedHallIds } }
    });
    const hallAccountsMap = new Map(hallAccountsList.map((a) => [a.id, a]));
    const resolvedHallNames = Array.isArray(rawHallNames) && rawHallNames.length > 0 ? rawHallNames.map(String) : resolvedHallIds.map((hid) => hallAccountsMap.get(hid)?.accountName || "Selected Hall");
    const hallSummaryLabel = resolvedHallNames.join(", ");
    const eventDateStr = programDate || bookingDate;
    const dateOnlyStr = typeof eventDateStr === "string" && eventDateStr.includes("T") ? eventDateStr.split("T")[0] : typeof eventDateStr === "string" ? eventDateStr : new Date(eventDateStr).toISOString().split("T")[0];
    const startOfDay = /* @__PURE__ */ new Date(`${dateOnlyStr}T00:00:00.000Z`);
    const endOfDay = /* @__PURE__ */ new Date(`${dateOnlyStr}T23:59:59.999Z`);
    const sameDayBookingsForUpdate = await prisma.hallBooking.findMany({
      where: {
        isDeleted: false,
        programDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: ["Confirmed", "Pending", "POSTED"]
        },
        id: { not: id }
      },
      include: {
        hallAccount: true
      }
    });
    const conflictBooking = sameDayBookingsForUpdate.find((b) => {
      const existingHallIds = getBookingHallIds(b);
      const hallOverlap = existingHallIds.some((hid) => resolvedHallIds.includes(hid));
      return hallOverlap && timingsConflict(b.timings, timings);
    });
    if (conflictBooking) {
      const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
      await logAudit(
        req.user.id,
        "Duplicate Booking Attempt",
        "REVENUE",
        null,
        {
          user: req.user.fullName || req.user.email,
          hall: conflictBooking.hallAccount?.accountName || "Selected Hall",
          bookingDate: eventDateStr,
          attemptedBy: req.user.id,
          ipAddress,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        },
        ipAddress,
        req.headers["user-agent"]
      );
      return res.status(409).json({
        success: false,
        message: "One or more selected halls are already booked for the selected date and time slot. Please choose another date, time, or hall."
      });
    }
    try {
      const updatedBooking = await prisma.$transaction(async (tx) => {
        if (existingBooking.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, existingBooking.journalEntryId, req.user.id, "Reversing Hall Booking for update");
          } catch (e) {
          }
        }
        let debitAccountId = null;
        if (paymentMethod === "CASH") {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          debitAccountId = cashAccount.id;
        } else {
          debitAccountId = bankAccountId || null;
        }
        const wasPosted = existingBooking.status === "POSTED" || Boolean(existingBooking.journalEntryId);
        let newJournalEntryId = null;
        const targetStatus = req.body.status || existingBooking.status;
        if (wasPosted && debitAccountId && primaryHallId && targetStatus !== "Cancelled" && targetStatus !== "Refunded") {
          const lines = [];
          if (parsedReceivedAmount > 0) {
            lines.push({
              accountId: debitAccountId,
              debit: parsedReceivedAmount,
              credit: 0,
              description: `Receipt: Hall Booking Receipt for ${bookerName} - ${hallSummaryLabel}`
            });
          }
          if (calculatedRemainingAmount > 0) {
            const arAccount = await AccountingService.getOrCreateAccountsReceivable(tx);
            lines.push({
              accountId: arAccount.id,
              debit: calculatedRemainingAmount,
              credit: 0,
              description: `Outstanding Receivable: Hall Booking Receipt for ${bookerName} - ${hallSummaryLabel}`
            });
          }
          if (calculatedNetAmount > 0) {
            lines.push(...buildHallRevenueCreditLines({
              hallIds: resolvedHallIds,
              hallAccountsMap,
              hallDetails: rawHallDetails,
              netAmount: calculatedNetAmount,
              bookerName
            }));
          }
          if (lines.length > 0) {
            const postingResult = await AccountingService.postTransaction(tx, {
              voucherType: "BR",
              postingDate: new Date(programDate),
              reference: `HB-${existingBooking.receiptNo}`,
              description: `Hall Booking Receipt for ${bookerName} - ${hallSummaryLabel}`,
              module: "Hall Booking",
              postedBy: req.user.id,
              lines,
              ipAddress: req.headers["x-forwarded-for"],
              userAgent: req.headers["user-agent"]
            });
            newJournalEntryId = postingResult.journalEntry.id;
          }
        }
        const finalStatus = targetStatus === "Cancelled" || targetStatus === "Refunded" ? targetStatus : wasPosted && newJournalEntryId ? "POSTED" : "Confirmed";
        const bookingDateOnlyStr = bookingDate ? typeof bookingDate === "string" && bookingDate.includes("T") ? bookingDate.split("T")[0] : typeof bookingDate === "string" ? bookingDate : new Date(bookingDate).toISOString().split("T")[0] : null;
        const refundDateOnlyStr = req.body.refundDate ? typeof req.body.refundDate === "string" && req.body.refundDate.includes("T") ? req.body.refundDate.split("T")[0] : typeof req.body.refundDate === "string" ? req.body.refundDate : new Date(req.body.refundDate).toISOString().split("T")[0] : null;
        const parsedCustomReceiptNo = req.body.receiptNo ? parseInt(req.body.receiptNo, 10) : req.body.slipNo ? parseInt(req.body.slipNo, 10) : void 0;
        return await tx.hallBooking.update({
          where: { id },
          data: {
            ...parsedCustomReceiptNo && !isNaN(parsedCustomReceiptNo) && parsedCustomReceiptNo > 0 ? { receiptNo: parsedCustomReceiptNo } : {},
            bookingDate: bookingDateOnlyStr ? /* @__PURE__ */ new Date(`${bookingDateOnlyStr}T00:00:00.000Z`) : void 0,
            bookerName,
            fatherHusbandName: fatherHusbandName || null,
            address: address || null,
            mobile: mobile || null,
            programDate: /* @__PURE__ */ new Date(`${dateOnlyStr}T00:00:00.000Z`),
            programType: programType || null,
            functionType: functionType || null,
            timeFrom: timeFrom || null,
            timeTo: timeTo || null,
            timings: timings || null,
            hallId: primaryHallId,
            hallIds: resolvedHallIds,
            hallNames: resolvedHallNames,
            hallDetails: rawHallDetails !== void 0 ? rawHallDetails : existingBooking.hallDetails,
            isForJamaat: Boolean(isForJamaat),
            hallCharges: parsedHallCharges,
            discount: parsedDiscount,
            netAmount: calculatedNetAmount,
            receivedAmount: parsedReceivedAmount,
            remainingAmount: calculatedRemainingAmount,
            refundAmount: req.body.refundAmount != null ? parseFloat(req.body.refundAmount) : 0,
            refundDate: refundDateOnlyStr ? /* @__PURE__ */ new Date(`${refundDateOnlyStr}T00:00:00.000Z`) : null,
            refundReason: req.body.refundReason || null,
            paymentMethod,
            bankAccountId: bankAccountId || null,
            chequeNumber: chequeNumber || null,
            chequeBankName: chequeBankName || null,
            status: finalStatus,
            remarks: remarks || null,
            journalEntryId: newJournalEntryId
          },
          include: {
            hallAccount: true,
            journalEntry: true
          }
        });
      });
      await logAudit(req.user.id, "Update & Post Hall Booking", "REVENUE", existingBooking, updatedBooking, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: updatedBooking });
    } catch (err) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint failed")) {
        const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
        await logAudit(
          req.user.id,
          "Duplicate Booking Attempt",
          "REVENUE",
          null,
          {
            user: req.user.fullName || req.user.email,
            hall: hallId,
            bookingDate: programDate || bookingDate,
            attemptedBy: req.user.id,
            ipAddress,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          },
          ipAddress,
          req.headers["user-agent"]
        );
        return res.status(409).json({
          success: false,
          message: "This hall is already booked on the selected date. Please choose another date."
        });
      }
      throw err;
    }
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  hall_bookings_default as default
};
