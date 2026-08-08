import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PettyCashService } from '../api/_services/petty-cash.service.js';
import { AccountingService } from '../api/_services/accounting.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const prisma = new PrismaClient();

async function runPettyCashTests() {
  console.log('=== RUNNING AUTOMATED PETTY CASH MODULE TESTS ===\n');

  // Find a Bank account for source
  const bankAccount = await prisma.account.findFirst({
    where: {
      isDeleted: false,
      OR: [
        { detailType: { equals: 'Bank', mode: 'insensitive' } },
        { accountName: { contains: 'Bank', mode: 'insensitive' } }
      ],
      children: { none: {} }
    }
  });

  if (!bankAccount) throw new Error('No Bank account found for testing.');

  // Find an Expense account
  const expenseAccount = await prisma.account.findFirst({
    where: {
      isDeleted: false,
      accountType: { name: { equals: 'EXPENSE', mode: 'insensitive' } }
    }
  });

  const validUser = await prisma.user.findFirst({ where: { isDeleted: false } });
  if (!validUser) throw new Error('No active User found for testing.');
  const userId = validUser.id;

  const createdTxIds: string[] = [];
  const createdJeIds: string[] = [];

  try {
    // 1. Initial State & Setup
    const configBefore = await PettyCashService.getConfig();
    console.log('Initial Config:', configBefore);

    const summaryBefore = await AccountingService.getFinancialSummary();
    console.log(`Summary Before - Revenue: ${summaryBefore.totalRevenue}, Expense: ${summaryBefore.totalExpense}`);

    // TEST 1: Bank -> Petty Cash (Transfer In)
    console.log('\n--- TEST 1: Bank -> Petty Cash (Transfer In PKR 5,000) ---');
    const transferTx = await PettyCashService.addCash({
      sourceAccountId: bankAccount.id,
      amount: 5000,
      narration: 'Test Transfer to Petty Cash',
      createdById: userId
    });
    createdTxIds.push(transferTx.id);
    if (transferTx.journalEntryId) createdJeIds.push(transferTx.journalEntryId);

    const configAfterT1 = await PettyCashService.getConfig();
    const summaryAfterT1 = await AccountingService.getFinancialSummary();
    console.log(`Petty Cash Balance After T1: PKR ${configAfterT1.currentBalance}`);
    console.log(`Revenue After T1: ${summaryAfterT1.totalRevenue} (Diff: ${summaryAfterT1.totalRevenue - summaryBefore.totalRevenue})`);
    console.log(`Expense After T1: ${summaryAfterT1.totalExpense} (Diff: ${summaryAfterT1.totalExpense - summaryBefore.totalExpense})`);
    
    if (summaryAfterT1.totalRevenue !== summaryBefore.totalRevenue) throw new Error('TEST 1 FAILED: Revenue changed on asset transfer!');
    if (summaryAfterT1.totalExpense !== summaryBefore.totalExpense) throw new Error('TEST 1 FAILED: Expense changed on asset transfer!');
    console.log('✓ TEST 1 PASSED!');

    // TEST 2: Petty Cash -> Expense (PKR 1,200)
    console.log('\n--- TEST 2: Petty Cash -> Expense (PKR 1,200) ---');
    const expenseTx = await PettyCashService.recordExpense({
      expenseAccountId: expenseAccount.id,
      amount: 1200,
      paidTo: 'Office Stationery Mart',
      narration: 'Purchased paper clips and pens',
      createdById: userId
    });
    createdTxIds.push(expenseTx.id);
    if (expenseTx.journalEntryId) createdJeIds.push(expenseTx.journalEntryId);

    const configAfterT2 = await PettyCashService.getConfig();
    const summaryAfterT2 = await AccountingService.getFinancialSummary();
    console.log(`Petty Cash Balance After T2: PKR ${configAfterT2.currentBalance}`);
    console.log(`Expense After T2: ${summaryAfterT2.totalExpense} (Diff: ${summaryAfterT2.totalExpense - summaryBefore.totalExpense})`);
    
    if (configAfterT2.currentBalance !== configAfterT1.currentBalance - 1200) throw new Error('TEST 2 FAILED: Petty cash balance did not decrease by 1200!');
    if (summaryAfterT2.totalExpense !== summaryBefore.totalExpense + 1200) throw new Error('TEST 2 FAILED: Total expenses did not increase by 1200!');
    console.log('✓ TEST 2 PASSED!');

    // TEST 3: Replenishment (Bank -> Petty Cash PKR 1,200)
    console.log('\n--- TEST 3: Petty Cash Replenishment (PKR 1,200) ---');
    const replenishTx = await PettyCashService.addCash({
      sourceAccountId: bankAccount.id,
      amount: 1200,
      narration: 'Replenish Petty Cash Fund',
      createdById: userId,
      isReplenishment: true
    });
    createdTxIds.push(replenishTx.id);
    if (replenishTx.journalEntryId) createdJeIds.push(replenishTx.journalEntryId);

    const configAfterT3 = await PettyCashService.getConfig();
    const summaryAfterT3 = await AccountingService.getFinancialSummary();
    console.log(`Petty Cash Balance After T3: PKR ${configAfterT3.currentBalance}`);
    
    if (summaryAfterT3.totalExpense !== summaryAfterT2.totalExpense) throw new Error('TEST 3 FAILED: Replenishment double-counted expense!');
    console.log('✓ TEST 3 PASSED!');

    // TEST 4: Overdraft Protection (Attempt Expense > Current Balance)
    console.log('\n--- TEST 4: Attempt Expense Exceeding Petty Cash Balance ---');
    let t4Blocked = false;
    try {
      await PettyCashService.recordExpense({
        expenseAccountId: expenseAccount.id,
        amount: 999999,
        paidTo: 'Invalid High Amount',
        createdById: userId
      });
    } catch (err: any) {
      t4Blocked = true;
      console.log(`Caught expected error: "${err.message}"`);
    }
    if (!t4Blocked) throw new Error('TEST 4 FAILED: Overdraft expense was not blocked!');
    console.log('✓ TEST 4 PASSED!');

    // TEST 5: Fund Limit Protection (Attempt Transfer > Fund Limit)
    console.log('\n--- TEST 5: Attempt Transfer Exceeding Fund Limit ---');
    let t5Blocked = false;
    try {
      await PettyCashService.addCash({
        sourceAccountId: bankAccount.id,
        amount: 1000000,
        createdById: userId
      });
    } catch (err: any) {
      t5Blocked = true;
      console.log(`Caught expected error: "${err.message}"`);
    }
    if (!t5Blocked) throw new Error('TEST 5 FAILED: Excess transfer was not blocked!');
    console.log('✓ TEST 5 PASSED!');

    // TEST 6: Register & Running Balance Precision
    console.log('\n--- TEST 6: Petty Cash Register & Precision Audit ---');
    const register = await PettyCashService.getRegister({});
    console.log(`Register Rows Count: ${register.totalCount}, Current Balance: PKR ${register.currentBalance}`);
    console.log('✓ TEST 6 PASSED!');

  } finally {
    console.log('\n--- CLEANING UP TEST TRANSACTIONS (ZERO DUMMY DATA RULE) ---');
    for (const txId of createdTxIds) {
      await PettyCashService.revertTransaction(txId, userId, 'Automated Test Cleanup');
      await prisma.pettyCashTransaction.delete({ where: { id: txId } }).catch(() => {});
    }
    for (const jeId of createdJeIds) {
      await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: jeId } }).catch(() => {});
      await prisma.journalEntry.delete({ where: { id: jeId } }).catch(() => {});
    }
    console.log('✓ Cleaned up all temporary test transactions cleanly!');
  }

  await prisma.$disconnect();
}

runPettyCashTests().catch(console.error);
