import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
function generateVoucherNumber() {
  const date = /* @__PURE__ */ new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BR-${year}${month}-${randomStr}`;
}
var hall_bookings_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const action = req.query.action;
  if (method === "GET") {
    const id = req.query.id;
    if (id) {
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
    const bookings = await prisma.hallBooking.findMany({
      include: {
        hallAccount: true,
        bankAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.status(200).json({ status: 200, data: bookings });
  }
  if (method === "POST") {
    if (action === "approve") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: "Booking ID is required", status: 400 } });
      const booking = await prisma.hallBooking.findUnique({ where: { id }, include: { hallAccount: true } });
      if (!booking) return res.status(404).json({ error: { message: "Booking not found", status: 404 } });
      if (booking.status === "POSTED") return res.status(400).json({ error: { message: "Booking is already posted", status: 400 } });
      const revenueAccountId = booking.hallId;
      if (!revenueAccountId) return res.status(400).json({ error: { message: "Revenue account (Hall) is required to post.", status: 400 } });
      let debitAccountId = null;
      if (booking.paymentMethod === "CASH") {
        const cashAccount = await prisma.account.findFirst({
          where: { accountName: { contains: "Cash", mode: "insensitive" } }
        });
        if (!cashAccount) return res.status(400).json({ error: { message: "Cash account not found in Chart of Accounts", status: 400 } });
        debitAccountId = cashAccount.id;
      } else {
        if (!booking.bankAccountId) return res.status(400).json({ error: { message: "Bank account is required for BANK/CHEQUE payments", status: 400 } });
        debitAccountId = booking.bankAccountId;
      }
      const result = await prisma.$transaction(async (tx) => {
        const postingResult = await AccountingService.postReceipt(tx, {
          amount: booking.amount,
          cashOrBankAccountId: debitAccountId,
          incomeAccountId: revenueAccountId,
          reference: `HB-${booking.receiptNo}`,
          description: `Hall Booking Receipt for ${booking.bookerName} - ${booking.hallAccount?.accountName}`,
          module: "Hall Booking",
          voucherType: "BR",
          postedBy: req.user.id,
          postingDate: booking.bookingDate || /* @__PURE__ */ new Date(),
          ipAddress: req.headers["x-forwarded-for"],
          userAgent: req.headers["user-agent"]
        });
        const approvedBooking = await tx.hallBooking.update({
          where: { id },
          data: {
            status: "POSTED",
            journalEntryId: postingResult.journalEntry.id
          }
        });
        return { approvedBooking, journalEntry: postingResult.journalEntry };
      });
      await logAudit(req.user.id, "Post Hall Booking", "REVENUE", booking, result.approvedBooking, req.headers["x-forwarded-for"], req.headers["user-agent"]);
      return res.status(200).json({ status: 200, data: result.approvedBooking, message: "Booking posted and journal entries created successfully" });
    }
    const { bookingDate, bookerName, address, mobile, programDate, programType, timings, hallId, isForJamaat, amount, paymentMethod, bankAccountId, chequeNumber, chequeBankName, remarks } = req.body;
    if (!bookerName || !programDate || !hallId || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: { message: "Amount must be greater than 0", status: 400 } });
    }
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payment methods", status: 400 } });
    }
    const newBooking = await prisma.hallBooking.create({
      data: {
        bookingDate: bookingDate ? new Date(bookingDate) : void 0,
        bookerName,
        address: address || null,
        mobile: mobile || null,
        programDate: new Date(programDate),
        programType: programType || null,
        timings: timings || null,
        hallId,
        isForJamaat: Boolean(isForJamaat),
        amount: parseFloat(amount),
        paymentMethod,
        bankAccountId: bankAccountId || null,
        chequeNumber: chequeNumber || null,
        chequeBankName: chequeBankName || null,
        status: "Confirmed",
        remarks: remarks || null
      },
      include: {
        hallAccount: true
      }
    });
    await logAudit(req.user.id, "Create Hall Booking", "REVENUE", null, newBooking, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newBooking });
  }
  if (method === "DELETE") {
    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: "Booking ID(s) required", status: 400 } });
    }
    const ids = Array.isArray(idsRaw) ? idsRaw.map(String) : String(idsRaw).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ error: { message: "No valid booking ID provided", status: 400 } });
    }
    try {
      const deletedBookings = await prisma.$transaction(async (tx) => {
        const bookings = await tx.hallBooking.findMany({
          where: { id: { in: ids } }
        });
        if (bookings.length === 0) {
          throw new Error("No hall bookings found to delete");
        }
        for (const booking of bookings) {
          if (booking.status === "POSTED" && booking.journalEntryId) {
            try {
              await AccountingService.reverseJournalEntry(tx, booking.journalEntryId, req.user.id, "Hall Booking Deleted");
            } catch (e) {
            }
          }
        }
        await tx.hallBooking.deleteMany({
          where: { id: { in: bookings.map((b) => b.id) } }
        });
        return bookings;
      });
      await logAudit(
        req.user.id,
        "Delete Hall Booking",
        "REVENUE",
        null,
        { count: deletedBookings.length, ids: deletedBookings.map((b) => b.id) },
        req.headers["x-forwarded-for"],
        req.headers["user-agent"]
      );
      return res.status(200).json({
        status: 200,
        message: `${deletedBookings.length} hall booking(s) deleted successfully`,
        data: deletedBookings
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
    if (existingBooking.status === "POSTED") {
      return res.status(400).json({ error: { message: "Cannot edit a posted booking", status: 400 } });
    }
    const { bookingDate, bookerName, address, mobile, programDate, programType, timings, hallId, isForJamaat, amount, paymentMethod, bankAccountId, chequeNumber, chequeBankName, remarks } = req.body;
    if (!bookerName || !programDate || !hallId || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: "Missing required fields", status: 400 } });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: { message: "Amount must be greater than 0", status: 400 } });
    }
    if ((paymentMethod === "BANK" || paymentMethod === "CHEQUE") && !bankAccountId) {
      return res.status(400).json({ error: { message: "Bank account is required for Bank/Cheque payment methods", status: 400 } });
    }
    const updatedBooking = await prisma.hallBooking.update({
      where: { id },
      data: {
        bookingDate: bookingDate ? new Date(bookingDate) : void 0,
        bookerName,
        address: address || null,
        mobile: mobile || null,
        programDate: new Date(programDate),
        programType: programType || null,
        timings: timings || null,
        hallId,
        isForJamaat: Boolean(isForJamaat),
        amount: parseFloat(amount),
        paymentMethod,
        bankAccountId: bankAccountId || null,
        chequeNumber: chequeNumber || null,
        chequeBankName: chequeBankName || null,
        remarks: remarks || null
      },
      include: {
        hallAccount: true
      }
    });
    await logAudit(req.user.id, "Update Hall Booking", "REVENUE", existingBooking, updatedBooking, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedBooking });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  hall_bookings_default as default
};
