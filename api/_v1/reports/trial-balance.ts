import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    // Enforce VIEW_REPORTS permission
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
    const isSuperAdmin = user?.role.name === 'Super Admin';

    if (!isSuperAdmin && !userPerms.includes('VIEW_REPORTS')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    // Fetch accounts with non-zero balances
    const activeAccounts = await prisma.account.findMany({
      where: {
        NOT: {
          currentBalance: 0
        }
      },
      include: {
        accountType: true
      },
      orderBy: { glCode: 'asc' }
    });

    let totalDebit = 0;
    let totalCredit = 0;

    const formatted = activeAccounts.map((acc) => {
      let debit = 0;
      let credit = 0;

      // In our system, currentBalance is:
      // - (Sum of Debits) - (Sum of Credits) for ASSET and EXPENSE (debit-normal).
      // - (Sum of Credits) - (Sum of Debits) for LIABILITY, EQUITY, and REVENUE (credit-normal).
      const typeName = acc.accountType?.name?.toUpperCase() || 'ASSET';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);

      if (isDebitNormal) {
        if (acc.currentBalance > 0) {
          debit = acc.currentBalance;
        } else if (acc.currentBalance < 0) {
          credit = Math.abs(acc.currentBalance);
        }
      } else {
        if (acc.currentBalance > 0) {
          credit = acc.currentBalance;
        } else if (acc.currentBalance < 0) {
          debit = Math.abs(acc.currentBalance);
        }
      }

      totalDebit += debit;
      totalCredit += credit;

      return {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountType: acc.accountType?.name || 'Unknown',
        debit,
        credit
      };
    });

    return res.status(200).json({
      status: 200,
      data: {
        entries: formatted,
        summary: {
          totalDebit,
          totalCredit,
          isBalanced: Math.abs(totalDebit - totalCredit) < 0.001
        }
      }
    });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
