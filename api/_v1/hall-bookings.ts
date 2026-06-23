import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';

function generateVoucherNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BR-${year}${month}-${randomStr}`;
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const action = req.query.action as string;

  if (method === 'GET') {
    const bookings = await prisma.hallBooking.findMany({
      include: {
        hallAccount: true,
        bankAccount: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ status: 200, data: bookings });
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
        const cashAccount = await prisma.account.findFirst({
          where: { accountName: { contains: 'Cash', mode: 'insensitive' } }
        });
        if (!cashAccount) return res.status(400).json({ error: { message: 'Cash account not found in Chart of Accounts', status: 400 } });
        debitAccountId = cashAccount.id;
      } else {
        if (!booking.bankAccountId) return res.status(400).json({ error: { message: 'Bank account is required for BANK/CHEQUE payments', status: 400 } });
        debitAccountId = booking.bankAccountId;
      }

      // Perform the transaction
      const result = await prisma.$transaction(async (tx) => {
        const voucherNo = generateVoucherNumber();
        const description = `Hall Booking Receipt for ${booking.bookerName} - ${booking.hallAccount?.accountName}`;
        const postingDate = booking.bookingDate || new Date();

        // Create Journal Entry
        const journalEntry = await tx.journalEntry.create({
          data: {
            voucherNo,
            postingDate,
            subsidiary: 'Global',
            reference: `HB-${booking.receiptNo}`,
            description,
            postedBy: req.user!.id,
            status: 'Posted',
            voucherType: 'BR',
            lines: {
              create: [
                { accountId: debitAccountId!, debit: booking.amount, credit: 0, description: 'Bank Receipt' },
                { accountId: revenueAccountId, debit: 0, credit: booking.amount, description: 'Hall Revenue' }
              ]
            }
          }
        });

        const approvedBooking = await tx.hallBooking.update({
          where: { id },
          data: { 
            status: 'POSTED',
            journalEntryId: journalEntry.id 
          }
        });

        // Update Account Balances
        await tx.account.update({ where: { id: debitAccountId! }, data: { currentBalance: { increment: booking.amount } } });
        await tx.account.update({ where: { id: revenueAccountId }, data: { currentBalance: { decrement: booking.amount } } });

        // Create Ledger Entries
        await tx.ledgerEntry.createMany({
          data: [
            { accountId: debitAccountId!, debit: booking.amount, credit: 0, reference: voucherNo, description, postingDate },
            { accountId: revenueAccountId, debit: 0, credit: booking.amount, reference: voucherNo, description, postingDate }
          ]
        });

        return { approvedBooking, journalEntry };
      });

      await logAudit(req.user.id, 'Post Hall Booking', 'REVENUE', booking, result.approvedBooking, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return res.status(200).json({ status: 200, data: result.approvedBooking, message: 'Booking posted and journal entries created successfully' });
    }

    // Action: Create Booking
    const { bookingDate, bookerName, address, mobile, programDate, programType, timings, hallId, isForJamaat, amount, paymentMethod, bankAccountId, remarks } = req.body;

    if (!bookerName || !programDate || !hallId || !amount || !paymentMethod) {
      return res.status(400).json({ error: { message: 'Missing required fields', status: 400 } });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be greater than 0', status: 400 } });
    }
    if ((paymentMethod === 'BANK' || paymentMethod === 'CHEQUE') && !bankAccountId) {
      return res.status(400).json({ error: { message: 'Bank account is required for Bank/Cheque payment methods', status: 400 } });
    }

    const newBooking = await prisma.hallBooking.create({
      data: {
        bookingDate: bookingDate ? new Date(bookingDate) : undefined,
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
        status: 'Confirmed',
        remarks: remarks || null,
        createdById: req.user.id,
      },
    });

    await logAudit(req.user.id, 'Create Hall Booking', 'REVENUE', null, newBooking, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newBooking });
  }

  if (method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: { message: 'Booking ID is required', status: 400 } });

    const booking = await prisma.hallBooking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: { message: 'Booking not found', status: 404 } });
    if (booking.status === 'POSTED') return res.status(400).json({ error: { message: 'Cannot delete a posted booking. Void the voucher first.', status: 400 } });

    await prisma.hallBooking.delete({ where: { id } });

    await logAudit(req.user.id, 'Delete Hall Booking', 'REVENUE', booking, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Booking deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
