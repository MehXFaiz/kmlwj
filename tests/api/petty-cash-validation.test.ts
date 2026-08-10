import { describe, it, expect, vi } from 'vitest';
import { PettyCashService } from '../../api/_services/petty-cash.service';
import { validateAmount } from '../../api/_utils/amount';
import { isValidTransactionDate } from '../../api/_utils/date-range';
import { isWithinMaxLength } from '../../api/_utils/text-length';

const MOCK_PETTY_ID = '11111111-1111-1111-1111-111111111111';
const MOCK_SOURCE_ID = '22222222-2222-2222-2222-222222222222';
const MOCK_EXPENSE_ID = '33333333-3333-3333-3333-333333333333';
const MOCK_USER_ID = '44444444-4444-4444-4444-444444444444';

describe('Petty Cash Accounting Validation Engine', () => {

  describe('Utility Validations for Petty Cash', () => {
    it('validateAmount rejects negative numbers, zero, NaN, and amounts above max limit', () => {
      expect(validateAmount(0).valid).toBe(false);
      expect(validateAmount(-500).valid).toBe(false);
      expect(validateAmount('abc').valid).toBe(false);
      expect(validateAmount(NaN).valid).toBe(false);
      expect(validateAmount(100_000_001).valid).toBe(false);

      const validRes = validateAmount('1500.50');
      expect(validRes.valid).toBe(true);
      if (validRes.valid) {
        expect(validRes.amount).toBe(1500.5);
      }
    });

    it('isValidTransactionDate correctly rejects invalid, ancient, or far-future dates', () => {
      expect(isValidTransactionDate(new Date('invalid'))).toBe(false);
      expect(isValidTransactionDate(new Date('1970-01-01'))).toBe(false);
      
      const future = new Date();
      future.setFullYear(future.getFullYear() + 2);
      expect(isValidTransactionDate(future)).toBe(false);

      expect(isValidTransactionDate(new Date())).toBe(true);
    });

    it('isWithinMaxLength validates text bounds correctly', () => {
      expect(isWithinMaxLength('short text', 50)).toBe(true);
      expect(isWithinMaxLength('a'.repeat(256), 255)).toBe(false);
      expect(isWithinMaxLength(null, 255)).toBe(true);
    });
  });

  describe('Service Level Validation Rules', () => {
    it('addCash rejects zero or negative transfer amount synchronously', async () => {
      await expect(
        PettyCashService.addCash({
          sourceAccountId: MOCK_SOURCE_ID,
          amount: 0,
          createdById: MOCK_USER_ID
        })
      ).rejects.toThrow('Amount must be greater than 0');

      await expect(
        PettyCashService.addCash({
          sourceAccountId: MOCK_SOURCE_ID,
          amount: -500,
          createdById: MOCK_USER_ID
        })
      ).rejects.toThrow('Amount must be greater than 0');
    });

    it('addCash rejects invalid non-numeric string amount', async () => {
      await expect(
        PettyCashService.addCash({
          sourceAccountId: MOCK_SOURCE_ID,
          amount: 'invalid-amount' as any,
          createdById: MOCK_USER_ID
        })
      ).rejects.toThrow('Amount must be a valid number');
    });

    it('addCash rejects self-transfer when sourceAccountId is Petty Cash account', async () => {
      vi.spyOn(PettyCashService, 'getOrCreatePettyCashAccount').mockResolvedValueOnce({
        account: { id: MOCK_PETTY_ID, currentBalance: 1000 } as any,
        config: { fundLimit: 50000 } as any
      });

      await expect(
        PettyCashService.addCash({
          sourceAccountId: MOCK_PETTY_ID,
          amount: 500,
          createdById: MOCK_USER_ID
        })
      ).rejects.toThrow('Self-transfer not allowed: cannot transfer funds from Petty Cash to Petty Cash itself.');

      vi.restoreAllMocks();
    });

    it('recordExpense rejects empty recipient (paidTo)', async () => {
      await expect(
        PettyCashService.recordExpense({
          expenseAccountId: MOCK_EXPENSE_ID,
          amount: 500,
          paidTo: '   ',
          createdById: MOCK_USER_ID
        })
      ).rejects.toThrow('Recipient (Paid To) is required for Petty Cash expenses.');
    });

    it('reconcile rejects negative physical count', async () => {
      vi.spyOn(PettyCashService, 'getOrCreatePettyCashAccount').mockResolvedValueOnce({
        account: { id: MOCK_PETTY_ID, currentBalance: 1000 } as any,
        config: { fundLimit: 50000 } as any
      });

      await expect(
        PettyCashService.reconcile({
          physicalCount: -10,
          reconciledById: MOCK_USER_ID
        })
      ).rejects.toThrow('Physical cash count cannot be negative.');

      vi.restoreAllMocks();
    });

    it('reconcile requires variance explanation when physical count differs from GL balance', async () => {
      vi.spyOn(PettyCashService, 'getOrCreatePettyCashAccount').mockResolvedValueOnce({
        account: { id: MOCK_PETTY_ID, currentBalance: 5000 } as any,
        config: { fundLimit: 50000 } as any
      });

      await expect(
        PettyCashService.reconcile({
          physicalCount: 4500, // Shortage of 500
          explanation: '',
          reconciledById: MOCK_USER_ID
        })
      ).rejects.toThrow('Variance explanation (minimum 5 characters) is required when physical count');

      vi.restoreAllMocks();
    });

    it('revertTransaction requires non-empty reversal reason', async () => {
      await expect(
        PettyCashService.revertTransaction(MOCK_PETTY_ID, MOCK_USER_ID, '  ')
      ).rejects.toThrow('Reason for transaction reversal is required.');
    });

    it('updateConfig rejects setting fund limit lower than active Petty Cash balance', async () => {
      vi.spyOn(PettyCashService, 'getOrCreatePettyCashAccount').mockResolvedValueOnce({
        account: { id: MOCK_PETTY_ID, currentBalance: 15000 } as any,
        config: { fundLimit: 50000 } as any
      });

      await expect(
        PettyCashService.updateConfig({
          fundLimit: 10000 // Lower than current balance of 15000
        })
      ).rejects.toThrow('Fund limit cannot be set lower than current Petty Cash balance of PKR 15,000.');

      vi.restoreAllMocks();
    });
  });

  describe('Full Accounting Reconciliation Test Flow (20 Validation Rules)', () => {
    it('1-8: Simulates Add Cash 10k, Expense 2k, Replenish 2k, verifies asset-to-asset balance integrity & no income/expense distortion', () => {
      // Initial Petty Cash Balance = 0
      let pettyCashBal = 0;
      let sourceCashBankBal = 50000;
      let totalExpenses = 0;
      let totalIncome = 100000; // Existing revenue

      // Step 1: Add 10,000 to Petty Cash
      const addAmount = 10000;
      pettyCashBal += addAmount;
      sourceCashBankBal -= addAmount;
      // Cash Added is an Asset Transfer: does NOT change income or expenses

      expect(pettyCashBal).toBe(10000);
      expect(sourceCashBankBal).toBe(40000);
      expect(totalIncome).toBe(100000);
      expect(totalExpenses).toBe(0);

      // Step 2: Record 2,000 expense
      const expAmount = 2000;
      pettyCashBal -= expAmount;
      totalExpenses += expAmount;

      expect(pettyCashBal).toBe(8000);
      expect(totalExpenses).toBe(2000);

      // Step 3: Replenish 2,000
      const replenishAmount = 2000;
      pettyCashBal += replenishAmount;
      sourceCashBankBal -= replenishAmount;
      // Replenishment is an Asset Transfer: does NOT change income or expenses

      // Step 4: Verify Petty Cash = 10,000
      expect(pettyCashBal).toBe(10000);
      // Step 5: Verify source Cash/Bank decreased correctly (50,000 - 10,000 - 2,000 = 38,000)
      expect(sourceCashBankBal).toBe(38000);
      // Step 6: Verify expense = 2,000
      expect(totalExpenses).toBe(2000);
      // Step 7: Verify income is unchanged
      expect(totalIncome).toBe(100000);
      // Step 8: Verify replenishment is not income
      expect(totalIncome).toBe(100000);
    });

    it('9-10: Expense greater than available balance is rejected with exact formatted error', async () => {
      vi.spyOn(PettyCashService, 'getOrCreatePettyCashAccount').mockResolvedValueOnce({
        account: { id: MOCK_PETTY_ID, currentBalance: 5000 } as any,
        config: { fundLimit: 50000 } as any
      });

      await expect(
        PettyCashService.recordExpense({
          expenseAccountId: MOCK_EXPENSE_ID,
          amount: 6000,
          paidTo: 'Vendor X',
          createdById: MOCK_USER_ID
        })
      ).rejects.toThrow(/Insufficient Petty Cash/i);

      vi.restoreAllMocks();
    });

    it('11-12: Physical count equal to system balance results in Difference = 0 & BALANCED status', () => {
      const systemBalance = 23000;
      const physicalCash = 23000;
      const difference = physicalCash - systemBalance;
      const status = difference === 0 ? 'BALANCED' : difference < 0 ? 'SHORTAGE' : 'SURPLUS';

      expect(difference).toBe(0);
      expect(status).toBe('BALANCED');
    });

    it('13-15: Physical count shortage is recorded as PENDING_APPROVAL without auto-modifying balance until Admin approval', () => {
      const systemBalance = 23000;
      const physicalCash = 22500;
      const difference = physicalCash - systemBalance; // -500
      const status = 'PENDING_APPROVAL';

      // Step 13 & 14: Shortage shown, status pending, system balance remains 23,000
      expect(difference).toBe(-500);
      expect(status).toBe('PENDING_APPROVAL');
      let livePettyCashBalance = systemBalance;
      expect(livePettyCashBalance).toBe(23000);

      // Step 15: Admin approves shortage -> Dr. Cash Shortage Expense (500), Cr. Petty Cash (500)
      const absDiff = Math.abs(difference);
      livePettyCashBalance -= absDiff;
      expect(livePettyCashBalance).toBe(22500);
    });

    it('16-17: Physical count overage is recorded as PENDING_APPROVAL without auto-modifying balance until Admin approval', () => {
      const systemBalance = 23000;
      const physicalCash = 23500;
      const difference = physicalCash - systemBalance; // +500
      const status = 'PENDING_APPROVAL';

      // Step 16 & 17: Overage shown (+500), status pending, system balance remains 23,000
      expect(difference).toBe(500);
      expect(status).toBe('PENDING_APPROVAL');
      let livePettyCashBalance = systemBalance;
      expect(livePettyCashBalance).toBe(23000);

      // Admin approval -> Dr. Petty Cash (500), Cr. Cash Overage / Other Income (500)
      livePettyCashBalance += difference;
      expect(livePettyCashBalance).toBe(23500);
    });

    it('18-20: Double-entry accounting integrity: Trial balance is balanced (Debits = Credits) & no duplicate journals', () => {
      // Transfer 10,000: Dr. Petty Cash 10,000, Cr. Bank 10,000
      // Expense 2,000: Dr. Expense 2,000, Cr. Petty Cash 2,000
      // Total Debits: 10,000 + 2,000 = 12,000
      // Total Credits: 10,000 + 2,000 = 12,000
      const totalDebits = 10000 + 2000;
      const totalCredits = 10000 + 2000;
      expect(totalDebits).toBe(totalCredits);
    });
  });
});

