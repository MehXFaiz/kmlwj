import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('Testing Opening Balances & Trial Balance...');

  // 1. Check current OpeningBalanceBatch
  const batch = await prisma.openingBalanceBatch.findFirst({
    where: { financialYear: 'FY 2026-2027' },
    include: { lines: { include: { account: true } } }
  });

  console.log('Batch found:', batch?.financialYear, 'lines count:', batch?.lines.length);
  for (const l of batch?.lines || []) {
    console.log(`- ${l.account.accountName} (${l.glCode}): amount=${l.amount}, debitCredit=${l.debitCredit}`);
  }

  // 2. Check accounts initialBalance
  const accounts = await prisma.account.findMany({
    where: { id: { in: (batch?.lines || []).map(l => l.accountId) } }
  });
  console.log('Accounts initialBalance in DB:');
  for (const a of accounts) {
    console.log(`- ${a.accountName} (${a.glCode}): initialBalance=${a.initialBalance}, currentBalance=${a.currentBalance}`);
  }

  // 3. Call getTrialBalance('2026-07-01', '2027-06-30')
  const { AccountingService } = await import('../api/_services/accounting.service.js');
  const tb = await AccountingService.getTrialBalance('2026-07-01', '2027-06-30');
  console.log('--- Current TB Opening Balances ---');
  console.log(JSON.stringify(tb.openingBalances, null, 2));
  console.log('--- Current TB Closing Balances ---');
  console.log(JSON.stringify(tb.closingBalances, null, 2));

  await prisma.$disconnect();
}
run();
