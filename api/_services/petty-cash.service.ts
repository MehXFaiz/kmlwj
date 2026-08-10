import { PrismaClient, Prisma } from '@prisma/client';
import { FundValidationService } from './fund-validation.service.js';
import { validateAmount } from '../_utils/amount.js';
import { isValidTransactionDate } from '../_utils/date-range.js';
import { isWithinMaxLength } from '../_utils/text-length.js';
import { BalanceRebuildService } from './balance-rebuild.service.js';

const prisma = new PrismaClient();

export class PettyCashService {
  /**
   * Get or automatically provision the GL Account for Petty Cash under Assets -> Cash & Bank
   */
  static async getOrCreatePettyCashAccount() {
    let account = await prisma.account.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { accountName: { equals: 'Petty Cash', mode: 'insensitive' } },
          { detailType: { equals: 'PettyCash', mode: 'insensitive' } }
        ]
      },
      include: { accountType: true }
    });

    if (!account) {
      // Find Asset AccountType
      const assetType = await prisma.accountType.findFirst({
        where: { name: { equals: 'ASSET', mode: 'insensitive' } }
      });

      // Find parent Cash & Bank account
      const parentCashBank = await prisma.account.findFirst({
        where: {
          isDeleted: false,
          OR: [
            { accountName: { contains: 'Cash', mode: 'insensitive' } },
            { accountName: { contains: 'Bank', mode: 'insensitive' } }
          ],
          accountLevel: { in: ['PARENT', 'SUBSIDIARY'] }
        }
      });

      // Generate next 7-digit GL Code starting 1010104
      const existingAccounts = await prisma.account.findMany({
        where: { glCode: { startsWith: '1010' } },
        select: { glCode: true }
      });

      let nextNum = 104;
      const codes = existingAccounts
        .map(a => parseInt(a.glCode, 10))
        .filter(n => !isNaN(n) && n >= 1010100 && n < 1010200);

      if (codes.length > 0) {
        nextNum = Math.max(...codes) + 1 - 1010000;
      }
      const glCode = `1010${String(nextNum).padStart(3, '0')}`;

      account = await prisma.account.create({
        data: {
          glCode,
          accountName: 'Petty Cash',
          accountLevel: 'GL',
          parentId: parentCashBank?.id || null,
          accountTypeId: assetType?.id || null,
          detailType: 'PettyCash',
          isLocked: false,
          isReserved: true,
          isSystemDefined: true,
          description: 'Petty Cash Fund Account for small operational expenses',
          subsidiary: ['Global'],
          initialBalance: 0,
          currentBalance: 0
        },
        include: { accountType: true }
      });
    }

    // Ensure config row exists
    let config = await prisma.pettyCashConfig.findUnique({
      where: { accountId: account.id }
    });

    if (!config) {
      config = await prisma.pettyCashConfig.create({
        data: {
          accountId: account.id,
          fundLimit: new Prisma.Decimal(50000),
          custodianName: 'Authorized Custodian',
          status: 'ACTIVE',
          remarks: 'Default Petty Cash Fund Configuration'
        }
      });
    }

    return { account, config };
  }

  /**
   * Get Petty Cash Fund Configuration & Live Stats
   */
  static async getConfig() {
    const { account: initialAccount, config } = await this.getOrCreatePettyCashAccount();

    const account = await prisma.account.findUnique({
      where: { id: initialAccount.id },
      include: { accountType: true }
    }) || initialAccount;

    const currentBalance = new Prisma.Decimal(account.currentBalance || 0);
    const fundLimit = new Prisma.Decimal(config.fundLimit || 50000);
    const availableCapacity = fundLimit.minus(currentBalance);

    // Calculate aggregate totals from actual DB transactions
    const [addedAgg, expenseAgg, replenishAgg, latestReconcile] = await Promise.all([
      prisma.pettyCashTransaction.aggregate({
        where: { pettyCashAccountId: account.id, transactionType: 'TRANSFER_IN', isDeleted: false },
        _sum: { amount: true }
      }),
      prisma.pettyCashTransaction.aggregate({
        where: { pettyCashAccountId: account.id, transactionType: 'EXPENSE', isDeleted: false },
        _sum: { amount: true }
      }),
      prisma.pettyCashTransaction.aggregate({
        where: { pettyCashAccountId: account.id, transactionType: 'REPLENISHMENT', isDeleted: false },
        _sum: { amount: true }
      }),
      prisma.pettyCashReconciliation.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { reconciledBy: { select: { fullName: true, email: true } } }
      })
    ]);

    const totalAdded = Number(addedAgg._sum.amount || 0);
    const totalExpenses = Number(expenseAgg._sum.amount || 0);
    const totalReplenished = Number(replenishAgg._sum.amount || 0);

    const physicalCount = latestReconcile ? Number(latestReconcile.physicalCount) : currentBalance.toNumber();
    const difference = latestReconcile ? Number(latestReconcile.difference) : 0;

    return {
      accountId: account.id,
      glCode: account.glCode,
      accountName: account.accountName,
      fundLimit: fundLimit.toNumber(),
      currentBalance: currentBalance.toNumber(),
      availableCapacity: Math.max(0, availableCapacity.toNumber()),
      custodianName: config.custodianName,
      status: config.status,
      remarks: config.remarks,
      totalAdded,
      totalExpenses,
      totalReplenished,
      physicalCount,
      difference,
      lastAuditDate: latestReconcile ? latestReconcile.createdAt.toISOString().split('T')[0] : null,
      lastAuditedBy: latestReconcile?.reconciledBy?.fullName || latestReconcile?.reconciledBy?.email || 'N/A',
      latestReconciliationStatus: latestReconcile ? (difference === 0 ? 'BALANCED' : difference < 0 ? 'SHORTAGE' : 'SURPLUS') : 'BALANCED'
    };
  }

  /**
   * Update Petty Cash Config (Admin only)
   */
  static async updateConfig(data: { fundLimit?: number | string; custodianName?: string; status?: string; remarks?: string }) {
    const { account } = await this.getOrCreatePettyCashAccount();

    const updateData: any = {};
    if (data.fundLimit !== undefined) {
      const amtRes = validateAmount(data.fundLimit);
      if (!amtRes.valid) throw new Error(`Fund limit validation failed: ${amtRes.message}`);
      const currentBalance = new Prisma.Decimal(account.currentBalance || 0);
      if (new Prisma.Decimal(amtRes.amount).lt(currentBalance)) {
        throw new Error(`Fund limit cannot be set lower than current Petty Cash balance of PKR ${currentBalance.toNumber().toLocaleString()}.`);
      }
      updateData.fundLimit = new Prisma.Decimal(amtRes.amount);
    }

    if (data.custodianName !== undefined) {
      const nameStr = String(data.custodianName || '').trim();
      if (!nameStr) throw new Error('Custodian name cannot be empty.');
      if (!isWithinMaxLength(nameStr, 255)) throw new Error('Custodian name cannot exceed 255 characters.');
      updateData.custodianName = nameStr;
    }

    if (data.status !== undefined) updateData.status = data.status;

    if (data.remarks !== undefined) {
      if (!isWithinMaxLength(data.remarks, 500)) throw new Error('Remarks cannot exceed 500 characters.');
      updateData.remarks = data.remarks;
    }

    const updated = await prisma.pettyCashConfig.update({
      where: { accountId: account.id },
      data: updateData
    });

    return this.getConfig();
  }

  /**
   * Get Petty Cash Register with Running Balances
   */
  static async getRegister(params: { startDate?: string; endDate?: string; type?: string; page?: number; limit?: number }) {
    const { account } = await this.getOrCreatePettyCashAccount();

    const dateFilter: any = {};
    if (params.startDate) dateFilter.gte = new Date(`${params.startDate}T00:00:00Z`);
    if (params.endDate) dateFilter.lte = new Date(`${params.endDate}T23:59:59Z`);

    const where: any = {
      pettyCashAccountId: account.id,
      isDeleted: false,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      ...(params.type ? { transactionType: params.type } : {})
    };

    const transactions = await prisma.pettyCashTransaction.findMany({
      where,
      include: {
        sourceAccount: true,
        expenseAccount: true,
        expenseHead: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
        journalEntry: true
      },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Calculate decimal-safe running balance
    let runningBalance = new Prisma.Decimal(0);
    const registerRows = transactions.map(tx => {
      const amt = new Prisma.Decimal(tx.amount);
      let debit = new Prisma.Decimal(0);
      let credit = new Prisma.Decimal(0);

      if (['OPENING_BALANCE', 'TRANSFER_IN', 'REPLENISHMENT'].includes(tx.transactionType)) {
        debit = amt;
        runningBalance = runningBalance.plus(amt);
      } else if (['EXPENSE', 'TRANSFER_OUT'].includes(tx.transactionType)) {
        credit = amt;
        runningBalance = runningBalance.minus(amt);
      } else if (tx.transactionType === 'ADMIN_ADJUSTMENT') {
        if (amt.gte(0)) {
          debit = amt;
          runningBalance = runningBalance.plus(amt);
        } else {
          credit = amt.abs();
          runningBalance = runningBalance.minus(amt.abs());
        }
      }

      return {
        id: tx.id,
        voucherNo: tx.voucherNo,
        date: tx.date.toISOString().split('T')[0],
        transactionType: tx.transactionType,
        narration: tx.narration || tx.referenceNo || 'Petty Cash Transaction',
        paidTo: tx.paidTo || '-',
        expenseCategory: tx.expenseHead?.name || tx.expenseAccount?.accountName || '-',
        sourceAccountName: tx.sourceAccount?.accountName || '-',
        debit: debit.toNumber(),
        credit: credit.toNumber(),
        runningBalance: runningBalance.toNumber(),
        status: tx.journalEntry?.status || 'Posted',
        createdBy: tx.createdBy?.fullName || 'System',
        journalEntryId: tx.journalEntryId,
        attachmentUrl: tx.attachmentUrl
      };
    });

    // Reverse for UI display (newest first) while keeping accurate running balances
    registerRows.reverse();

    return {
      register: registerRows,
      totalCount: registerRows.length,
      currentBalance: runningBalance.toNumber()
    };
  }

  /**
   * Add Cash to Petty Cash / Transfer In (Bank or Cash in Hand -> Petty Cash)
   */
  static async addCash(data: {
    sourceAccountId: string;
    amount: number | string;
    date?: string;
    referenceNo?: string;
    narration?: string;
    createdById: string;
    isReplenishment?: boolean;
  }) {
    // 1. AMOUNT VALIDATION
    const amtRes = validateAmount(data.amount);
    if (!amtRes.valid) throw new Error(amtRes.message);
    const validAmount = amtRes.amount;
    const amountDec = new Prisma.Decimal(validAmount);

    // 2. SOURCE ACCOUNT ID PRESENCE
    if (!data.sourceAccountId || typeof data.sourceAccountId !== 'string') {
      throw new Error('Source account is required.');
    }

    // 3. DATE VALIDATION
    const date = data.date ? new Date(data.date) : new Date();
    if (!isValidTransactionDate(date)) {
      throw new Error('Invalid transaction date. Date must be between 1980 and 1 year in the future.');
    }

    // 4. TEXT LENGTH VALIDATION
    if (data.referenceNo && !isWithinMaxLength(data.referenceNo, 255)) {
      throw new Error('Reference number cannot exceed 255 characters.');
    }
    if (data.narration && !isWithinMaxLength(data.narration, 1000)) {
      throw new Error('Narration cannot exceed 1000 characters.');
    }

    // GET PETTY CASH ACCOUNT & CONFIG
    const { account: initialAccount, config } = await this.getOrCreatePettyCashAccount();
    const account = await prisma.account.findUnique({ where: { id: initialAccount.id } }) || initialAccount;

    // 5. SELF-TRANSFER RESTRICTION
    if (data.sourceAccountId === account.id) {
      throw new Error('Self-transfer not allowed: cannot transfer funds from Petty Cash to Petty Cash itself.');
    }

    // 5. FUND LIMIT CHECK
    const currentBalance = new Prisma.Decimal(account.currentBalance || 0);
    const fundLimit = new Prisma.Decimal(config.fundLimit || 50000);
    const maxCapacity = fundLimit.minus(currentBalance);

    if (currentBalance.plus(amountDec).gt(fundLimit)) {
      throw new Error(`Petty Cash fund limit exceeded. Maximum available fund capacity is PKR ${Math.max(0, maxCapacity.toNumber()).toLocaleString()}.`);
    }

    const voucherNo = `PCV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;

    return await prisma.$transaction(async (tx) => {
      // Validate source account exists and is a Cash or Bank Asset account
      const targetSourceAcc = await tx.account.findUnique({
        where: { id: data.sourceAccountId },
        include: { accountType: true }
      });
      if (!targetSourceAcc || targetSourceAcc.isDeleted) {
        throw new Error('Source account not found or deactivated.');
      }

      const { isCash, isBank } = FundValidationService.isCashOrBankAccount(targetSourceAcc.accountName, targetSourceAcc.detailType);
      const isAsset = (targetSourceAcc.accountType?.name || '').toUpperCase() === 'ASSET' || isCash || isBank;
      if (!isAsset) {
        throw new Error('Source account must be a valid Cash or Bank Asset account.');
      }

      // Validate available balance on source account with row lock
      const { account: sourceAccount } = await FundValidationService.validateAndLockFunds(tx, {
        accountId: data.sourceAccountId,
        requiredAmount: validAmount,
        module: 'Petty Cash'
      });

      // Create Journal Entry
      const je = await tx.journalEntry.create({
        data: {
          voucherNo,
          postingDate: date,
          subsidiary: 'Global',
          reference: data.referenceNo || voucherNo,
          description: data.narration || (data.isReplenishment ? 'Replenish Petty Cash Fund' : 'Add Cash to Petty Cash'),
          postedBy: data.createdById,
          status: 'Posted',
          voucherType: 'PCV',
          lines: {
            create: [
              {
                accountId: account.id, // DEBIT: Petty Cash (ASSET increase)
                debit: amountDec,
                credit: 0,
                description: `Petty Cash Deposit from ${sourceAccount.accountName}`
              },
              {
                accountId: sourceAccount.id, // CREDIT: Source Account (ASSET decrease)
                debit: 0,
                credit: amountDec,
                description: `Transfer to Petty Cash Fund`
              }
            ]
          }
        }
      });

      // Update Account Balances atomically
      await tx.account.update({
        where: { id: account.id },
        data: { currentBalance: { increment: amountDec } }
      });

      await tx.account.update({
        where: { id: sourceAccount.id },
        data: { currentBalance: { decrement: amountDec } }
      });

      // Create Petty Cash Transaction Record
      const pcTx = await tx.pettyCashTransaction.create({
        data: {
          voucherNo,
          transactionType: data.isReplenishment ? 'REPLENISHMENT' : 'TRANSFER_IN',
          pettyCashAccountId: account.id,
          sourceAccountId: sourceAccount.id,
          amount: amountDec,
          date,
          referenceNo: data.referenceNo,
          narration: data.narration,
          journalEntryId: je.id,
          createdById: data.createdById,
          postedAt: new Date(),
          postedById: data.createdById
        }
      });

      await BalanceRebuildService.forJournalEntry(tx, je.id);

      return pcTx;
    });
  }

  /**
   * Record Petty Cash Expense (Petty Cash -> Expense Account)
   */
  static async recordExpense(data: {
    expenseHeadId?: string;
    expenseAccountId?: string;
    amount: number | string;
    paidTo: string;
    date?: string;
    referenceNo?: string;
    narration?: string;
    attachmentUrl?: string;
    createdById: string;
  }) {
    // 1. AMOUNT VALIDATION
    const amtRes = validateAmount(data.amount);
    if (!amtRes.valid) throw new Error(amtRes.message);
    const validAmount = amtRes.amount;
    const amountDec = new Prisma.Decimal(validAmount);

    // 2. PAID TO VALIDATION
    const paidToTrimmed = String(data.paidTo || '').trim();
    if (!paidToTrimmed) throw new Error('Recipient (Paid To) is required for Petty Cash expenses.');
    if (!isWithinMaxLength(paidToTrimmed, 255)) throw new Error('Paid To recipient cannot exceed 255 characters.');

    // 3. DATE VALIDATION
    const date = data.date ? new Date(data.date) : new Date();
    if (!isValidTransactionDate(date)) {
      throw new Error('Invalid transaction date. Date must be between 1980 and 1 year in the future.');
    }

    // 4. TEXT LENGTH VALIDATION
    if (data.referenceNo && !isWithinMaxLength(data.referenceNo, 255)) {
      throw new Error('Reference number cannot exceed 255 characters.');
    }
    if (data.narration && !isWithinMaxLength(data.narration, 1000)) {
      throw new Error('Narration cannot exceed 1000 characters.');
    }

    const { account } = await this.getOrCreatePettyCashAccount();

    // 5. INSUFFICIENT PETTY CASH BALANCE CHECK
    const currentBalance = new Prisma.Decimal(account.currentBalance || 0);
    if (amountDec.gt(currentBalance)) {
      const shortfall = amountDec.minus(currentBalance);
      throw new Error(`Insufficient Petty Cash Balance.\nAvailable: PKR ${currentBalance.toNumber().toLocaleString()}\nRequested: PKR ${validAmount.toLocaleString()}\nShortfall: PKR ${shortfall.toNumber().toLocaleString()}`);
    }

    // 6. EXPENSE ACCOUNT VALIDATION
    let expenseAccountId = data.expenseAccountId;
    let expenseHead = null;

    if (data.expenseHeadId) {
      expenseHead = await prisma.expenseHead.findUnique({
        where: { id: data.expenseHeadId },
        include: { account: true }
      });
      if (expenseHead?.accountId) expenseAccountId = expenseHead.accountId;
    }

    if (!expenseAccountId) {
      const defaultExp = await prisma.account.findFirst({
        where: {
          isDeleted: false,
          accountType: { name: { equals: 'EXPENSE', mode: 'insensitive' } }
        }
      });
      if (defaultExp) expenseAccountId = defaultExp.id;
    }

    if (!expenseAccountId) throw new Error('Expense account not found.');

    const expenseAccount = await prisma.account.findUnique({
      where: { id: expenseAccountId },
      include: { accountType: true }
    });
    if (!expenseAccount || expenseAccount.isDeleted) throw new Error('Expense account not found or deactivated.');

    const expTypeName = (expenseAccount.accountType?.name || '').toUpperCase();
    if (expTypeName !== 'EXPENSE' && expTypeName !== 'EXPENSES') {
      throw new Error(`Account '${expenseAccount.accountName}' is a ${expenseAccount.accountType?.name || 'non-expense'} account. Petty Cash expenses must be recorded against Expense type accounts.`);
    }

    const voucherNo = `PCV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;

    return await prisma.$transaction(async (tx) => {
      // Re-verify Petty Cash Balance inside atomic transaction with database read
      const liveAccount = await tx.account.findUnique({ where: { id: account.id } });
      const liveBalance = new Prisma.Decimal(liveAccount?.currentBalance || 0);
      if (amountDec.gt(liveBalance)) {
        const shortfall = amountDec.minus(liveBalance);
        throw new Error(`Insufficient Petty Cash Balance.\nAvailable: PKR ${liveBalance.toNumber().toLocaleString()}\nRequested: PKR ${validAmount.toLocaleString()}\nShortfall: PKR ${shortfall.toNumber().toLocaleString()}`);
      }

      // Create Journal Entry
      const je = await tx.journalEntry.create({
        data: {
          voucherNo,
          postingDate: date,
          subsidiary: 'Global',
          reference: data.referenceNo || voucherNo,
          description: data.narration || `Petty Cash Expense to ${data.paidTo}`,
          postedBy: data.createdById,
          status: 'Posted',
          voucherType: 'PCV',
          lines: {
            create: [
              {
                accountId: expenseAccount.id, // DEBIT: Expense Account (P&L Expense increase)
                debit: amountDec,
                credit: 0,
                description: `Paid to ${data.paidTo}: ${data.narration || expenseAccount.accountName}`
              },
              {
                accountId: account.id, // CREDIT: Petty Cash (ASSET decrease)
                debit: 0,
                credit: amountDec,
                description: `Petty Cash Payment to ${data.paidTo}`
              }
            ]
          }
        }
      });

      // Update Account Balances atomically
      await tx.account.update({
        where: { id: expenseAccount.id },
        data: { currentBalance: { increment: amountDec } }
      });

      await tx.account.update({
        where: { id: account.id },
        data: { currentBalance: { decrement: amountDec } }
      });

      // Create Petty Cash Transaction Record
      const pcTx = await tx.pettyCashTransaction.create({
        data: {
          voucherNo,
          transactionType: 'EXPENSE',
          pettyCashAccountId: account.id,
          expenseAccountId: expenseAccount.id,
          expenseHeadId: data.expenseHeadId || null,
          amount: amountDec,
          date,
          paidTo: data.paidTo,
          referenceNo: data.referenceNo,
          narration: data.narration,
          attachmentUrl: data.attachmentUrl,
          journalEntryId: je.id,
          createdById: data.createdById,
          postedAt: new Date(),
          postedById: data.createdById
        }
      });

      await BalanceRebuildService.forJournalEntry(tx, je.id);

      return pcTx;
    });
  }

  /**
   * Reconcile Petty Cash (Physical Count vs System Balance)
   */
  static async reconcile(data: { physicalCount: number | string; explanation?: string; reconciledById: string }) {
    const { account } = await this.getOrCreatePettyCashAccount();

    if (data.physicalCount === undefined || data.physicalCount === null || isNaN(Number(data.physicalCount))) {
      throw new Error('Physical count must be a valid number.');
    }
    const physicalCountNum = Number(data.physicalCount);
    if (physicalCountNum < 0) {
      throw new Error('Physical cash count cannot be negative.');
    }

    const systemBalance = new Prisma.Decimal(account.currentBalance || 0);
    const physicalCount = new Prisma.Decimal(physicalCountNum);
    const difference = physicalCount.minus(systemBalance);

    const explanationTrimmed = String(data.explanation || '').trim();

    // Require explanation for non-zero variance
    if (!difference.isZero() && (!explanationTrimmed || explanationTrimmed.length < 5)) {
      throw new Error(`Variance explanation (minimum 5 characters) is required when physical count (PKR ${physicalCountNum.toLocaleString()}) differs from system balance (PKR ${systemBalance.toNumber().toLocaleString()}).`);
    }

    if (explanationTrimmed && !isWithinMaxLength(explanationTrimmed, 1000)) {
      throw new Error('Explanation cannot exceed 1000 characters.');
    }

    let reconciledById = data.reconciledById;
    if (!reconciledById || reconciledById === '00000000-0000-0000-0000-000000000000') {
      const user = await prisma.user.findFirst({ where: { isDeleted: false } });
      if (user) reconciledById = user.id;
    }

    const rec = await prisma.pettyCashReconciliation.create({
      data: {
        pettyCashAccountId: account.id,
        reconciliationDate: new Date(),
        systemBalance,
        physicalCount,
        difference,
        explanation: data.explanation || null,
        status: difference.isZero() ? 'APPROVED' : 'PENDING_APPROVAL',
        reconciledById
      }
    });

    return rec;
  }

  /**
   * Approve Reconciliation & Post Admin Adjustment (Admin only)
   */
  static async approveReconciliation(reconciliationId: string, approvedById: string) {
    const rec = await prisma.pettyCashReconciliation.findUnique({
      where: { id: reconciliationId },
      include: { pettyCashAccount: true }
    });

    if (!rec) throw new Error('Reconciliation record not found.');
    if (rec.status === 'APPROVED') throw new Error('Reconciliation is already approved.');

    const diffDec = new Prisma.Decimal(rec.difference);

    if (diffDec.isZero()) {
      return await prisma.pettyCashReconciliation.update({
        where: { id: reconciliationId },
        data: { status: 'APPROVED', approvedById, approvedAt: new Date() }
      });
    }

    // Find or create appropriate adjustment account
    const isShortage = diffDec.lt(0);
    let adjAccount = null;

    if (isShortage) {
      // Shortage Expense Account
      adjAccount = await prisma.account.findFirst({
        where: {
          isDeleted: false,
          accountName: { contains: 'Shortage', mode: 'insensitive' }
        }
      }) || await prisma.account.findFirst({
        where: {
          isDeleted: false,
          accountName: { contains: 'Adjustment', mode: 'insensitive' },
          accountType: { name: { equals: 'EXPENSE', mode: 'insensitive' } }
        }
      }) || await prisma.account.findFirst({
        where: {
          isDeleted: false,
          accountType: { name: { equals: 'EXPENSE', mode: 'insensitive' } }
        }
      });
    } else {
      // Overage / Surplus Revenue/Income Account
      adjAccount = await prisma.account.findFirst({
        where: {
          isDeleted: false,
          accountName: { contains: 'Overage', mode: 'insensitive' }
        }
      }) || await prisma.account.findFirst({
        where: {
          isDeleted: false,
          accountName: { contains: 'Surplus', mode: 'insensitive' }
        }
      }) || await prisma.account.findFirst({
        where: {
          isDeleted: false,
          accountName: { contains: 'Adjustment', mode: 'insensitive' },
          accountType: { name: { in: ['REVENUE', 'INCOME'], mode: 'insensitive' } }
        }
      }) || await prisma.account.findFirst({
        where: {
          isDeleted: false,
          accountType: { name: { in: ['REVENUE', 'INCOME'], mode: 'insensitive' } }
        }
      });
    }

    if (!adjAccount) throw new Error('Adjustment account not found.');

    const date = new Date();
    const voucherNo = `PCV-ADJ-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;

    return await prisma.$transaction(async (tx) => {
      let jeLines = [];

      if (diffDec.lt(0)) {
        // Physical count is less than system balance -> Cash Shortage (Expense)
        const absDiff = diffDec.abs();
        jeLines = [
          { accountId: adjAccount.id, debit: absDiff, credit: 0, description: 'Petty Cash Shortage Adjustment' },
          { accountId: rec.pettyCashAccountId, debit: 0, credit: absDiff, description: 'Petty Cash Shortage Adjustment' }
        ];
        await tx.account.update({ where: { id: rec.pettyCashAccountId }, data: { currentBalance: { decrement: absDiff } } });
        await tx.account.update({ where: { id: adjAccount.id }, data: { currentBalance: { increment: absDiff } } });
      } else {
        // Physical count is greater than system balance -> Cash Surplus (Income)
        jeLines = [
          { accountId: rec.pettyCashAccountId, debit: diffDec, credit: 0, description: 'Petty Cash Excess Adjustment' },
          { accountId: adjAccount.id, debit: 0, credit: diffDec, description: 'Petty Cash Excess Adjustment' }
        ];
        await tx.account.update({ where: { id: rec.pettyCashAccountId }, data: { currentBalance: { increment: diffDec } } });
        await tx.account.update({ where: { id: adjAccount.id }, data: { currentBalance: { increment: diffDec } } });
      }

      const je = await tx.journalEntry.create({
        data: {
          voucherNo,
          postingDate: date,
          subsidiary: 'Global',
          reference: voucherNo,
          description: `Petty Cash Audit Adjustment (${rec.explanation || 'Physical Count Reconciliation'})`,
          postedBy: approvedById,
          status: 'Posted',
          voucherType: 'PCV',
          lines: { create: jeLines }
        }
      });

      await tx.pettyCashTransaction.create({
        data: {
          voucherNo,
          transactionType: 'ADMIN_ADJUSTMENT',
          pettyCashAccountId: rec.pettyCashAccountId,
          amount: diffDec,
          date,
          narration: `Admin Adjustment: ${rec.explanation || 'Reconciliation variance'}`,
          journalEntryId: je.id,
          createdById: approvedById,
          postedAt: new Date(),
          postedById: approvedById
        }
      });

      await BalanceRebuildService.forJournalEntry(tx, je.id);

      return await tx.pettyCashReconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: 'APPROVED',
          approvedById,
          approvedAt: new Date(),
          journalEntryId: je.id
        }
      });
    });
  }

  /**
   * Revert / Delete Petty Cash Transaction (Admin only)
   */
  static async revertTransaction(transactionId: string, revertedById: string, revertReason: string) {
    if (!revertReason || !String(revertReason).trim()) {
      throw new Error('Reason for transaction reversal is required.');
    }
    if (!isWithinMaxLength(revertReason, 500)) {
      throw new Error('Reversal reason cannot exceed 500 characters.');
    }

    const pcTx = await prisma.pettyCashTransaction.findUnique({
      where: { id: transactionId },
      include: { journalEntry: { include: { lines: true } } }
    });

    if (!pcTx) throw new Error('Transaction not found.');
    if (pcTx.isDeleted) throw new Error('Transaction is already reverted/deleted.');

    return await prisma.$transaction(async (tx) => {
      if (pcTx.journalEntry) {
        // Reverse journal entry lines on Account balances
        for (const line of pcTx.journalEntry.lines) {
          const debit = new Prisma.Decimal(line.debit);
          const credit = new Prisma.Decimal(line.credit);
          const netEffect = debit.minus(credit);

          await tx.account.update({
            where: { id: line.accountId },
            data: { currentBalance: { decrement: netEffect } }
          });
        }

        // Mark Journal Entry as Reverted
        await tx.journalEntry.update({
          where: { id: pcTx.journalEntryId! },
          data: {
            status: 'Reverted',
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: revertedById
          }
        });
      }

      // Mark Petty Cash Transaction as deleted / reverted
      const updatedPcTx = await tx.pettyCashTransaction.update({
        where: { id: transactionId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: revertedById,
          revertedAt: new Date(),
          revertedById,
          revertReason
        }
      });

      if (pcTx.journalEntryId) {
        await BalanceRebuildService.forJournalEntry(tx, pcTx.journalEntryId);
      }

      return updatedPcTx;
    });
  }

  /**
   * Get Voucher Details for Voucher Print Layout
   */
  static async getVoucher(voucherNoOrId: string) {
    const pcTx = await prisma.pettyCashTransaction.findFirst({
      where: {
        OR: [{ id: voucherNoOrId }, { voucherNo: voucherNoOrId }]
      },
      include: {
        pettyCashAccount: true,
        sourceAccount: true,
        expenseAccount: true,
        expenseHead: true,
        createdBy: { select: { id: true, fullName: true, email: true } },
        journalEntry: { include: { lines: { include: { account: true } } } }
      }
    });

    if (!pcTx) throw new Error('Petty Cash Voucher not found.');

    return pcTx;
  }

  /**
   * Get Physical Count Reconciliations History & Pending Approvals
   */
  static async getReconciliations() {
    const { account } = await this.getOrCreatePettyCashAccount();

    const reconciliations = await prisma.pettyCashReconciliation.findMany({
      where: { pettyCashAccountId: account.id },
      include: {
        reconciledBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reconciliations.map(rec => ({
      id: rec.id,
      reconciliationDate: rec.reconciliationDate.toISOString().split('T')[0],
      systemBalance: Number(rec.systemBalance),
      physicalCount: Number(rec.physicalCount),
      difference: Number(rec.difference),
      explanation: rec.explanation || '-',
      status: rec.status,
      reconciledBy: rec.reconciledBy?.fullName || rec.reconciledBy?.email || 'System',
      approvedBy: rec.approvedBy?.fullName || rec.approvedBy?.email || null,
      approvedAt: rec.approvedAt ? rec.approvedAt.toISOString() : null,
      createdAt: rec.createdAt.toISOString()
    }));
  }
}

