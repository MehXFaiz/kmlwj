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
});
