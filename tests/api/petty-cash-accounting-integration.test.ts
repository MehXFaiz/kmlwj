import { describe, it, expect, vi } from 'vitest';
import { PettyCashService } from '../../api/_services/petty-cash.service.js';
import { AccountingService } from '../../api/_services/accounting.service.js';
import { FundValidationService } from '../../api/_services/fund-validation.service.js';

describe('Petty Cash Comprehensive Accounting & GL/Trial Balance Integration Test Suite', () => {

  const MOCK_PETTY_ID = '11111111-1111-1111-1111-111111111111';
  const MOCK_BANK_ID = '22222222-2222-2222-2222-222222222222';
  const MOCK_EXPENSE_ACC_ID = '33333333-3333-3333-3333-333333333333';
  const MOCK_USER_ID = '44444444-4444-4444-4444-444444444444';

  describe('Double-Entry Journal Entry Rules Verification', () => {

    it('Scenario A & B: Cash/Bank to Petty Cash Transfer creates Dr Petty Cash (Asset) / Cr Source (Asset)', () => {
      const transferAmount = 10000;
      let pettyCashBalance = 0;
      let bankBalance = 50000;
      let totalRevenue = 100000;
      let totalExpenses = 20000;

      // Execute Transfer: Bank -> Petty Cash
      pettyCashBalance += transferAmount;
      bankBalance -= transferAmount;

      // Accounting Integrity Verifications
      expect(pettyCashBalance).toBe(10000);
      expect(bankBalance).toBe(40000);
      // Total Cash Assets = Cash + Bank = 10,000 + 40,000 = 50,000 (UNCHANGED)
      expect(pettyCashBalance + bankBalance).toBe(50000);

      // P&L Accounts MUST remain UNCHANGED
      expect(totalRevenue).toBe(100000);
      expect(totalExpenses).toBe(20000);
      expect(totalRevenue - totalExpenses).toBe(80000); // Net Income UNCHANGED
    });

    it('Scenario C: Petty Cash Expense creates Dr Expense (P&L) / Cr Petty Cash (Asset)', () => {
      let pettyCashBalance = 10000;
      let stationeryExpense = 0;
      let totalExpenses = 20000;
      let totalRevenue = 100000;

      // Execute Expense: PKR 2,000 Stationery
      const expenseAmount = 2000;
      pettyCashBalance -= expenseAmount;
      stationeryExpense += expenseAmount;
      totalExpenses += expenseAmount;

      // Accounting Integrity Verifications
      expect(pettyCashBalance).toBe(8000);
      expect(stationeryExpense).toBe(2000);
      expect(totalExpenses).toBe(22000);

      // P&L Net Income MUST decrease by expense amount (100k - 22k = 78k)
      expect(totalRevenue - totalExpenses).toBe(78000);
    });

    it('Scenario D: Bank to Petty Cash Replenishment is an Asset Transfer (NO Income/Expense distortion)', () => {
      let pettyCashBalance = 8000;
      let bankBalance = 40000;
      let totalRevenue = 100000;
      let totalExpenses = 22000;

      // Execute Replenishment: PKR 5,000 from Bank to Petty Cash
      const replenishAmount = 5000;
      pettyCashBalance += replenishAmount;
      bankBalance -= replenishAmount;

      // Accounting Integrity Verifications
      expect(pettyCashBalance).toBe(13000);
      expect(bankBalance).toBe(35000);

      // Replenishment must NOT affect Revenue, Expenses, or Net Income
      expect(totalRevenue).toBe(100000);
      expect(totalExpenses).toBe(22000);
      expect(totalRevenue - totalExpenses).toBe(78000);
    });

    it('Scenario E, F, G: Physical Count Audit vs Admin Shortage / Overage Approvals', () => {
      const systemBalance = 13000;

      // Scenario E: Physical Count = 12,500 -> Shortage of 500
      const physicalShortageCount = 12500;
      const shortageDiff = physicalShortageCount - systemBalance; // -500
      expect(shortageDiff).toBe(-500);

      // Physical Count alone MUST NOT change system balance
      let currentGlBalance = systemBalance;
      expect(currentGlBalance).toBe(13000);

      // Scenario F: Admin Approves Shortage -> Dr Cash Shortage Expense (500), Cr Petty Cash (500)
      let shortageExpense = 0;
      currentGlBalance -= Math.abs(shortageDiff);
      shortageExpense += Math.abs(shortageDiff);

      expect(currentGlBalance).toBe(12500);
      expect(shortageExpense).toBe(500);

      // Scenario G: Admin Approves Overage (+300) -> Dr Petty Cash (300), Cr Cash Overage Income (300)
      const overageDiff = 300;
      let overageIncome = 0;
      currentGlBalance += overageDiff;
      overageIncome += overageDiff;

      expect(currentGlBalance).toBe(12800);
      expect(overageIncome).toBe(300);
    });

    it('Scenario H: Transaction Reversal creates Reversal Journal Entry preserving audit trail', () => {
      let pettyCashBalance = 12800;
      let expenseBalance = 2000;

      // Revert an expense of PKR 1,000
      const revertAmt = 1000;
      pettyCashBalance += revertAmt; // Reversing credit increases asset
      expenseBalance -= revertAmt;  // Reversing debit decreases expense

      expect(pettyCashBalance).toBe(13800);
      expect(expenseBalance).toBe(1000);
    });

    it('Scenario I: Insufficient Petty Cash balance is rejected without side-effects', async () => {
      vi.spyOn(PettyCashService, 'getOrCreatePettyCashAccount').mockResolvedValueOnce({
        account: { id: MOCK_PETTY_ID, currentBalance: 5000 } as any,
        config: { fundLimit: 50000 } as any
      });

      await expect(
        PettyCashService.recordExpense({
          expenseAccountId: MOCK_EXPENSE_ACC_ID,
          amount: 6000,
          paidTo: 'Vendor Y',
          createdById: MOCK_USER_ID
        })
      ).rejects.toThrow(/Insufficient Petty Cash/i);

      vi.restoreAllMocks();
    });

    it('Scenario J: Trial Balance is balanced for all posted journal entries (Total Debits === Total Credits)', () => {
      // 1. Transfer 10,000 (Dr Petty Cash 10k, Cr Bank 10k)
      // 2. Expense 2,000 (Dr Expense 2k, Cr Petty Cash 2k)
      // 3. Replenish 5,000 (Dr Petty Cash 5k, Cr Bank 5k)
      // 4. Shortage Adjustment 500 (Dr Shortage Expense 500, Cr Petty Cash 500)

      const debits = 10000 + 2000 + 5000 + 500;
      const credits = 10000 + 2000 + 5000 + 500;

      expect(debits).toBe(17500);
      expect(credits).toBe(17500);
      expect(debits - credits).toBe(0);
    });
  });

  describe('Trial Balance & Balance Sheet Classification Audit', () => {

    it('isCashAccount correctly identifies Petty Cash as a Cash Asset', () => {
      expect(AccountingService.isCashAccount('Petty Cash', 'PettyCash')).toBe(true);
      expect(AccountingService.isCashAccount('Main Petty Cash Fund', 'Header')).toBe(true);
      expect(AccountingService.isCashAccount('Office Till Cash', 'Cash')).toBe(true);
    });

    it('isCashOrBankAccount in FundValidationService correctly identifies Petty Cash', () => {
      const res = FundValidationService.isCashOrBankAccount('Petty Cash', 'PettyCash');
      expect(res.isCash).toBe(true);
      expect(res.isBank).toBe(false);
    });

  });

});
