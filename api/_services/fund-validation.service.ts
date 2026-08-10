import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';

export class InsufficientFundsError extends Error {
  status: number;
  available: number;
  required: number;
  difference: number;
  isCash: boolean;

  constructor(message: string, available: number, required: number, difference: number, isCash: boolean) {
    super(message);
    this.name = 'InsufficientFundsError';
    this.status = 400;
    this.available = available;
    this.required = required;
    this.difference = difference;
    this.isCash = isCash;
  }
}

export interface ValidateFundsOptions {
  accountId: string;
  requiredAmount: number;
  module: string;
  userId?: string | null;
  paymentMethod?: 'CASH' | 'BANK' | string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class FundValidationService {
  /**
   * Helper to format numbers cleanly with comma separators and up to 2 decimal places.
   */
  /**
   * Helper to format numbers cleanly with comma separators and up to 2 decimal places.
   */
  public static formatAmount(val: number): string {
    const num = Number(val) || 0;
    if (isNaN(num) || !isFinite(num) || Math.abs(num) > 1e14) {
      return '0';
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Checks if an account is a Cash or Bank account.
   */
  public static isCashOrBankAccount(accountName: string, detailType?: string | null): { isCash: boolean; isBank: boolean } {
    const nameLower = (accountName || '').toLowerCase();
    const detailLower = (detailType || '').toLowerCase();

    const isCash = detailLower === 'cash' ||
      (detailLower !== 'bank' && (nameLower.includes('cash') || nameLower.includes('till') || nameLower.includes('petty') || nameLower.includes('hand')));

    const isBank = detailLower === 'bank' ||
      (detailLower !== 'cash' && (nameLower.includes('bank') || nameLower.includes('al-habib') || nameLower.includes('nbp') || nameLower.includes('mcb') || nameLower.includes('ubl') || nameLower.includes('allied') || nameLower.includes('faysal')));

    return { isCash, isBank };
  }

  /**
   * Calculates the exact live available balance for an account directly from JournalEntryLines (Single Source of Truth).
   */
  public static async getAvailableBalance(tx: any, accountId: string): Promise<{ account: any; availableBalance: number; isCash: boolean; isBank: boolean }> {
    // 1. Fetch account
    let account = await tx.account.findUnique({
      where: { id: accountId },
      include: { accountType: true }
    });

    if (!account) {
      throw new Error(`FundValidationService: Account with ID '${accountId}' not found.`);
    }

    // Descend to children if parent account is passed
    const childAccounts = await tx.account.findMany({
      where: { parentId: accountId },
      select: { id: true }
    });
    const targetAccountIds = childAccounts.length > 0
      ? [accountId, ...childAccounts.map((c: any) => c.id)]
      : [accountId];

    // 2. Aggregate posted journal entry lines
    const aggregations = await tx.journalEntryLine.aggregate({
      where: {
        accountId: { in: targetAccountIds },
        journalEntry: {
          status: 'Posted',
          isDeleted: false
        }
      },
      _sum: {
        debit: true,
        credit: true
      }
    });

    const totalDebit = new Prisma.Decimal(aggregations._sum.debit ?? 0);
    const totalCredit = new Prisma.Decimal(aggregations._sum.credit ?? 0);
    const initialBalance = new Prisma.Decimal(account.initialBalance ?? 0);

    const typeName = (account.accountType?.name || 'ASSET').toUpperCase();
    const isDebitNormal = ['ASSET', 'ASSETS', 'EXPENSE', 'EXPENSES'].includes(typeName);
    const availableBalanceDecimal = isDebitNormal
      ? initialBalance.plus(totalDebit).minus(totalCredit)   // debit-normal: ASSET / EXPENSE
      : initialBalance.plus(totalCredit).minus(totalDebit);  // credit-normal: LIABILITY / EQUITY / REVENUE
    
    let availableBalance = availableBalanceDecimal.toNumber();
    if (isNaN(availableBalance) || !isFinite(availableBalance) || Math.abs(availableBalance) > 1e14) {
      availableBalance = Number(account.currentBalance) || 0;
    }

    const { isCash, isBank } = FundValidationService.isCashOrBankAccount(account.accountName, account.detailType);

    return {
      account,
      availableBalance,
      isCash,
      isBank
    };
  }

  /**
   * Atomically validates available funds inside a database transaction with row-level locking.
   * If required amount exceeds available balance, logs audit trail and throws InsufficientFundsError.
   */
  public static async validateAndLockFunds(tx: any, options: ValidateFundsOptions): Promise<{ availableBalance: number; account: any }> {
    const { accountId, requiredAmount, module, userId, paymentMethod, ipAddress, userAgent } = options;

    if (requiredAmount <= 0) {
      return { availableBalance: 0, account: null };
    }

    // 1. Execute row-level lock on Account table using Prisma raw query inside transaction
    let lockedAccount: any = null;
    try {
      const rows: any[] = await tx.$queryRaw`
        SELECT "id", "glCode", "accountName", "initialBalance", "currentBalance", "detailType"
        FROM "Account"
        WHERE "id" = ${accountId}::uuid
        FOR UPDATE
      `;
      if (rows && rows.length > 0) {
        lockedAccount = rows[0];
      }
    } catch (e) {
      // Fallback for non-Postgres test environments
      lockedAccount = await tx.account.findUnique({ where: { id: accountId } });
    }

    // 2. Fetch full account and calculate available balance
    const { account, availableBalance, isCash, isBank } = await FundValidationService.getAvailableBalance(tx, accountId);

    const typeName = (account.accountType?.name || '').toUpperCase();
    const isAsset = typeName === 'ASSET' || typeName === 'ASSETS' || isCash || isBank;

    // Only enforce non-negative fund validation for Asset (Cash, Bank, Zakat, etc.) accounts
    if (!isAsset) {
      return { availableBalance, account };
    }

    // Determine whether payment is Cash or Bank based on flags or paymentMethod
    const isCashPayment = paymentMethod ? paymentMethod.toUpperCase() === 'CASH' : isCash;

    // 3. Check for Insufficient Funds
    if (requiredAmount > availableBalance) {
      const safeAvailable = Math.max(0, availableBalance);
      const shortfall = Math.max(0, requiredAmount - safeAvailable);

      const formattedAvailable = FundValidationService.formatAmount(availableBalance);
      const formattedRequired = FundValidationService.formatAmount(requiredAmount);
      const formattedShortfall = FundValidationService.formatAmount(shortfall);

      const errorMessage = isCashPayment
        ? `Insufficient Cash Balance.\nAvailable Cash: Rs ${formattedAvailable}\nRequired Amount: Rs ${formattedRequired}\nShortfall: Rs ${formattedShortfall}`
        : `Insufficient Bank Balance.\nAvailable Balance: Rs ${formattedAvailable}\nRequired Amount: Rs ${formattedRequired}\nShortfall: Rs ${formattedShortfall}`;

      // 4. Log Audit Trail Entry inside transaction prior to throwing
      try {
        await tx.auditLog.create({
          data: {
            userId: userId && typeof userId === 'string' && userId.length === 36 ? userId : null,
            action: 'Rejected - Insufficient Funds',
            module: module || 'Accounting Engine',
            oldValues: {
              availableBalance,
              accountName: account.accountName,
              glCode: account.glCode
            },
            newValues: {
              user: userId || 'System',
              module: module || 'Accounting Engine',
              amount: requiredAmount,
              availableBalance,
              requiredBalance: requiredAmount,
              shortfall,
              timestamp: new Date().toISOString(),
              reason: 'Insufficient Funds'
            },
            ipAddress: ipAddress || null,
            userAgent: userAgent || null
          }
        });
      } catch (auditErr) {
        console.warn('Audit log creation failed during fund validation rejection:', auditErr);
      }

      // 5. Reject transaction
      throw new InsufficientFundsError(
        errorMessage,
        availableBalance,
        requiredAmount,
        shortfall,
        isCashPayment
      );
    }

    return { availableBalance, account };
  }
}
