import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { enforceRestrictedRolePolicy } from '../_middlewares/rbac.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, isAdminOrAbove, getDeletedFilter } from '../_utils/soft-delete.js';

function generateVoucherNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BR-${year}${month}-${randomStr}`;
}

// SQA fix: mirrors HallBookingForm.jsx's own client-side conflict preview
// exactly — two bookings for the same hall/date only conflict if their
// timings match, either is "Full Day", or either timing is unset (treated as
// covering the whole day). Previously the server ignored timings entirely
// and treated any second same-day booking as a conflict, rejecting
// legitimate non-overlapping bookings the UI itself allows.
function normalizeTiming(t: string | null | undefined): string | null {
  if (t == null) return null;
  const s = String(t).trim().toLowerCase();
  if (!s) return null;
  if (s === 'full day' || s === 'fullday' || s === 'full-day') return 'full day';
  return s;
}

function timingsConflict(existingTimings: string | null, requestedTimings: string | null | undefined): boolean {
  const e = normalizeTiming(existingTimings);
  const r = normalizeTiming(requestedTimings);
  if (!e || !r) return true; // unset timings treated as covering whole day
  if (e === 'full day' || r === 'full day') return true;
  return e === r;
}

// SQA fix: `status` is a free-text Prisma String column with no enum, and
// neither the create nor update handler validated it against a known set or
// checked whether a transition was legal — a direct API call could set an
// arbitrary status, or move a Cancelled/Refunded (terminal) booking back to
// Confirmed/POSTED, causing it to be silently re-posted to the ledger.
// Converting the column to a real Prisma enum is a schema migration outside
// the scope of a safe, verifiable same-pass change (see the migration note
// below), so this is enforced at the application layer instead.
const HALL_BOOKING_STATUSES = ['Pending', 'Confirmed', 'POSTED', 'Cancelled', 'Refunded'] as const;
type HallBookingStatus = typeof HALL_BOOKING_STATUSES[number];

// Terminal states (Cancelled, Refunded) have no legal outgoing transition —
// once a booking is cancelled/refunded it cannot be revived into an active
// status by a client-supplied status field.
const ALLOWED_STATUS_TRANSITIONS: Record<HallBookingStatus, HallBookingStatus[]> = {
  Pending:   ['Pending', 'Confirmed', 'POSTED', 'Cancelled', 'Refunded'],
  Confirmed: ['Confirmed', 'POSTED', 'Cancelled', 'Refunded'],
  POSTED:    ['POSTED', 'Cancelled', 'Refunded'],
  Cancelled: ['Cancelled'],
  Refunded:  ['Refunded'],
};

function isKnownStatus(value: string): value is HallBookingStatus {
  return (HALL_BOOKING_STATUSES as readonly string[]).includes(value);
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const method = req.method?.toUpperCase() ?? '';

  // Granular RBAC: PUT / PATCH require update permission, DELETE requires delete permission
  if (!await enforceRestrictedRolePolicy(req, res, method === 'DELETE' ? ['hallBookings.delete', PERMS.DELETE_HALL_BOOKING] : ['hallBookings.update', PERMS.UPDATE_HALL_BOOKING])) return;

  // Permission check: minimum required is VIEW for GET, CREATE for writes
  if (method === 'GET') {
    if (!await verifyPermission(req, res, ['hallBookings.view', PERMS.VIEW_HALL_BOOKINGS])) return;
  } else if (method === 'POST') {
    if (!await verifyPermission(req, res, ['hallBookings.create', PERMS.CREATE_HALL_BOOKING])) return;
  } else if (method === 'DELETE') {
    if (!await verifyPermission(req, res, ['hallBookings.delete', PERMS.DELETE_HALL_BOOKING])) return;
  } else if (method === 'PUT' || method === 'PATCH') {
    if (!await verifyPermission(req, res, ['hallBookings.update', PERMS.UPDATE_HALL_BOOKING])) return;
  }

  const action = req.query.action as string;

  if (method === 'GET') {
    if (req.url?.includes('/check-availability') || action === 'check-availability') {
      const hallId = req.query.hallId as string;
      const dateParam = (req.query.bookingDate || req.query.programDate) as string;
      const excludeId = req.query.excludeId as string;
      const requestedTimings = req.query.timings as string | undefined;

      if (!hallId || !dateParam) {
        return res.status(400).json({ error: { message: 'hallId and bookingDate (or programDate) are required parameters', status: 400 } });
      }

      const dateOnlyStr = typeof dateParam === 'string' && dateParam.includes('T')
        ? dateParam.split('T')[0]
        : (typeof dateParam === 'string' ? dateParam : new Date(dateParam).toISOString().split('T')[0]);
      const startOfDay = new Date(`${dateOnlyStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateOnlyStr}T23:59:59.999Z`);

      if (isNaN(startOfDay.getTime())) {
        return res.status(400).json({ error: { message: 'Invalid date format', status: 400 } });
      }

      const sameDayBookings = await prisma.hallBooking.findMany({
        where: {
          isDeleted: false,
          hallId: hallId,
          programDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            in: ['Confirmed', 'Pending', 'POSTED'],
          },
          id: excludeId ? { not: excludeId } : undefined,
        },
        include: {
          hallAccount: true,
          createdBy: true,
        },
      });

      // If client didn't supply timings for the availability check, do not
      // assume a full-day conflict — return available so the UI can prompt
      // the user to choose a timing instead of blocking them.
      if (typeof requestedTimings === 'undefined') {
        return res.status(200).json({ available: true });
      }

      const conflictBooking = sameDayBookings.find(b => timingsConflict(b.timings, requestedTimings));

      if (conflictBooking) {
        const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
        await logAudit(
          req.user.id,
          'Duplicate Booking Attempt',
          'REVENUE',
          null,
          {
            user: (req.user as any).fullName || req.user.email,
            hall: conflictBooking.hallAccount?.accountName || 'Selected Hall',
            bookingDate: dateParam,
            attemptedBy: req.user.id,
            ipAddress: ipAddress,
            timestamp: new Date().toISOString(),
          },
          ipAddress,
          req.headers['user-agent']
        );

        return res.status(200).json({
          available: false,
          bookedBy: conflictBooking.bookerName,
          bookingDate: conflictBooking.programDate.toISOString().split('T')[0],
          hallName: conflictBooking.hallAccount?.accountName || 'Selected Hall',
          receiptNo: conflictBooking.receiptNo,
          status: conflictBooking.status,
        });
      }

      return res.status(200).json({ available: true });
    }

    const id = req.query.id as string;
    if (id && !req.query.limit) {
      const booking = await prisma.hallBooking.findUnique({
        where: { id },
        include: {
          hallAccount: true,
          bankAccount: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      });
      if (!booking) return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      return res.status(200).json({ status: 200, data: booking });
    }
    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = getDeletedFilter(req.query);

    const [bookings, total] = await Promise.all([
      prisma.hallBooking.findMany({
        where: whereClause,
        include: {
          hallAccount: true,
          bankAccount: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.hallBooking.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: bookings, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
    const action = (req.query.action || req.body?.action) as string;
    const id = (req.query.id || req.body?.id) as string;
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: 'Booking ID is required', status: 400 } });
      }
      const existing = await prisma.hallBooking.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      }
      const restored = await prisma.hallBooking.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      if (existing.journalEntryId) {
        await prisma.journalEntry.update({
          where: { id: existing.journalEntryId },
          data: { isDeleted: false, deletedAt: null, deletedBy: null }
        }).catch(() => {});
        // The cached Account.currentBalance must follow the ledger: this entry
        // just moved in/out of POSTED_JOURNAL_FILTER, so rebuild every account
        // it touches or the balance keeps the deleted transaction's impact.
        await AccountingService.recalculateBalancesForJournalEntry(prisma, existing.journalEntryId);
      }
      await logAudit(req.user.id, 'Restore Hall Booking', 'REVENUE', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Hall booking restored successfully', data: restored });
    }
  }

  if (method === 'POST') {
    // Action: Approve Booking & Post to Ledger — requires POST_LEDGER permission
    if (action === 'approve') {
      if (!await verifyPermission(req, res, PERMS.POST_LEDGER)) return;

      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: 'Booking ID is required', status: 400 } });

      const booking = await prisma.hallBooking.findUnique({ where: { id }, include: { hallAccount: true } });
      if (!booking) return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      if (booking.status === 'POSTED') {
        return res.status(409).json({
          error: { message: 'Transaction has already been posted to the General Ledger.', status: 409 }
        });
      }

      const checkNetAmt = Number(booking.netAmount ?? booking.hallCharges ?? 0);
      const checkRecAmt = Number(booking.receivedAmount ?? 0);
      const checkRemAmt = Number(booking.remainingAmount ?? (checkNetAmt - checkRecAmt));
      if (checkRemAmt > 0) {
        return res.status(400).json({
          error: { message: `Cannot post hall booking: Remaining amount must be 0 before posting to ledger. (Remaining: Rs. ${Math.round(checkRemAmt).toLocaleString()})`, status: 400 }
        });
      }

      const revenueAccountId = booking.hallId;
      if (!revenueAccountId) return res.status(400).json({ error: { message: 'Revenue account (Hall) is required to post.', status: 400 } });

      let debitAccountId: string | null = null;
      if (booking.paymentMethod === 'CASH') {
        const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
        debitAccountId = cashAccount.id;
      } else {
        if (!booking.bankAccountId) return res.status(400).json({ error: { message: 'Bank account is required for BANK/CHEQUE payments', status: 400 } });
        debitAccountId = booking.bankAccountId;
      }

      // Perform the transaction
      const result = await prisma.$transaction(async (tx) => {
        const netAmt = Number(booking.netAmount ?? booking.hallCharges);
        const recAmt = Number(booking.receivedAmount ?? 0);
        const remAmt = Number(booking.remainingAmount ?? (netAmt - recAmt));

        const lines = [];

        // Debit cash/bank for received amount
        if (recAmt > 0) {
          lines.push({
            accountId: debitAccountId!,
            debit: recAmt,
            credit: 0,
            description: `Receipt: Hall Booking Receipt for ${booking.bookerName} - ${booking.hallAccount?.accountName || 'Selected Hall'}`
          });
        }

        // Debit Accounts Receivable for remaining amount
        if (remAmt > 0) {
          const arAccount = await AccountingService.getOrCreateAccountsReceivable(tx);
          lines.push({
            accountId: arAccount.id,
            debit: remAmt,
            credit: 0,
            description: `Outstanding Receivable: Hall Booking Receipt for ${booking.bookerName} - ${booking.hallAccount?.accountName || 'Selected Hall'}`
          });
        }

        // Credit Income account for the net amount (only if positive)
        if (netAmt > 0) {
          lines.push({
            accountId: revenueAccountId,
            debit: 0,
            credit: netAmt,
            description: `Revenue: Hall Booking Receipt for ${booking.bookerName} - ${booking.hallAccount?.accountName || 'Selected Hall'}`
          });
        }

        let postingResult: any = null;
        if (lines.length > 0) {
          postingResult = await AccountingService.postTransaction(tx, {
            voucherType: 'BR',
            postingDate: booking.bookingDate || new Date(),
            reference: `HB-${booking.receiptNo}`,
            description: `Hall Booking Receipt for ${booking.bookerName} - ${booking.hallAccount?.accountName || 'Selected Hall'}`,
            module: 'Hall Booking',
            postedBy: req.user!.id,
            lines,
            ipAddress: req.headers['x-forwarded-for'] as string,
            userAgent: req.headers['user-agent']
          });
        }

        const approvedBooking = await tx.hallBooking.update({
          where: { id },
          data: {
            status: 'POSTED',
            journalEntryId: postingResult ? postingResult.journalEntry.id : null
          }
        });

        return { approvedBooking, journalEntry: postingResult ? postingResult.journalEntry : null };
      });

      await logAudit(req.user.id, 'POST_TO_LEDGER', 'Hall Bookings', booking, result.approvedBooking, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


      return res.status(200).json({ status: 200, data: result.approvedBooking, message: 'Booking posted and journal entries created successfully' });
    }

    // Action: Revert Booking from Ledger
    if (action === 'revert') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: 'Booking ID is required', status: 400 } });

      const booking = await prisma.hallBooking.findUnique({ where: { id } });
      if (!booking) return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      if (booking.status !== 'POSTED') return res.status(400).json({ error: { message: 'Booking is not posted', status: 400 } });

      const result = await prisma.$transaction(async (tx) => {
        if (booking.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, booking.journalEntryId, req.user!.id, 'Hall Booking Reverted');
          } catch (e) {
            // Ignore if already deleted
          }
        }

        const revertedBooking = await tx.hallBooking.update({
          where: { id },
          data: { 
            status: 'Pending',
            journalEntryId: null 
          }
        });

        return revertedBooking;
      });

      await logAudit(req.user.id, 'Revert Hall Booking', 'REVENUE', booking, result, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


      return res.status(200).json({ status: 200, data: result, message: 'Booking reverted from ledger successfully' });
    }

    // Action: Create Booking & Auto-Post to Ledger
    const { bookingDate, bookerName, fatherHusbandName, address, mobile, programDate, programType, functionType, timeFrom, timeTo, timings, hallId, isForJamaat, amount, hallCharges, discount, netAmount, receivedAmount, paymentMethod, bankAccountId, chequeNumber, chequeBankName, remarks } = req.body;

    if (bookerName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(bookerName))) {
      return res.status(400).json({ error: { message: 'Booker name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (fatherHusbandName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherHusbandName))) {
      return res.status(400).json({ error: { message: 'Father / husband name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (address && !/^[a-zA-Z0-9\s.,#/-]{3,160}$/.test(String(address))) {
      return res.status(400).json({ error: { message: 'Address contains unsupported characters', status: 400 } });
    }
    if (mobile && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: 'Mobile number must contain exactly 11 digits', status: 400 } });
    }
    if (chequeNumber && !/^\d{6,20}$/.test(String(chequeNumber))) {
      return res.status(400).json({ error: { message: 'Cheque number must contain only digits (6-20 digits)', status: 400 } });
    }
    if (chequeBankName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(chequeBankName))) {
      return res.status(400).json({ error: { message: 'Cheque bank name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }

    const rawHallCharges = hallCharges ?? amount;
    if (!bookerName || !programDate || !hallId || rawHallCharges == null || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    // SQA fix: past-date rejection previously existed only in
    // HallBookingForm.jsx (client-side) -- a direct API call could book a hall
    const parsedProgramDateForValidation = new Date(programDate);
    if (isNaN(parsedProgramDateForValidation.getTime())) {
      return res.status(400).json({ error: { message: 'Invalid program date', status: 400 } });
    }

    // SQA fix: status (if the caller supplies one) was accepted verbatim
    // with no allowlist check on create.
    const requestedCreateStatus = req.body.status;
    if (requestedCreateStatus !== undefined && !isKnownStatus(requestedCreateStatus)) {
      return res.status(400).json({ error: { message: `Status must be one of: ${HALL_BOOKING_STATUSES.join(', ')}`, status: 400 } });
    }
    // Security: only users with POST_LEDGER permission may create a booking
    // already marked POSTED (which implies ledger posting intent). Without
    // this guard a naive client could set status=POSTED and later trigger
    // an automatic post flow or be mistaken for a posted transaction.
    if (requestedCreateStatus === 'POSTED' && !(await verifyPermission(req, res, PERMS.POST_LEDGER))) {
      return res.status(403).json({ error: { message: 'Forbidden: insufficient permission to create a POSTED booking', status: 403 } });
    }
    // Round to cents at every parse/derive step (matches validateAmount()/
    // computeInvoiceTotals()'s convention elsewhere) so float noise from
    // parseFloat/subtraction never reaches the ledger as a fractional-cent
    // debit/credit.
    const parsedHallCharges = Math.round(parseFloat(rawHallCharges) * 100) / 100;
    if (isNaN(parsedHallCharges) || parsedHallCharges <= 0) {
      return res.status(400).json({ error: { message: 'Hall Charges must be greater than 0', status: 400 } });
    }
    const parsedDiscount = discount != null ? Math.round(parseFloat(discount) * 100) / 100 : 0;
    if (isNaN(parsedDiscount) || parsedDiscount < 0) {
      return res.status(400).json({ error: { message: 'Discount cannot be negative', status: 400 } });
    }
    if (parsedDiscount > parsedHallCharges) {
      return res.status(400).json({ error: { message: 'Discount cannot exceed Hall Charges', status: 400 } });
    }

    const calculatedNetAmount = Math.round((parsedHallCharges - parsedDiscount) * 100) / 100;

    const parsedReceivedAmount = receivedAmount != null ? Math.round(parseFloat(receivedAmount) * 100) / 100 : 0;
    if (isNaN(parsedReceivedAmount) || parsedReceivedAmount < 0) {
      return res.status(400).json({ error: { message: 'Received Amount cannot be negative', status: 400 } });
    }
    if (parsedReceivedAmount > calculatedNetAmount) {
      return res.status(400).json({ error: { message: 'Received Amount cannot exceed Net Amount', status: 400 } });
    }

    const calculatedRemainingAmount = Math.round((calculatedNetAmount - parsedReceivedAmount) * 100) / 100;

    if (requestedCreateStatus === 'POSTED' && calculatedRemainingAmount > 0) {
      return res.status(400).json({ error: { message: `Cannot set status to POSTED: Remaining amount must be 0 before posting to ledger. (Remaining: Rs. ${Math.round(calculatedRemainingAmount).toLocaleString()})`, status: 400 } });
    }

    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payment methods', status: 400 } });
    }

    let debitAccountId: string | null = null;
    if (paymentMethod === 'CASH') {
      const cashAccount = await AccountingService.ensureCashInHandAccount(prisma);
      debitAccountId = cashAccount.id;
    } else {
      debitAccountId = bankAccountId;
    }

    const eventDateStr = programDate || bookingDate;
    const dateOnlyStr = typeof eventDateStr === 'string' && eventDateStr.includes('T')
      ? eventDateStr.split('T')[0]
      : (typeof eventDateStr === 'string' ? eventDateStr : new Date(eventDateStr).toISOString().split('T')[0]);
    const startOfDay = new Date(`${dateOnlyStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateOnlyStr}T23:59:59.999Z`);

    const sameDayBookings = await prisma.hallBooking.findMany({
      where: {
        isDeleted: false,
        hallId: hallId,
        programDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['Confirmed', 'Pending', 'POSTED'],
        },
      },
      include: {
        hallAccount: true,
      },
    });
      // If the client didn't provide timings for the availability check, do not
      // treat it as a full-day conflict — return available so the UI can prompt
      // the user to select a timing rather than blocking them.
      if (typeof timings === 'undefined') {
        return res.status(200).json({ available: true });
      }

      const conflictBooking = sameDayBookings.find(b => timingsConflict(b.timings, timings));

    if (conflictBooking) {
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
      await logAudit(
        req.user.id,
        'Duplicate Booking Attempt',
        'REVENUE',
        null,
        {
          user: (req.user as any).fullName || req.user.email,
          hall: conflictBooking.hallAccount?.accountName || 'Selected Hall',
          bookingDate: eventDateStr,
          attemptedBy: req.user.id,
          ipAddress: ipAddress,
          timestamp: new Date().toISOString(),
        },
        ipAddress,
        req.headers['user-agent']
      );

      return res.status(409).json({
        success: false,
        message: 'This hall is already booked for the selected date and time slot. Please choose another date or time.',
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction to close the TOCTOU gap between the
      // advisory check above and this insert (see SQA fix note on
      // timingsConflict/isValidBookingStatus below for the full rationale).
      const sameDayInTx = await tx.hallBooking.findMany({
        where: {
          isDeleted: false,
          hallId,
          programDate: { gte: startOfDay, lte: endOfDay },
          status: { in: ['Confirmed', 'Pending', 'POSTED'] },
        },
      });
      if (sameDayInTx.some((b: any) => timingsConflict(b.timings, timings))) {
        throw Object.assign(new Error('This hall is already booked for the selected date and time slot. Please choose another date or time.'), { status: 409 });
      }

      const lastBooking = await tx.hallBooking.findFirst({
        orderBy: { receiptNo: 'desc' },
        select: { receiptNo: true },
      });
      const receiptNo = (lastBooking?.receiptNo || 0) + 1;

      const bookingDateOnlyStr = bookingDate
        ? (typeof bookingDate === 'string' && bookingDate.includes('T') ? bookingDate.split('T')[0] : (typeof bookingDate === 'string' ? bookingDate : new Date(bookingDate).toISOString().split('T')[0]))
        : null;
      const refundDateOnlyStr = req.body.refundDate
        ? (typeof req.body.refundDate === 'string' && req.body.refundDate.includes('T') ? req.body.refundDate.split('T')[0] : (typeof req.body.refundDate === 'string' ? req.body.refundDate : new Date(req.body.refundDate).toISOString().split('T')[0]))
        : null;

      let newBooking = await tx.hallBooking.create({
        data: {
          receiptNo,
          bookingDate: bookingDateOnlyStr ? new Date(`${bookingDateOnlyStr}T00:00:00.000Z`) : undefined,
          bookerName,
          fatherHusbandName: fatherHusbandName || null,
          address: address || null,
          mobile: mobile || null,
          programDate: new Date(`${dateOnlyStr}T00:00:00.000Z`),
          programType: programType || null,
          functionType: functionType || null,
          timeFrom: timeFrom || null,
          timeTo: timeTo || null,
          timings: timings || null,
          hallId,
          isForJamaat: Boolean(isForJamaat),
          hallCharges: parsedHallCharges,
          discount: parsedDiscount,
          netAmount: calculatedNetAmount,
          receivedAmount: parsedReceivedAmount,
          remainingAmount: calculatedRemainingAmount,
          refundAmount: req.body.refundAmount != null ? parseFloat(req.body.refundAmount) : 0,
          refundDate: refundDateOnlyStr ? new Date(`${refundDateOnlyStr}T00:00:00.000Z`) : null,
          refundReason: req.body.refundReason || null,
          paymentMethod,
          bankAccountId: bankAccountId || null,
          chequeNumber: chequeNumber || null,
          chequeBankName: chequeBankName || null,
          status: req.body.status || 'Confirmed',
          remarks: remarks || null,
          createdById: req.user!.id
        },
        include: {
          hallAccount: true,
          journalEntry: true
        }
      });

      if (newBooking.status === 'POSTED' && calculatedNetAmount > 0) {
        const lines = [];
        if (parsedReceivedAmount > 0) {
          lines.push({
            accountId: debitAccountId!,
            debit: parsedReceivedAmount,
            credit: 0,
            description: `Receipt: Hall Booking Receipt for ${bookerName} - ${newBooking.hallAccount?.accountName || 'Selected Hall'}`
          });
        }
        if (calculatedRemainingAmount > 0) {
          const arAccount = await AccountingService.getOrCreateAccountsReceivable(tx);
          lines.push({
            accountId: arAccount.id,
            debit: calculatedRemainingAmount,
            credit: 0,
            description: `Outstanding Receivable: Hall Booking Receipt for ${bookerName} - ${newBooking.hallAccount?.accountName || 'Selected Hall'}`
          });
        }
        lines.push({
          accountId: hallId,
          debit: 0,
          credit: calculatedNetAmount,
          description: `Revenue: Hall Booking Receipt for ${bookerName} - ${newBooking.hallAccount?.accountName || 'Selected Hall'}`
        });

        const postingResult = await AccountingService.postTransaction(tx, {
          voucherType: 'BR',
          postingDate: newBooking.bookingDate || new Date(),
          reference: `HB-${newBooking.receiptNo}`,
          description: `Hall Booking Receipt for ${bookerName} - ${newBooking.hallAccount?.accountName || 'Selected Hall'}`,
          module: 'Hall Booking',
          postedBy: req.user!.id,
          lines,
          ipAddress: req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent']
        });

        newBooking = await tx.hallBooking.update({
          where: { id: newBooking.id },
          data: { journalEntryId: postingResult.journalEntry.id },
          include: { hallAccount: true, journalEntry: true }
        });
      }

      return newBooking;
    }, { maxWait: 15000, timeout: 30000 });

      await logAudit(req.user.id, 'Create & Post Hall Booking', 'REVENUE', null, result, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


      return res.status(201).json({ status: 201, data: result });
    } catch (err: any) {
      if (err.code === 'P2002' || err.message?.includes('Unique constraint failed')) {
        const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
        await logAudit(
          req.user.id,
          'Duplicate Booking Attempt',
          'REVENUE',
          null,
          {
            user: (req.user as any).fullName || req.user.email,
            hall: hallId,
            bookingDate: programDate || bookingDate,
            attemptedBy: req.user.id,
            ipAddress: ipAddress,
            timestamp: new Date().toISOString(),
          },
          ipAddress,
          req.headers['user-agent']
        );
        return res.status(409).json({
          success: false,
          message: 'This hall is already booked on the selected date. Please choose another date.',
        });
      }
      throw err;
    }
  }

  if (method === 'DELETE') {
    // Bulk-ID parsing (supports single or multiple IDs) merged with the
    // soft-delete-by-default + permanent-delete-gated-by-Super-Admin logic
    // that used to live in a second, unreachable 'DELETE' block below it —
    // that block always lost because this one already returns unconditionally.
    // The result was every delete here being an irreversible hard-delete with
    // no permission gate, and Restore therefore always 404ing.
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent && !await isAdminOrAbove(req)) {
      return res.status(403).json({ error: { message: 'Forbidden: Only Admin or Super Admin can permanently delete records', status: 403 } });
    }

    const idsRaw = req.body?.ids || req.body?.id || req.query.ids || req.query.id;
    if (!idsRaw) {
      return res.status(400).json({ error: { message: 'Booking ID(s) required', status: 400 } });
    }

    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.map(String)
      : String(idsRaw).split(',').map(s => s.trim()).filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: { message: 'No valid booking ID provided', status: 400 } });
    }

    try {
      const affectedBookings = await prisma.$transaction(async (tx) => {
        const bookings = await tx.hallBooking.findMany({
          where: { id: { in: ids } }
        });

        if (bookings.length === 0) {
          throw new Error('No hall bookings found to delete');
        }

        for (const booking of bookings) {
          if (booking.journalEntryId) {
            try {
              if (isPermanent) {
                await AccountingService.deleteJournalEntry(tx, booking.journalEntryId, req.user!.id, 'Hall Booking Permanently Deleted');
              } else {
                await tx.journalEntry.update({
                  where: { id: booking.journalEntryId },
                  data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
                });
                // The cached Account.currentBalance must follow the ledger: this entry
                // just moved in/out of POSTED_JOURNAL_FILTER, so rebuild every account
                // it touches or the balance keeps the deleted transaction's impact.
                await AccountingService.recalculateBalancesForJournalEntry(tx, booking.journalEntryId);
              }
            } catch (e) {
              // Ignore if already deleted
            }
          }
        }

        if (isPermanent) {
          await tx.hallBooking.deleteMany({
            where: { id: { in: bookings.map(b => b.id) } }
          });
        } else {
          await tx.hallBooking.updateMany({
            where: { id: { in: bookings.map(b => b.id) } },
            data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user!.id }
          });
        }

        return bookings;
      });

      await logAudit(
        req.user.id,
        isPermanent ? 'Permanent Delete Hall Booking' : 'Delete Hall Booking',
        'REVENUE',
        null,
        { count: affectedBookings.length, ids: affectedBookings.map(b => b.id), permanent: isPermanent },
        req.headers['x-forwarded-for'] as string,
        req.headers['user-agent']
      );


      return res.status(200).json({
        status: 200,
        message: `${affectedBookings.length} hall booking(s) deleted successfully`,
        data: affectedBookings
      });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message || 'Failed to delete hall booking(s)', status: 400 } });
    }
  }

  if (method === 'PUT') {
    const id = req.query.id as string;
    if (!id) {
      return res.status(400).json({ error: { message: 'Booking ID is required', status: 400 } });
    }

    const existingBooking = await prisma.hallBooking.findUnique({ where: { id } });
    if (!existingBooking) {
      return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    }

    const { bookingDate, bookerName, fatherHusbandName, address, mobile, programDate, programType, functionType, timeFrom, timeTo, timings, hallId, isForJamaat, amount, hallCharges, discount, receivedAmount, paymentMethod, bankAccountId, chequeNumber, chequeBankName, remarks } = req.body;

    if (bookerName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(bookerName))) {
      return res.status(400).json({ error: { message: 'Booker name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (fatherHusbandName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherHusbandName))) {
      return res.status(400).json({ error: { message: 'Father / husband name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (address && !/^[a-zA-Z0-9\s.,#/-]{3,160}$/.test(String(address))) {
      return res.status(400).json({ error: { message: 'Address contains unsupported characters', status: 400 } });
    }
    if (mobile && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: 'Mobile number must contain exactly 11 digits', status: 400 } });
    }
    if (chequeNumber && !/^\d{6,20}$/.test(String(chequeNumber))) {
      return res.status(400).json({ error: { message: 'Cheque number must contain only digits (6-20 digits)', status: 400 } });
    }
    if (chequeBankName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(chequeBankName))) {
      return res.status(400).json({ error: { message: 'Cheque bank name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }

    const rawHallCharges = hallCharges ?? amount;
    if (!bookerName || !programDate || !hallId || rawHallCharges == null || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }

    const parsedProgramDateForValidationPut = new Date(programDate);
    if (isNaN(parsedProgramDateForValidationPut.getTime())) {
      return res.status(400).json({ error: { message: 'Invalid program date', status: 400 } });
    }

    // SQA fix: previously any status string was accepted with no validation
    // and no transition rules, so a Cancelled/Refunded (terminal) booking
    // could be silently moved back to Confirmed/POSTED and re-posted to the
    // ledger. This enforces both a known-value allowlist and a legal-
    // transition check.
    const requestedUpdateStatus = req.body.status;
    if (requestedUpdateStatus !== undefined && !isKnownStatus(requestedUpdateStatus)) {
      return res.status(400).json({ error: { message: `Status must be one of: ${HALL_BOOKING_STATUSES.join(', ')}`, status: 400 } });
    }
    if (requestedUpdateStatus !== undefined && isKnownStatus(existingBooking.status)) {
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[existingBooking.status as HallBookingStatus];
      if (!allowedNext.includes(requestedUpdateStatus)) {
        return res.status(400).json({ error: { message: `Cannot change booking status from '${existingBooking.status}' to '${requestedUpdateStatus}'.`, status: 400 } });
      }
    }
    // Round to cents at every parse/derive step (matches validateAmount()/
    // computeInvoiceTotals()'s convention elsewhere) so float noise from
    // parseFloat/subtraction never reaches the ledger as a fractional-cent
    // debit/credit.
    const parsedHallCharges = Math.round(parseFloat(rawHallCharges) * 100) / 100;
    if (isNaN(parsedHallCharges) || parsedHallCharges <= 0) {
      return res.status(400).json({ error: { message: 'Hall Charges must be greater than 0', status: 400 } });
    }
    const parsedDiscount = discount != null ? Math.round(parseFloat(discount) * 100) / 100 : 0;
    if (isNaN(parsedDiscount) || parsedDiscount < 0) {
      return res.status(400).json({ error: { message: 'Discount cannot be negative', status: 400 } });
    }
    if (parsedDiscount > parsedHallCharges) {
      return res.status(400).json({ error: { message: 'Discount cannot exceed Hall Charges', status: 400 } });
    }

    const calculatedNetAmount = Math.round((parsedHallCharges - parsedDiscount) * 100) / 100;

    const parsedReceivedAmount = receivedAmount != null ? Math.round(parseFloat(receivedAmount) * 100) / 100 : 0;
    if (isNaN(parsedReceivedAmount) || parsedReceivedAmount < 0) {
      return res.status(400).json({ error: { message: 'Received Amount cannot be negative', status: 400 } });
    }
    if (parsedReceivedAmount > calculatedNetAmount) {
      return res.status(400).json({ error: { message: 'Received Amount cannot exceed Net Amount', status: 400 } });
    }

    const calculatedRemainingAmount = Math.round((calculatedNetAmount - parsedReceivedAmount) * 100) / 100;

    if (requestedUpdateStatus === 'POSTED' && calculatedRemainingAmount > 0) {
      return res.status(400).json({ error: { message: `Cannot set status to POSTED: Remaining amount must be 0 before posting to ledger. (Remaining: Rs. ${Math.round(calculatedRemainingAmount).toLocaleString()})`, status: 400 } });
    }

    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payment methods', status: 400 } });
    }
    const eventDateStr = programDate || bookingDate;
    const dateOnlyStr = typeof eventDateStr === 'string' && eventDateStr.includes('T')
      ? eventDateStr.split('T')[0]
      : (typeof eventDateStr === 'string' ? eventDateStr : new Date(eventDateStr).toISOString().split('T')[0]);
    const startOfDay = new Date(`${dateOnlyStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateOnlyStr}T23:59:59.999Z`);

    const sameDayBookingsForUpdate = await prisma.hallBooking.findMany({
      where: {
        isDeleted: false,
        hallId: hallId,
        programDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['Confirmed', 'Pending', 'POSTED'],
        },
        id: { not: id },
      },
      include: {
        hallAccount: true,
      },
    });
    const conflictBooking = sameDayBookingsForUpdate.find(b => timingsConflict(b.timings, timings));

    if (conflictBooking) {
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
      await logAudit(
        req.user.id,
        'Duplicate Booking Attempt',
        'REVENUE',
        null,
        {
          user: (req.user as any).fullName || req.user.email,
          hall: conflictBooking.hallAccount?.accountName || 'Selected Hall',
          bookingDate: eventDateStr,
          attemptedBy: req.user.id,
          ipAddress: ipAddress,
          timestamp: new Date().toISOString(),
        },
        ipAddress,
        req.headers['user-agent']
      );

      return res.status(409).json({
        success: false,
        message: 'This hall is already booked for the selected date and time slot. Please choose another date or time.',
      });
    }

    try {
      const updatedBooking = await prisma.$transaction(async (tx) => {
        if (existingBooking.journalEntryId) {
          try {
            await AccountingService.deleteJournalEntry(tx, existingBooking.journalEntryId, req.user!.id, 'Reversing Hall Booking for update');
          } catch (e) {}
        }

        let debitAccountId: string | null = null;
        if (paymentMethod === 'CASH') {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          debitAccountId = cashAccount.id;
        } else {
          debitAccountId = bankAccountId || null;
        }

        const wasPosted = existingBooking.status === 'POSTED' || Boolean(existingBooking.journalEntryId);
        let newJournalEntryId: string | null = null;
        const targetStatus = req.body.status || existingBooking.status;

        if (wasPosted && debitAccountId && hallId && targetStatus !== 'Cancelled' && targetStatus !== 'Refunded') {
          const lines: any[] = [];

          if (parsedReceivedAmount > 0) {
            lines.push({
              accountId: debitAccountId,
              debit: parsedReceivedAmount,
              credit: 0,
              description: `Receipt: Hall Booking Receipt for ${bookerName}`
            });
          }

          if (calculatedRemainingAmount > 0) {
            const arAccount = await AccountingService.getOrCreateAccountsReceivable(tx);
            lines.push({
              accountId: arAccount.id,
              debit: calculatedRemainingAmount,
              credit: 0,
              description: `Outstanding Receivable: Hall Booking Receipt for ${bookerName}`
            });
          }

          if (calculatedNetAmount > 0) {
            lines.push({
              accountId: hallId,
              debit: 0,
              credit: calculatedNetAmount,
              description: `Revenue: Hall Booking Receipt for ${bookerName}`
            });
          }

          if (lines.length > 0) {
            const postingResult = await AccountingService.postTransaction(tx, {
              voucherType: 'BR',
              postingDate: new Date(programDate),
              reference: `HB-${existingBooking.receiptNo}`,
              description: `Hall Booking Receipt for ${bookerName}`,
              module: 'Hall Booking',
              postedBy: req.user!.id,
              lines,
              ipAddress: req.headers['x-forwarded-for'] as string,
              userAgent: req.headers['user-agent']
            });
            newJournalEntryId = postingResult.journalEntry.id;
          }
        }

        const finalStatus = targetStatus === 'Cancelled' || targetStatus === 'Refunded'
          ? targetStatus
          : (wasPosted && newJournalEntryId ? 'POSTED' : 'Confirmed');

        const bookingDateOnlyStr = bookingDate
          ? (typeof bookingDate === 'string' && bookingDate.includes('T') ? bookingDate.split('T')[0] : (typeof bookingDate === 'string' ? bookingDate : new Date(bookingDate).toISOString().split('T')[0]))
          : null;
        const refundDateOnlyStr = req.body.refundDate
          ? (typeof req.body.refundDate === 'string' && req.body.refundDate.includes('T') ? req.body.refundDate.split('T')[0] : (typeof req.body.refundDate === 'string' ? req.body.refundDate : new Date(req.body.refundDate).toISOString().split('T')[0]))
          : null;

        return await tx.hallBooking.update({
          where: { id },
          data: {
            bookingDate: bookingDateOnlyStr ? new Date(`${bookingDateOnlyStr}T00:00:00.000Z`) : undefined,
            bookerName,
            fatherHusbandName: fatherHusbandName || null,
            address: address || null,
            mobile: mobile || null,
            programDate: new Date(`${dateOnlyStr}T00:00:00.000Z`),
            programType: programType || null,
            functionType: functionType || null,
            timeFrom: timeFrom || null,
            timeTo: timeTo || null,
            timings: timings || null,
            hallId,
            isForJamaat: Boolean(isForJamaat),
            hallCharges: parsedHallCharges,
            discount: parsedDiscount,
            netAmount: calculatedNetAmount,
            receivedAmount: parsedReceivedAmount,
            remainingAmount: calculatedRemainingAmount,
            refundAmount: req.body.refundAmount != null ? parseFloat(req.body.refundAmount) : 0,
            refundDate: refundDateOnlyStr ? new Date(`${refundDateOnlyStr}T00:00:00.000Z`) : null,
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

      await logAudit(req.user.id, 'Update & Post Hall Booking', 'REVENUE', existingBooking, updatedBooking, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);


      return res.status(200).json({ status: 200, data: updatedBooking });
    } catch (err: any) {
      if (err.code === 'P2002' || err.message?.includes('Unique constraint failed')) {
        const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
        await logAudit(
          req.user.id,
          'Duplicate Booking Attempt',
          'REVENUE',
          null,
          {
            user: (req.user as any).fullName || req.user.email,
            hall: hallId,
            bookingDate: programDate || bookingDate,
            attemptedBy: req.user.id,
            ipAddress: ipAddress,
            timestamp: new Date().toISOString(),
          },
          ipAddress,
          req.headers['user-agent']
        );
        return res.status(409).json({
          success: false,
          message: 'This hall is already booked on the selected date. Please choose another date.',
        });
      }
      throw err;
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
