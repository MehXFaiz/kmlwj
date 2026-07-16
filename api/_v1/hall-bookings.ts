import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingService } from '../_services/accounting.service.js';

function generateVoucherNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BR-${year}${month}-${randomStr}`;
}

async function getOrCreateAccountsReceivable(tx: any) {
  let arAccount = await tx.account.findFirst({
    where: {
      OR: [
        { accountName: { contains: 'Accounts Receivable', mode: 'insensitive' } },
        { glCode: '1010200' }
      ]
    }
  });

  if (!arAccount) {
    const parentAccount = await tx.account.findFirst({
      where: {
        OR: [
          { glCode: '1010000' },
          { accountName: { contains: 'Current Assets', mode: 'insensitive' } }
        ]
      }
    });

    if (!parentAccount) {
      throw new Error('Current Assets account not found in Chart of Accounts.');
    }

    arAccount = await tx.account.create({
      data: {
        glCode: '1010200',
        accountName: 'Accounts Receivable',
        accountLevel: 'SUBSIDIARY',
        parentId: parentAccount.id,
        accountTypeId: parentAccount.accountTypeId,
        detailType: 'Accounts Receivable',
        description: 'Standard Accounts Receivable account',
        currency: 'PKR',
        subsidiary: ['Global'],
        initialBalance: 0,
        currentBalance: 0,
        isSystemDefined: true,
      }
    });
  }

  return arAccount;
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const action = req.query.action as string;

  if (method === 'GET') {
    if (req.url?.includes('/check-availability') || action === 'check-availability') {
      const hallId = req.query.hallId as string;
      const dateParam = (req.query.bookingDate || req.query.programDate) as string;
      const excludeId = req.query.excludeId as string;

      if (!hallId || !dateParam) {
        return res.status(400).json({ error: { message: 'hallId and bookingDate (or programDate) are required parameters', status: 400 } });
      }

      const parsedDate = new Date(dateParam);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: { message: 'Invalid date format', status: 400 } });
      }

      const startOfDay = new Date(parsedDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(parsedDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const conflictBooking = await prisma.hallBooking.findFirst({
        where: {
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
    if (id) {
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

    const [bookings, total] = await Promise.all([
      prisma.hallBooking.findMany({
        include: {
          hallAccount: true,
          bankAccount: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.hallBooking.count()
    ]);
    return res.status(200).json({ status: 200, data: bookings, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'POST') {
    // Action: Approve Booking & Post to Ledger
    if (action === 'approve') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: { message: 'Booking ID is required', status: 400 } });

      const booking = await prisma.hallBooking.findUnique({ where: { id }, include: { hallAccount: true } });
      if (!booking) return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
      if (booking.status === 'POSTED') return res.status(400).json({ error: { message: 'Booking is already posted', status: 400 } });

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
          const arAccount = await getOrCreateAccountsReceivable(tx);
          lines.push({
            accountId: arAccount.id,
            debit: remAmt,
            credit: 0,
            description: `Outstanding Receivable: Hall Booking Receipt for ${booking.bookerName} - ${booking.hallAccount?.accountName || 'Selected Hall'}`
          });
        }

        // Credit Income account for the net amount
        if (netAmt > 0) {
          lines.push({
            accountId: revenueAccountId,
            debit: 0,
            credit: netAmt,
            description: `Revenue: Hall Booking Receipt for ${booking.bookerName} - ${booking.hallAccount?.accountName || 'Selected Hall'}`
          });
        }

        const postingResult = await AccountingService.postTransaction(tx, {
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

        const approvedBooking = await tx.hallBooking.update({
          where: { id },
          data: { 
            status: 'POSTED',
            journalEntryId: postingResult.journalEntry.id 
          }
        });

        return { approvedBooking, journalEntry: postingResult.journalEntry };
      });

      await logAudit(req.user.id, 'Post Hall Booking', 'REVENUE', booking, result.approvedBooking, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

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

    const rawHallCharges = hallCharges ?? amount;
    if (!bookerName || !programDate || !hallId || rawHallCharges == null || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }
    const parsedHallCharges = parseFloat(rawHallCharges);
    if (isNaN(parsedHallCharges) || parsedHallCharges <= 0) {
      return res.status(400).json({ error: { message: 'Hall Charges must be greater than 0', status: 400 } });
    }
    const parsedDiscount = discount != null ? parseFloat(discount) : 0;
    if (isNaN(parsedDiscount) || parsedDiscount < 0) {
      return res.status(400).json({ error: { message: 'Discount cannot be negative', status: 400 } });
    }
    if (parsedDiscount > parsedHallCharges) {
      return res.status(400).json({ error: { message: 'Discount cannot exceed Hall Charges', status: 400 } });
    }

    const calculatedNetAmount = parsedHallCharges - parsedDiscount;

    const parsedReceivedAmount = receivedAmount != null ? parseFloat(receivedAmount) : 0;
    if (isNaN(parsedReceivedAmount) || parsedReceivedAmount < 0) {
      return res.status(400).json({ error: { message: 'Received Amount cannot be negative', status: 400 } });
    }
    if (parsedReceivedAmount > calculatedNetAmount) {
      return res.status(400).json({ error: { message: 'Received Amount cannot exceed Net Amount', status: 400 } });
    }

    const calculatedRemainingAmount = calculatedNetAmount - parsedReceivedAmount;

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
    const parsedProgDate = new Date(eventDateStr);
    const startOfDay = new Date(parsedProgDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedProgDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const conflictBooking = await prisma.hallBooking.findFirst({
      where: {
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
        message: 'This hall is already booked on the selected date. Please choose another date.',
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
      const count = await tx.hallBooking.count();
      const nextReceiptNo = count + 1;

      const newBooking = await tx.hallBooking.create({
        data: {
          bookingDate: bookingDate ? new Date(bookingDate) : undefined,
          receiptNo: nextReceiptNo,
          bookerName,
          fatherHusbandName: fatherHusbandName || null,
          address: address || null,
          mobile: mobile || null,
          programDate: new Date(programDate),
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
          refundDate: req.body.refundDate ? new Date(req.body.refundDate) : null,
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

      return newBooking;
    });

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
      const deletedBookings = await prisma.$transaction(async (tx) => {
        const bookings = await tx.hallBooking.findMany({
          where: { id: { in: ids } }
        });

        if (bookings.length === 0) {
          throw new Error('No hall bookings found to delete');
        }

        for (const booking of bookings) {
          if (booking.status === 'POSTED' && booking.journalEntryId) {
            try {
              await AccountingService.deleteJournalEntry(tx, booking.journalEntryId, req.user!.id, 'Hall Booking Deleted');
            } catch (e) {
              // Ignore if already deleted
            }
          }
        }

        await tx.hallBooking.deleteMany({
          where: { id: { in: bookings.map(b => b.id) } }
        });

        return bookings;
      });

      await logAudit(
        req.user.id,
        'Delete Hall Booking',
        'REVENUE',
        null,
        { count: deletedBookings.length, ids: deletedBookings.map(b => b.id) },
        req.headers['x-forwarded-for'] as string,
        req.headers['user-agent']
      );

      return res.status(200).json({
        status: 200,
        message: `${deletedBookings.length} hall booking(s) deleted successfully`,
        data: deletedBookings
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

    const { bookingDate, bookerName, fatherHusbandName, address, mobile, programDate, programType, functionType, timeFrom, timeTo, timings, hallId, isForJamaat, amount, discount, netAmount, receivedAmount, paymentMethod, bankAccountId, chequeNumber, chequeBankName, remarks } = req.body;

    if (!bookerName || !programDate || !hallId || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be greater than 0', status: 400 } });
    }
    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payment methods', status: 400 } });
    }
    const eventDateStr = programDate || bookingDate;
    const parsedProgDate = new Date(eventDateStr);
    const startOfDay = new Date(parsedProgDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedProgDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const conflictBooking = await prisma.hallBooking.findFirst({
      where: {
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
        message: 'This hall is already booked on the selected date. Please choose another date.',
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
          const postingResult = await AccountingService.postReceipt(tx, {
            amount: parsedAmount,
            cashOrBankAccountId: debitAccountId,
            incomeAccountId: hallId,
            reference: `HB-${existingBooking.receiptNo}`,
            description: `Hall Booking Receipt for ${bookerName}`,
            module: 'Hall Booking',
            voucherType: 'BR',
            postedBy: req.user!.id,
            postingDate: new Date(programDate),
          });
          if (postingResult?.journalEntry) {
            newJournalEntryId = postingResult.journalEntry.id;
          }
        }

        const finalStatus = targetStatus === 'Cancelled' || targetStatus === 'Refunded'
          ? targetStatus
          : (wasPosted && newJournalEntryId ? 'POSTED' : 'Confirmed');

        return await tx.hallBooking.update({
          where: { id },
          data: {
            bookingDate: bookingDate ? new Date(bookingDate) : undefined,
            bookerName,
            fatherHusbandName: fatherHusbandName || null,
            address: address || null,
            mobile: mobile || null,
            programDate: new Date(programDate),
            programType: programType || null,
            functionType: functionType || null,
            timeFrom: timeFrom || null,
            timeTo: timeTo || null,
            timings: timings || null,
            hallId,
            isForJamaat: Boolean(isForJamaat),
            amount: parsedAmount,
            discount: discount != null ? parseFloat(discount) : 0,
            netAmount: netAmount != null ? parseFloat(netAmount) : null,
            receivedAmount: receivedAmount != null ? parseFloat(receivedAmount) : null,
            refundAmount: req.body.refundAmount != null ? parseFloat(req.body.refundAmount) : 0,
            refundDate: req.body.refundDate ? new Date(req.body.refundDate) : null,
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
