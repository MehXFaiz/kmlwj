import { prisma } from '../api/_prisma.js';
import { AccountingService } from '../api/_services/accounting.service.js';

(async () => {
  console.log('Rebuilding all account balances from posted journal lines...');
  const result = await AccountingService.recalculateAllBalances();
  console.log('Done. Updated:', result.updated, 'accounts');

  const cash = await prisma.account.findFirst({
    where: { OR: [{ glCode: '1010103' }, { accountName: { contains: 'Cash in Hand', mode: 'insensitive' }}] }
  });
  if (cash) {
    console.log(`Cash in Hand: currentBalance=${cash.currentBalance}, initialBalance=${cash.initialBalance}`);
  }
})().catch(console.error).finally(() => prisma.$disconnect());
