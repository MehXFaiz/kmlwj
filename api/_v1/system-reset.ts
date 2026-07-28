import type { VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin } from '../_utils/soft-delete.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  // Only Super Admin or users with SYSTEM_SETTINGS permission can reset financial data
  if (!await verifyPermission(req, res, PERMS.SYSTEM_SETTINGS) && !await isSuperAdmin(req)) {
    return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can reset system financial data', status: 403 } });
  }

  const financialNotificationModules = [
    'Journal Entries',
    'Journal',
    'Income',
    'Simple Income',
    'Expense',
    'Expenses',
    'Simple Expense',
    'Invoices',
    'Revenue',
    'Hall Booking',
    'Hall Bookings',
    'Donations Given',
    'Donations Received',
    'Zakat',
    'Zakat Card',
    'Zakat Cards',
  ];

  try {
    const results = await prisma.$transaction(async (tx) => {
      // 1. Delete Zakat Cards
      const zcCount = await tx.zakatCard.deleteMany({});

      // 2. Delete Journal Entry Lines
      const jelCount = await tx.journalEntryLine.deleteMany({});

      // 3. Delete Journal Entries
      const jeCount = await tx.journalEntry.deleteMany({});

      // 4. Delete Donations (Given)
      const donGivenCount = await tx.donation.deleteMany({});

      // 5. Delete Donations Received
      const donRecvCount = await tx.donationReceived.deleteMany({});

      // 6. Delete Simple Expenses
      const seCount = await tx.simpleExpense.deleteMany({});

      // 7. Delete Simple Incomes
      const siCount = await tx.simpleIncome.deleteMany({});

      // 8. Delete Revenue Collections
      const rcCount = await tx.revenueCollection.deleteMany({});

      // 9. Delete Invoice Items & Invoices
      const invItemCount = await tx.invoiceItem.deleteMany({});
      const invCount = await tx.invoice.deleteMany({});

      // 10. Delete Hall Bookings
      const hbCount = await tx.hallBooking.deleteMany({});

      // 11. Delete Financial Notifications
      const notifCount = await tx.notification.deleteMany({
        where: { module: { in: financialNotificationModules } },
      });

      // 12. Reset Account initialBalance and currentBalance to 0 across all accounts
      const accUpdate = await tx.account.updateMany({
        data: {
          initialBalance: 0,
          currentBalance: 0,
        },
      });

      // 13. Reset RevenueHead amounts to 0
      const revHeadUpdate = await tx.revenueHead.updateMany({
        data: { amount: 0 },
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
        notifCount: notifCount.count,
        accCount: accUpdate.count,
        revHeadCount: revHeadUpdate.count,
      };
    }, { timeout: 60000 });

    await logAudit(
      req.user.id,
      'Reset System Financial Data',
      'SYSTEM_SETTINGS',
      null,
      results,
      req.headers['x-forwarded-for'] as string,
      req.headers['user-agent']
    );

    const message = 'System financial data has been successfully reset.\n\nAll calculations are now starting from zero.\n\nMaster data has been preserved.';

    return res.status(200).json({
      status: 200,
      message,
      data: results,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: {
        message: 'Failed to reset financial data',
        details: error?.message,
        status: 500,
      },
    });
  }
});
