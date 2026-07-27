import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';
import { AccountingService } from '../../_services/accounting.service.js';
import { FundValidationService } from '../../_services/fund-validation.service.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method, bankAccountId, accountId } = req.query as { method?: string; bankAccountId?: string; accountId?: string };

  let targetAccountId: string | null = accountId || bankAccountId || null;

  if (!targetAccountId) {
    if (method?.toUpperCase() === 'BANK') {
      const bankAcc = await prisma.account.findFirst({
        where: {
          OR: [
            { detailType: { equals: 'Bank', mode: 'insensitive' } },
            { accountName: { contains: 'Bank', mode: 'insensitive' } }
          ],
          isDeleted: false,
          children: { none: {} }
        },
        orderBy: { glCode: 'asc' }
      });
      targetAccountId = bankAcc?.id || null;
    } else {
      // Default to Cash in Hand account
      const cashAcc = await AccountingService.ensureCashInHandAccount(prisma);
      targetAccountId = cashAcc?.id || null;
    }
  }

  if (!targetAccountId) {
    return res.status(404).json({ error: { message: 'Account not found', status: 404 } });
  }

  const { account, availableBalance, isCash, isBank } = await FundValidationService.getAvailableBalance(prisma, targetAccountId);

  return res.status(200).json({
    status: 200,
    data: {
      accountId: account.id,
      glCode: account.glCode,
      accountName: account.accountName,
      availableBalance: Math.max(0, availableBalance),
      rawAvailableBalance: availableBalance,
      isCash,
      isBank
    }
  });
});
