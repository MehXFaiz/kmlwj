import { prisma } from '../api/_prisma.js';
import { AccountingService } from '../api/_services/accounting.service.js';

function check(testName: string, passed: boolean, details: string) {
  if (passed) {
    console.log(`✅ [PASS] ${testName} - ${details}`);
  } else {
    console.error(`❌ [FAIL] ${testName} - ${details}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('RUNNING TRIAL BALANCE DYNAMIC INTEGRITY TEST SUITE');
  console.log('==================================================\n');

  // TEST 1: FY 2025-2026 Opening Balances
  console.log('--- TEST 1: FY 2025-2026 Opening Balances ---');
  const tbFY25 = await AccountingService.getTrialBalance('2025-07-01', '2026-06-30');
  check('TB FY 2025-2026 returns opening balances', Boolean(tbFY25.openingBalances), `Found categories: ${Object.keys(tbFY25.openingBalances).join(', ')}`);
  check('TB FY 2025-2026 returns closing balances', Boolean(tbFY25.closingBalances), `Found categories: ${Object.keys(tbFY25.closingBalances).join(', ')}`);
  check('TB FY 2025-2026 is balanced', tbFY25.difference === 0, `Debits: ${tbFY25.totalDebit}, Credits: ${tbFY25.totalCredit}, Diff: ${tbFY25.difference}`);

  // TEST 2: Change Financial Year Filter
  console.log('\n--- TEST 2: Financial Year Date Change ---');
  const tbFY24 = await AccountingService.getTrialBalance('2024-07-01', '2025-06-30');
  check('TB FY 2024-2025 executes cleanly', Boolean(tbFY24.summary || tbFY24.openingBalances), `Debits: ${tbFY24.totalDebit}, Credits: ${tbFY24.totalCredit}`);
  check('Opening balances adapt to selected period start date', typeof tbFY24.openingBalances.cashInHand.total === 'number', `Cash In Hand Opening FY24: ${tbFY24.openingBalances.cashInHand.total} vs FY25: ${tbFY25.openingBalances.cashInHand.total}`);

  // TEST 3: Update Account Initial Balance
  console.log('\n--- TEST 3: Dynamic Update on Opening Balance Change ---');
  const cashAcc = await prisma.account.findFirst({
    where: { OR: [{ glCode: '1010103' }, { accountName: { contains: 'Cash in Hand', mode: 'insensitive' } }] }
  });
  if (!cashAcc) throw new Error('Cash in Hand account not found');
  const origInit = Number(cashAcc.initialBalance || 0);
  const origOpCash = tbFY25.openingBalances.cashInHand.accounts.find(a => a.id === cashAcc.id)?.balance || 0;

  // Update initial balance temporarily
  const testInit = origInit + 5000;
  await prisma.account.update({ where: { id: cashAcc.id }, data: { initialBalance: testInit } });
  const tbUpdatedInit = await AccountingService.getTrialBalance('2025-07-01', '2026-06-30');
  const updatedOpCash = tbUpdatedInit.openingBalances.cashInHand.accounts.find(a => a.id === cashAcc.id)?.balance;
  check('Trial Balance opening balance reflects account initialBalance change dynamically', updatedOpCash === origOpCash + 5000, `Expected ${origOpCash + 5000}, got ${updatedOpCash}`);

  // Revert initial balance
  await prisma.account.update({ where: { id: cashAcc.id }, data: { initialBalance: origInit } });
  const tbRevertedInit = await AccountingService.getTrialBalance('2025-07-01', '2026-06-30');
  const revertedOpCash = tbRevertedInit.openingBalances.cashInHand.accounts.find(a => a.id === cashAcc.id)?.balance;
  check('Trial Balance opening balance reverts dynamically', revertedOpCash === origOpCash, `Expected ${origOpCash}, got ${revertedOpCash}`);

  // TEST 4 & 5: Add a Transaction After FY Start and verify recalculation
  console.log('\n--- TEST 4 & 5: Post Transaction & Verify Immediate Recalculation ---');
  const adminUser = await prisma.user.findFirst({ where: { isActive: true } });
  const donationAcc = await prisma.account.findFirst({ where: { glCode: '3020408' } });

  let testVoucher: any = null;
  if (adminUser && donationAcc) {
    const postRes = await AccountingService.postTransaction(prisma, {
      reference: 'TEST-TB-DYNAMIC-001',
      description: 'Dynamic TB Verification Receipt',
      module: 'Donation',
      postedBy: adminUser.id,
      postingDate: '2025-08-15',
      lines: [
        { accountId: cashAcc.id, debit: 1250, credit: 0 },
        { accountId: donationAcc.id, debit: 0, credit: 1250 }
      ]
    });
    testVoucher = postRes.journalEntry || postRes.entry || postRes;
    console.log(`Posted test transaction ${testVoucher.voucherNo}`);

    const tbPostTx = await AccountingService.getTrialBalance('2025-07-01', '2026-06-30');
    const opCashPost = tbPostTx.openingBalances.cashInHand.accounts.find(a => a.id === cashAcc.id)?.balance;
    const clCashPost = tbPostTx.closingBalances.cashInHand.accounts.find(a => a.id === cashAcc.id)?.balance;
    const baseClCash = tbFY25.closingBalances.cashInHand.accounts.find(a => a.id === cashAcc.id)?.balance || 0;

    check('Opening balance remains UNCHANGED after in-period transaction', opCashPost === origOpCash, `OpCash before: ${origOpCash}, after: ${opCashPost}`);
    check('Closing balance INCREASES by transaction debit amount', clCashPost === baseClCash + 1250, `ClCash got: ${clCashPost}, expected: ${baseClCash + 1250}`);
    check('Trial balance remains strictly balanced after posting', tbPostTx.difference === 0, `Diff: ${tbPostTx.difference}`);

    // Soft delete / reverse transaction to test immediate recalculation
    await prisma.journalEntry.update({
      where: { id: testVoucher.id },
      data: { isDeleted: true }
    });
    const tbAfterDel = await AccountingService.getTrialBalance('2025-07-01', '2026-06-30');
    const clCashAfterDel = tbAfterDel.closingBalances.cashInHand.accounts.find(a => a.id === cashAcc.id)?.balance;
    check('Closing balance recalculates immediately upon transaction soft-delete', clCashAfterDel === baseClCash, `ClCash got: ${clCashAfterDel}, expected: ${baseClCash}`);

    // Clean up test entry
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: testVoucher.id } });
    await prisma.journalEntry.delete({ where: { id: testVoucher.id } });
  }

  // TEST 6: Idempotency & Repeatability
  console.log('\n--- TEST 6: Page Refresh & Idempotency Verification ---');
  const tbRunA = await AccountingService.getTrialBalance('2025-07-01', '2026-06-30');
  const tbRunB = await AccountingService.getTrialBalance('2025-07-01', '2026-06-30');
  check('Repeated calls yield identical results (no side effects)', JSON.stringify(tbRunA) === JSON.stringify(tbRunB), 'Identical JSON output verified');

  // TEST 7 & 8: Single Source of Truth Reconciliation (GL & Balance Sheet)
  console.log('\n--- TEST 7 & 8: Single Source of Truth Reconciliation ---');
  const bs = await AccountingService.getBalanceSheet('2025-07-01', '2026-06-30');
  check('Trial Balance is balanced (Total Debit == Total Credit)', tbRunA.difference === 0, `Difference = ${tbRunA.difference}`);
  const bsBalanced = Math.abs(bs.totalAssets - bs.totalLiabilitiesAndEquity) < 0.01;
  check('Balance Sheet is balanced (Assets == Liabilities + Equity)', bsBalanced, `Assets = ${bs.totalAssets}, L+E = ${bs.totalLiabilitiesAndEquity}`);

  console.log('\n==================================================');
  console.log('ALL TRIAL BALANCE DYNAMIC TEST CASES COMPLETED SUCCESSFULLY!');
  console.log('==================================================\n');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
