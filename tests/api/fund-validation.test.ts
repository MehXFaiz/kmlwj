import { describe, it, expect } from 'vitest';
import { FundValidationService, InsufficientFundsError } from '../../api/_services/fund-validation.service';
import { AccountingService } from '../../api/_services/accounting.service';

describe('Strict Fund Validation & Financial Integrity Engine', () => {
  it('FundValidationService.formatAmount formats numbers with standard comma separators', () => {
    expect(FundValidationService.formatAmount(5000)).toBe('5,000');
    expect(FundValidationService.formatAmount(1250.5)).toBe('1,250.50');
    expect(FundValidationService.formatAmount(0)).toBe('0');
  });

  it('FundValidationService.isCashOrBankAccount correctly identifies Cash and Bank accounts', () => {
    const cashCheck = FundValidationService.isCashOrBankAccount('Cash in Hand', 'Cash');
    expect(cashCheck.isCash).toBe(true);
    expect(cashCheck.isBank).toBe(false);

    const bankCheck = FundValidationService.isCashOrBankAccount('Meezan Bank Operational', 'Bank');
    expect(bankCheck.isCash).toBe(false);
    expect(bankCheck.isBank).toBe(true);

    const pettyCheck = FundValidationService.isCashOrBankAccount('Petty Cash Till', null);
    expect(pettyCheck.isCash).toBe(true);
  });

  it('InsufficientFundsError contains exact status 400 and structured fields', () => {
    const err = new InsufficientFundsError(
      'Insufficient Cash Balance.\nAvailable Cash: Rs 1,000\nRequired Amount: Rs 5,000\nShortfall: Rs 4,000',
      1000,
      5000,
      4000,
      true
    );

    expect(err.status).toBe(400);
    expect(err.available).toBe(1000);
    expect(err.required).toBe(5000);
    expect(err.difference).toBe(4000);
    expect(err.isCash).toBe(true);
    expect(err.message).toContain('Insufficient Cash Balance.');
    expect(err.message).toContain('Available Cash: Rs 1,000');
    expect(err.message).toContain('Required Amount: Rs 5,000');
    expect(err.message).toContain('Shortfall: Rs 4,000');
  });

  it('Bank InsufficientFundsError formats Bank message properly', () => {
    const err = new InsufficientFundsError(
      'Insufficient Bank Balance.\nAvailable Balance: Rs 500\nRequired Amount: Rs 2,000\nShortfall: Rs 1,500',
      500,
      2000,
      1500,
      false
    );

    expect(err.status).toBe(400);
    expect(err.message).toContain('Insufficient Bank Balance.');
    expect(err.message).toContain('Available Balance: Rs 500');
    expect(err.message).toContain('Required Amount: Rs 2,000');
    expect(err.message).toContain('Shortfall: Rs 1,500');
  });

  it('AccountingService financial summary clamps cash and bank balances to non-negative values', async () => {
    const summary = await AccountingService.getFinancialSummary();
    expect(summary.cashBalance).toBeGreaterThanOrEqual(0);
    expect(summary.bankBalance).toBeGreaterThanOrEqual(0);
  });

  it('FundValidationService.validateAndLockFunds rejects negative fund transactions inside mock transaction', async () => {
    const mockTx = {
      $queryRaw: async () => [{ id: 'mock-id', glCode: '1010101', accountName: 'Cash in Hand', initialBalance: 0, currentBalance: 100, detailType: 'Cash' }],
      account: {
        findUnique: async () => ({ id: 'mock-id', glCode: '1010101', accountName: 'Cash in Hand', initialBalance: 0, currentBalance: 100, detailType: 'Cash', accountType: { name: 'ASSET' } }),
        // getAvailableBalance rolls child accounts into the parent's balance;
        // this mock account is a leaf, so it has none.
        findMany: async () => [],
        // The insufficient-funds branch looks for a separate primary Cash in
        // Hand account to fall back to. There isn't one here, so the shortfall
        // must be reported rather than satisfied elsewhere.
        findFirst: async () => null
      },
      journalEntryLine: {
        aggregate: async () => ({ _sum: { debit: 100, credit: 0 } })
      },
      auditLog: {
        create: async () => {}
      }
    };

    // Available: 100, Required: 500 -> Should fail with InsufficientFundsError
    await expect(
      FundValidationService.validateAndLockFunds(mockTx, {
        accountId: 'mock-id',
        requiredAmount: 500,
        module: 'Expenses',
        userId: '11111111-2222-3333-4444-555555555555',
        paymentMethod: 'CASH'
      })
    ).rejects.toThrow(InsufficientFundsError);
  });

  it('FundValidationService.validateAndLockFunds succeeds when available balance is sufficient', async () => {
    const mockTx = {
      $queryRaw: async () => [{ id: 'mock-id', glCode: '1010101', accountName: 'Cash in Hand', initialBalance: 1000, currentBalance: 1000, detailType: 'Cash' }],
      account: {
        findUnique: async () => ({ id: 'mock-id', glCode: '1010101', accountName: 'Cash in Hand', initialBalance: 1000, currentBalance: 1000, detailType: 'Cash', accountType: { name: 'ASSET' } }),
        findMany: async () => [],
        findFirst: async () => null
      },
      journalEntryLine: {
        aggregate: async () => ({ _sum: { debit: 0, credit: 0 } })
      },
      auditLog: {
        create: async () => {}
      }
    };

    // Available: 1000, Required: 300 -> Should succeed
    const res = await FundValidationService.validateAndLockFunds(mockTx, {
      accountId: 'mock-id',
      requiredAmount: 300,
      module: 'Expenses',
      userId: '11111111-2222-3333-4444-555555555555',
      paymentMethod: 'CASH'
    });

    expect(res.availableBalance).toBe(1000);
  });
});
