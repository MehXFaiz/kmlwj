import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';

export interface AccountingLinePayload {
  accountCode?: string;      // GL Code (e.g., '1010101' or '3010101')
  accountId?: string;        // Account UUID
  accountKeyword?: string;   // Keyword or type fallback (e.g., 'Cash In Hand', 'Donation Income', 'Salaries Expense')
  accountType?: string;      // Optional AccountType filter e.g., 'ASSET', 'REVENUE', 'EXPENSE'
  debit: number;
  credit: number;
  description?: string;
}

export interface PostTransactionPayload {
  voucherNo?: string;
  postingDate?: Date | string;
  subsidiary?: string;        // Default 'Global'
  reference: string;          // Voucher reference or module document number
  description?: string;
  module: string;             // e.g., 'Hall Booking', 'Donation', 'Salary', 'Bank Vouchers'
  voucherType?: string;       // Default 'JV', 'BR', 'BP', 'BT'
  postedBy: string;           // User ID or email
  lines: AccountingLinePayload[];
  ipAddress?: string;
  userAgent?: string;
  status?: string;            // Default 'Posted'
}

export interface PostReceiptParams {
  amount: number;
  cashOrBankAccountId?: string;
  cashOrBankAccountCode?: string;
  cashOrBankAccountKeyword?: string;
  incomeAccountId?: string;
  incomeAccountCode?: string;
  incomeAccountKeyword?: string;
  subsidiary?: string;
  reference: string;
  description?: string;
  module: string;
  postedBy: string;
  postingDate?: Date | string;
  ipAddress?: string;
  userAgent?: string;
  voucherType?: string;
}

export interface PostPaymentParams {
  amount: number;
  cashOrBankAccountId?: string;
  cashOrBankAccountCode?: string;
  cashOrBankAccountKeyword?: string;
  expenseAccountId?: string;
  expenseAccountCode?: string;
  expenseAccountKeyword?: string;
  subsidiary?: string;
  reference: string;
  description?: string;
  module: string;
  postedBy: string;
  postingDate?: Date | string;
  ipAddress?: string;
  userAgent?: string;
  voucherType?: string;
}

export interface PostTransferParams {
  amount: number;
  fromAccountId?: string;
  fromAccountCode?: string;
  toAccountId?: string;
  toAccountCode?: string;
  subsidiary?: string;
  reference: string;
  description?: string;
  module: string;
  postedBy: string;
  postingDate?: Date | string;
  ipAddress?: string;
  userAgent?: string;
  voucherType?: string;
}

export class AccountingService {
  /**
   * Ensures a dedicated leaf Cash in Hand account exists and returns it.
   */
  static async ensureCashInHandAccount(tx: any) {
    let cashAccount = await tx.account.findFirst({
      where: {
        AND: [
          {
            OR: [
              { accountName: { equals: 'Cash in Hand', mode: 'insensitive' } },
              { accountName: { contains: 'Cash in Hand', mode: 'insensitive' } },
              { accountName: { equals: 'Cash Account', mode: 'insensitive' } }
            ]
          },
          { NOT: { accountName: { contains: 'Bank', mode: 'insensitive' } } },
          { NOT: { accountName: { contains: '&', mode: 'insensitive' } } },
          { isLocked: false },
          { children: { none: {} } }
        ]
      },
      orderBy: { glCode: 'asc' }
    });

    if (cashAccount) return cashAccount;

    const parentAccount = await tx.account.findFirst({
      where: {
        OR: [
          { glCode: '1010100' },
          { accountName: { contains: 'Cash & Bank Balances', mode: 'insensitive' } }
        ]
      }
    });

    const assetType = await tx.accountType.findFirst({
      where: { name: { in: ['Asset', 'Assets', 'ASSET', 'ASSETS'] } }
    });

    let glCode = '1010103';
    let codeCounter = 3;
    while (await tx.account.findUnique({ where: { glCode } })) {
      codeCounter++;
      glCode = `101010${codeCounter}`;
    }

    cashAccount = await tx.account.create({
      data: {
        glCode,
        accountName: 'Cash in Hand',
        accountLevel: 'GL',
        parentId: parentAccount ? parentAccount.id : null,
        accountTypeId: assetType ? assetType.id : null,
        detailType: 'Cash',
        currency: 'PKR',
        subsidiary: ['Global'],
        initialBalance: 0,
        currentBalance: 0,
        isSystemDefined: true,
        description: 'Main operational cash in hand account'
      }
    });

    return cashAccount;
  }

  /**
   * Resolves an Account from the Chart of Accounts using ID, GL Code, keyword, or type fallback.
   * Enforces that the account exists and is not locked.
   */
  static async resolveAccount(tx: any, line: AccountingLinePayload) {
    let account = null;

    if (line.accountId) {
      account = await tx.account.findUnique({
        where: { id: line.accountId },
        include: { accountType: true }
      });
    } else if (line.accountCode) {
      account = await tx.account.findUnique({
        where: { glCode: line.accountCode },
        include: { accountType: true }
      });
    }

    // Validate account type if directly looked up and accountType is specified
    if (account && line.accountType) {
      const typeName = (account.accountType?.name || '').toUpperCase();
      if (typeName !== line.accountType.toUpperCase()) {
        throw new Error(`Accounting Engine Error: Account '${account.glCode} - ${account.accountName}' is of type '${typeName}', but type '${line.accountType}' was expected.`);
      }
    }

    // Ensure directly looked-up account resolves to a leaf account if it is a header
    if (account) {
      const hasChild = await tx.account.findFirst({ where: { parentId: account.id } });
      if (hasChild) {
        const leaf = await tx.account.findFirst({
          where: {
            OR: [
              { parentId: account.id },
              { accountName: { contains: account.accountName, mode: 'insensitive' } }
            ],
            children: { none: {} },
            isLocked: false
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });
        if (leaf) {
          // Re-validate leaf account type
          if (line.accountType) {
            const leafTypeName = (leaf.accountType?.name || '').toUpperCase();
            if (leafTypeName !== line.accountType.toUpperCase()) {
              throw new Error(`Accounting Engine Error: Resolved leaf account '${leaf.glCode} - ${leaf.accountName}' is of type '${leafTypeName}', but type '${line.accountType}' was expected.`);
            }
          }
          account = leaf;
        }
      }
    }

    // Keyword or Name Search fallback
    if (!account && line.accountKeyword) {
      const keyword = line.accountKeyword.trim();
      const cleanKeyword = keyword.replace(/_/g, ' ').replace(/-/g, ' ');

      if (cleanKeyword.toLowerCase() === 'cash') {
        account = await AccountingService.ensureCashInHandAccount(tx);
      }

      // Try exact or case-insensitive contains match on accountName or glCode
      if (!account) {
        account = await tx.account.findFirst({
          where: {
            OR: [
              { accountName: { equals: cleanKeyword, mode: 'insensitive' } },
              { accountName: { contains: cleanKeyword, mode: 'insensitive' } },
              { accountName: { equals: keyword, mode: 'insensitive' } },
              { accountName: { contains: keyword, mode: 'insensitive' } },
              { glCode: { equals: keyword } },
              { detailType: { equals: cleanKeyword, mode: 'insensitive' } },
              { detailType: { equals: keyword, mode: 'insensitive' } }
            ],
            accountType: line.accountType ? { name: { equals: line.accountType, mode: 'insensitive' } } : undefined,
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['GL', 'SUBSIDIARY'] }
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });
      }

      // If still not found and a general keyword like 'Cash' or 'Bank' or 'Donation' was used
      if (!account) {
        account = await tx.account.findFirst({
          where: {
            OR: [
              { accountName: { contains: cleanKeyword.split(' ')[0], mode: 'insensitive' } },
              { accountName: { contains: keyword.split(' ')[0], mode: 'insensitive' } },
              { description: { contains: cleanKeyword, mode: 'insensitive' } }
            ],
            accountType: line.accountType ? { name: { equals: line.accountType, mode: 'insensitive' } } : undefined,
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['GL', 'SUBSIDIARY'] }
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });
      }

      // Special fallback for REVENUE when looking for generic Donation/Income
      if (!account && line.accountType === 'REVENUE') {
        // Try to find a General Donation account first
        account = await tx.account.findFirst({
          where: {
            accountName: { contains: 'General Donation', mode: 'insensitive' },
            accountType: { name: { equals: 'REVENUE', mode: 'insensitive' } },
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['GL', 'SUBSIDIARY'] }
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });

        if (!account) {
          account = await tx.account.findFirst({
            where: {
              OR: [
                { accountName: { contains: 'Donation', mode: 'insensitive' } },
                { accountName: { contains: 'Income', mode: 'insensitive' } }
              ],
              accountType: { name: { equals: 'REVENUE', mode: 'insensitive' } },
              isLocked: false,
              children: { none: {} },
              accountLevel: { in: ['GL', 'SUBSIDIARY'] }
            },
            include: { accountType: true },
            orderBy: { glCode: 'asc' }
          });
        }
      }

      // Special fallback for EXPENSE when looking for generic Expense/Welfare/Aid
      if (!account && line.accountType === 'EXPENSE') {
        account = await tx.account.findFirst({
          where: {
            OR: [
              { accountName: { contains: 'Expense', mode: 'insensitive' } },
              { accountName: { contains: 'Welfare', mode: 'insensitive' } },
              { accountName: { contains: 'Aid', mode: 'insensitive' } }
            ],
            accountType: { name: { equals: 'EXPENSE', mode: 'insensitive' } },
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['GL', 'SUBSIDIARY'] }
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });
      }

      // Final fallback: any unlocked account matching keyword without level restriction
      if (!account) {
        account = await tx.account.findFirst({
          where: {
            OR: [
              { accountName: { equals: cleanKeyword, mode: 'insensitive' } },
              { accountName: { contains: cleanKeyword, mode: 'insensitive' } },
              { accountName: { equals: keyword, mode: 'insensitive' } },
              { accountName: { contains: keyword, mode: 'insensitive' } }
            ],
            accountType: line.accountType ? { name: { equals: line.accountType, mode: 'insensitive' } } : undefined,
            isLocked: false,
            children: { none: {} }
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });
      }
    }

    // Type fallback if provided
    if (!account && line.accountType) {
      account = await tx.account.findFirst({
        where: {
          accountType: { name: { equals: line.accountType, mode: 'insensitive' } },
          isLocked: false,
          children: { none: {} },
          accountLevel: { in: ['GL', 'SUBSIDIARY'] }
        },
        include: { accountType: true },
        orderBy: { glCode: 'asc' }
      });
    }

    if (!account) {
      const identifier = line.accountId || line.accountCode || line.accountKeyword || line.accountType || 'Unknown';
      throw new Error(`Accounting Engine Error: Account not found in Chart of Accounts for identifier '${identifier}'. Please ensure an active GL account exists.`);
    }

    if (account.isLocked) {
      throw new Error(`Accounting Engine Error: Account '${account.glCode} - ${account.accountName}' is locked and cannot accept postings.`);
    }

    return account;
  }

  /**
   * Central Automatic Posting Engine method.
   * Enforces Double Entry Accounting, dynamically resolves accounts, creates Journal Entry,
   * creates Journal Lines, creates General Ledger entries, updates running balances, and logs audit trail.
   */
  static async postTransaction(tx: any, payload: PostTransactionPayload) {
    if (!payload.lines || !Array.isArray(payload.lines) || payload.lines.length < 2) {
      throw new Error('Accounting Engine Error: Transaction must contain at least two accounting lines for double-entry posting.');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of payload.lines) {
      const debitVal = Number(line.debit) || 0;
      const creditVal = Number(line.credit) || 0;
      if (debitVal < 0 || creditVal < 0) {
        throw new Error('Accounting Engine Error: Debit and Credit amounts cannot be negative.');
      }
      totalDebit += debitVal;
      totalCredit += creditVal;
    }

    // Check Double Entry balance constraint
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Accounting Engine Error: Transaction must follow Double Entry Accounting. Total Debit (${totalDebit.toFixed(2)}) does not equal Total Credit (${totalCredit.toFixed(2)}).`);
    }

    if (totalDebit <= 0) {
      throw new Error('Accounting Engine Error: Transaction amount must be greater than zero.');
    }

    const postingDate = payload.postingDate ? new Date(payload.postingDate) : new Date();
    const status = payload.status || 'Posted';
    const voucherType = payload.voucherType || 'JV';
    const subsidiary = payload.subsidiary || 'Global';
    const reference = payload.reference || 'Auto Post';
    const description = payload.description || `Automatic posting from ${payload.module}`;

    // Generate voucher No if not provided
    let voucherNo = payload.voucherNo;
    if (!voucherNo) {
      const prefix = voucherType;
      const datePart = postingDate.toISOString().slice(2, 10).replace(/-/g, '');
      const randPart = Math.floor(100000 + Math.random() * 900000);
      voucherNo = `${prefix}-${datePart}-${randPart}`;
    }

    // Resolve all accounts first inside transaction to ensure no missing accounts
    const resolvedLines = [];
    for (const line of payload.lines) {
      const account = await AccountingService.resolveAccount(tx, line);
      resolvedLines.push({
        ...line,
        account,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description || description
      });
    }

    // 1. Create Journal Entry
    const journalEntry = await tx.journalEntry.create({
      data: {
        voucherNo,
        postingDate,
        subsidiary,
        reference,
        description,
        postedBy: payload.postedBy || 'system',
        status,
        voucherType
      }
    });

    const createdLedgerEntries = [];

    // 2. Create Journal Entry Lines, Ledger Entries, and update Account Balances
    for (const line of resolvedLines) {
      // Create Journal Entry Line
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: line.account.id,
          description: line.description,
          debit: line.debit,
          credit: line.credit
        }
      });

      if (status === 'Posted') {
        // Create Ledger Entry
        const ledgerEntry = await tx.ledgerEntry.create({
          data: {
            accountId: line.account.id,
            debit: line.debit,
            credit: line.credit,
            reference: voucherNo,
            description: line.description,
            postingDate
          }
        });
        createdLedgerEntries.push(ledgerEntry);

        // Update Account Running Balance using the account's normal balance side.
        const typeName = (line.account.accountType?.name || '').toUpperCase();
        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);
        const netChange = isDebitNormal
          ? (line.debit - line.credit)
          : (line.credit - line.debit);
        if (netChange !== 0) {
          await tx.account.update({
            where: { id: line.account.id },
            data: {
              currentBalance: {
                increment: netChange
              }
            }
          });
        }
      }
    }

    // 3. Automatically Log Audit Trail inside transaction
    try {
      await tx.auditLog.create({
        data: {
          userId: payload.postedBy && payload.postedBy !== 'system' && payload.postedBy.length === 36 ? payload.postedBy : null,
          action: `Auto Post Journal (${voucherNo})`,
          module: payload.module,
          oldValues: null,
          newValues: {
            voucherNo,
            voucherType,
            reference,
            totalDebit,
            totalCredit,
            linesCount: resolvedLines.length,
            status,
            postedBy: payload.postedBy || null
          },
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null
        }
      });
    } catch (e) {
      // Ignore audit log errors for now
      console.warn('Audit log creation failed:', e);
    }

    return {
      journalEntry,
      ledgerEntries: createdLedgerEntries,
      voucherNo,
      totalDebit,
      totalCredit
    };
  }

  /**
   * Helper: Automatically post a Receipt (Income / Donation / Fee collection).
   * Debits Cash/Bank Account and Credits Income/Revenue Account.
   */
  static async postReceipt(tx: any, params: PostReceiptParams) {
    if (params.amount <= 0) {
      throw new Error('Accounting Engine Error: Receipt amount must be greater than zero.');
    }

    const lines: AccountingLinePayload[] = [
      {
        accountId: params.cashOrBankAccountId,
        accountCode: params.cashOrBankAccountCode,
        accountKeyword: params.cashOrBankAccountKeyword || (!params.cashOrBankAccountId && !params.cashOrBankAccountCode ? 'Cash' : undefined),
        accountType: 'ASSET',
        debit: params.amount,
        credit: 0,
        description: `Receipt: ${params.description || params.reference}`
      },
      {
        accountId: params.incomeAccountId,
        accountCode: params.incomeAccountCode,
        accountKeyword: params.incomeAccountKeyword || 'Income',
        accountType: 'REVENUE',
        debit: 0,
        credit: params.amount,
        description: `Revenue: ${params.description || params.reference}`
      }
    ];

    return AccountingService.postTransaction(tx, {
      voucherType: params.voucherType || 'BR',
      postingDate: params.postingDate,
      subsidiary: params.subsidiary,
      reference: params.reference,
      description: params.description,
      module: params.module,
      postedBy: params.postedBy,
      lines,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Helper: Automatically post a Payment (Expense / Salary / Fuel / Donation Given / Repair).
   * Debits Expense Account and Credits Cash/Bank Account.
   */
  static async postPayment(tx: any, params: PostPaymentParams) {
    if (params.amount <= 0) {
      throw new Error('Accounting Engine Error: Payment amount must be greater than zero.');
    }

    const lines: AccountingLinePayload[] = [
      {
        accountId: params.expenseAccountId,
        accountCode: params.expenseAccountCode,
        accountKeyword: params.expenseAccountKeyword || 'Expense',
        accountType: 'EXPENSE',
        debit: params.amount,
        credit: 0,
        description: `Expense: ${params.description || params.reference}`
      },
      {
        accountId: params.cashOrBankAccountId,
        accountCode: params.cashOrBankAccountCode,
        accountKeyword: params.cashOrBankAccountKeyword || (!params.cashOrBankAccountId && !params.cashOrBankAccountCode ? 'Cash' : undefined),
        accountType: 'ASSET',
        debit: 0,
        credit: params.amount,
        description: `Payment: ${params.description || params.reference}`
      }
    ];

    return AccountingService.postTransaction(tx, {
      voucherType: params.voucherType || 'BP',
      postingDate: params.postingDate,
      subsidiary: params.subsidiary,
      reference: params.reference,
      description: params.description,
      module: params.module,
      postedBy: params.postedBy,
      lines,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Helper: Automatically post a Bank Deposit, Cash Withdrawal, or Cash/Bank Transfer.
   * Debits Target (To) Account and Credits Source (From) Account.
   */
  static async postTransfer(tx: any, params: PostTransferParams) {
    if (params.amount <= 0) {
      throw new Error('Accounting Engine Error: Transfer amount must be greater than zero.');
    }

    const lines: AccountingLinePayload[] = [
      {
        accountId: params.toAccountId,
        accountCode: params.toAccountCode,
        accountType: 'ASSET',
        debit: params.amount,
        credit: 0,
        description: `Transfer In: ${params.description || params.reference}`
      },
      {
        accountId: params.fromAccountId,
        accountCode: params.fromAccountCode,
        accountType: 'ASSET',
        debit: 0,
        credit: params.amount,
        description: `Transfer Out: ${params.description || params.reference}`
      }
    ];

    return AccountingService.postTransaction(tx, {
      voucherType: params.voucherType || 'BT',
      postingDate: params.postingDate,
      subsidiary: params.subsidiary,
      reference: params.reference,
      description: params.description,
      module: params.module,
      postedBy: params.postedBy,
      lines,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Enforces the enterprise accounting rule:
   * Do not store balances manually. Balance should always be calculated from Journal Entry Lines.
   * Formula: Opening Balance + Debit - Credit = Current Balance
   *
   * Recalculates and updates an account's currentBalance based strictly on its historical Journal Entry Lines.
   */
  static async recalculateAccountBalance(tx: any, accountId: string): Promise<number> {
    const account = await tx.account.findUnique({
      where: { id: accountId },
      include: { accountType: true }
    });
    if (!account) {
      throw new Error(`Account not found for recalculation: ${accountId}`);
    }

    const aggregations = await tx.journalEntryLine.aggregate({
      where: {
        accountId,
        journalEntry: {
          status: 'Posted'
        }
      },
      _sum: {
        debit: true,
        credit: true
      }
    });

    const totalDebit = Number(aggregations._sum.debit) || 0;
    const totalCredit = Number(aggregations._sum.credit) || 0;
    const initialBalance = Number(account.initialBalance) || 0;

    const typeName = account.accountType?.name?.toUpperCase() || 'ASSET';
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);

    const currentBalance = isDebitNormal
      ? (initialBalance + totalDebit - totalCredit)
      : (initialBalance + totalCredit - totalDebit);

    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance }
    });

    return currentBalance;
  }

  /**
   * Recalculates balances for all GL accounts in the system to ensure Trial Balance,
   * Balance Sheet, and Income Statement remain 100% accurate.
   */
  static async recalculateAllBalances(txObj?: any): Promise<{ updated: number }> {
    const runInTx = async (tx: any) => {
      const accounts = await tx.account.findMany({
        where: { accountLevel: { in: ['GL', 'SUBSIDIARY'] } },
        select: { id: true }
      });

      for (const acc of accounts) {
        await AccountingService.recalculateAccountBalance(tx, acc.id);
      }
      return { updated: accounts.length };
    };

    if (txObj) {
      return runInTx(txObj);
    } else {
      return prisma.$transaction(runInTx);
    }
  }

  /**
   * Automatically heals any journal entry lines posted to non-leaf header accounts
   * (e.g. 1100 Cash & Cash Equivalents) by moving them to standard leaf accounts (e.g. 1115 Cash in Hand).
   */
  static async ensureLeafPostingsAndBalances(prismaClient: any) {
    try {
      const cashAccount = await AccountingService.ensureCashInHandAccount(prismaClient);
      let needsRecalculation = false;

      // Fix any bank accounts erroneously marked with detailType = 'Cash'
      await prismaClient.account.updateMany({
        where: {
          accountName: { contains: 'Bank', mode: 'insensitive' },
          detailType: 'Cash'
        },
        data: { detailType: 'Bank' }
      });

      // Heal Hall Bookings with paymentMethod = 'CASH' that got posted to Bank accounts
      const cashBookings = await prismaClient.hallBooking.findMany({
        where: { paymentMethod: 'CASH' },
        include: { journalEntry: { include: { lines: true } } }
      });

      for (const booking of cashBookings) {
        if (booking.journalEntry) {
          for (const line of booking.journalEntry.lines) {
            if (line.debit > 0 && line.accountId !== cashAccount.id) {
              await prismaClient.journalEntryLine.update({
                where: { id: line.id },
                data: { accountId: cashAccount.id }
              });
              await prismaClient.ledgerEntry.updateMany({
                where: { reference: booking.journalEntry.id, debit: { gt: 0 } },
                data: { accountId: cashAccount.id }
              });
              needsRecalculation = true;
            }
          }
        }
      }

      // Heal Donations Received with paymentMethod = 'CASH' that got posted to Bank accounts
      const cashDonationsReceived = await prismaClient.donationReceived.findMany({
        where: { paymentMethod: 'CASH' },
        include: { journalEntry: { include: { lines: true } } }
      });

      for (const donRec of cashDonationsReceived) {
        if (donRec.journalEntry) {
          for (const line of donRec.journalEntry.lines) {
            if (line.debit > 0 && line.accountId !== cashAccount.id) {
              await prismaClient.journalEntryLine.update({
                where: { id: line.id },
                data: { accountId: cashAccount.id }
              });
              await prismaClient.ledgerEntry.updateMany({
                where: { reference: donRec.journalEntry.id, debit: { gt: 0 } },
                data: { accountId: cashAccount.id }
              });
              if (donRec.cashAccountId !== cashAccount.id) {
                await prismaClient.donationReceived.update({
                  where: { id: donRec.id },
                  data: { cashAccountId: cashAccount.id, bankAccountId: null }
                });
              }
              needsRecalculation = true;
            }
          }
        }
      }

      const headerLines = await prismaClient.journalEntryLine.findMany({
        where: {
          account: {
            children: {
              some: {}
            }
          }
        },
        include: {
          account: true
        }
      });

      if (headerLines.length > 0) {
        for (const line of headerLines) {
          let leafAccount = null;
          const nameLower = (line.account.accountName || '').toLowerCase();
          const detailLower = (line.account.detailType || '').toLowerCase();

          if (nameLower.includes('cash') || detailLower === 'cash') {
            leafAccount = cashAccount;
          } else if (nameLower.includes('bank') || detailLower === 'bank') {
            leafAccount = await prismaClient.account.findFirst({
              where: {
                OR: [
                  { accountName: { contains: 'Bank', mode: 'insensitive' } },
                  { detailType: { equals: 'Bank', mode: 'insensitive' } }
                ],
                children: { none: {} },
                isLocked: false
              },
              orderBy: { glCode: 'asc' }
            });
          }

          if (leafAccount && leafAccount.id !== line.accountId) {
            await prismaClient.journalEntryLine.update({
              where: { id: line.id },
              data: { accountId: leafAccount.id }
            });
            await prismaClient.ledgerEntry.updateMany({
              where: { accountId: line.accountId, reference: line.journalEntryId },
              data: { accountId: leafAccount.id }
            });
            needsRecalculation = true;
          }
        }
      }

      if (needsRecalculation) {
        await AccountingService.recalculateAllBalances(prismaClient);
      }
    } catch (err) {
      // Ignore migration errors during normal flow
    }
  }

  /**
   * Posts a previously drafted Journal Entry: generates Ledger Entries and updates Account running balances.
   */
  static async postDraft(tx: any, journalEntryId: string, postedBy?: string) {
    const je = await tx.journalEntry.findUnique({
      where: { id: journalEntryId },
      include: { lines: true }
    });

    if (!je) throw new Error('Accounting Engine Error: Journal entry not found.');
    if (je.status === 'Posted') return je;
    if (je.status !== 'Draft') throw new Error(`Accounting Engine Error: Cannot post journal entry with status '${je.status}'.`);

    // Flip status before recalculating balances: recalculateAccountBalance aggregates
    // only 'Posted' lines, so it must see the new status or it silently excludes this
    // entry's own lines and discards the increment applied a moment earlier.
    const updatedJe = await tx.journalEntry.update({
      where: { id: je.id },
      data: { status: 'Posted' }
    });

    for (const line of je.lines) {
      await tx.ledgerEntry.create({
        data: {
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          reference: je.voucherNo,
          description: line.description || je.description || je.reference || 'Journal Entry',
          postingDate: je.postingDate,
        }
      });

      const netChange = line.debit - line.credit;
      if (netChange !== 0) {
        await tx.account.update({
          where: { id: line.accountId },
          data: {
            currentBalance: {
              increment: netChange
            }
          }
        });
        try {
          await AccountingService.recalculateAccountBalance(tx, line.accountId);
        } catch (e) {}
      }
    }

    try {
      await tx.auditLog.create({
        data: {
          userId: postedBy && postedBy.length === 36 ? postedBy : null,
          action: `Post Draft Journal (${je.voucherNo})`,
          module: 'Journal Entries',
          oldValues: { status: 'Draft' },
          newValues: { status: 'Posted', voucherNo: je.voucherNo },
        }
      });
    } catch (e) {
      // ignore non-uuid audit user
    }

    return updatedJe;
  }

  /**
   * Reverses a Posted Journal Entry: creates reversal Ledger Entries and updates Account running balances.
   */
  static async reverseJournalEntry(tx: any, journalEntryId: string, postedBy?: string, reason?: string) {
    const je = await tx.journalEntry.findUnique({
      where: { id: journalEntryId },
      include: { lines: true }
    });

    if (!je) throw new Error('Accounting Engine Error: Journal entry not found.');
    if (je.status === 'Cancelled') return je;
    if (je.status !== 'Posted') throw new Error(`Accounting Engine Error: Only Posted journal entries can be reversed/cancelled.`);

    const revReference = `${je.voucherNo}-REV`;
    const revDescription = `Reversal: ${reason || je.description || je.reference}`;

    // Flip status before recalculating balances (see postDraft for why: recalculateAccountBalance
    // only aggregates 'Posted' lines, so cancelling first would make it drop this entry's lines
    // instead of removing them, discarding the reversal's increment silently).
    const updatedJe = await tx.journalEntry.update({
      where: { id: je.id },
      data: {
        status: 'Cancelled',
        description: `${je.description ? je.description + ' ' : ''}[Cancelled/Reversed${reason ? ': ' + reason : ''}]`
      }
    });

    for (const line of je.lines) {
      await tx.ledgerEntry.create({
        data: {
          accountId: line.accountId,
          debit: line.credit,
          credit: line.debit,
          reference: revReference,
          description: revDescription,
          postingDate: new Date(),
        }
      });

      const netChange = line.credit - line.debit;
      if (netChange !== 0) {
        await tx.account.update({
          where: { id: line.accountId },
          data: {
            currentBalance: {
              increment: netChange
            }
          }
        });
        try {
          await AccountingService.recalculateAccountBalance(tx, line.accountId);
        } catch (e) {}
      }
    }

    try {
      await tx.auditLog.create({
        data: {
          userId: postedBy && postedBy.length === 36 ? postedBy : null,
          action: `Reverse Journal (${je.voucherNo})`,
          module: 'Journal Entries',
          oldValues: { status: 'Posted' },
          newValues: { status: 'Cancelled', voucherNo: je.voucherNo, reason: reason || null },
        }
      });
    } catch (e) {
      // ignore non-uuid audit user
    }

    return updatedJe;
  }

  /**
   * Restores a Cancelled Journal Entry: removes reversal Ledger Entries and updates Account running balances.
   */
  static async restoreCancelledJournalEntry(tx: any, journalEntryId: string, newStatus: string, postedBy?: string) {
    const je = await tx.journalEntry.findUnique({
      where: { id: journalEntryId },
      include: { lines: true }
    });

    if (!je) throw new Error('Accounting Engine Error: Journal entry not found.');
    if (je.status !== 'Cancelled') return je;

    // Delete the reversal ledger entries (-REV)
    const revReference = `${je.voucherNo}-REV`;
    await tx.ledgerEntry.deleteMany({
      where: { reference: revReference }
    });

    // Flip status before recalculating balances (see postDraft for why): recalculateAccountBalance
    // only aggregates lines whose parent entry is 'Posted', so it must already see newStatus —
    // otherwise restoring to Posted silently drops this entry's lines from the recalculated balance,
    // and restoring to Draft would incorrectly still count them.
    const newDescription = je.description ? je.description.replace(/\[Cancelled\/Reversed[^\]]*\]/, '').trim() : '';
    const updatedJe = await tx.journalEntry.update({
      where: { id: je.id },
      data: {
        status: newStatus,
        description: newDescription
      }
    });

    // Restore the account balances (reverse the reversal)
    for (const line of je.lines) {
      const netChange = line.debit - line.credit; // opposite of reversal
      if (netChange !== 0) {
        await tx.account.update({
          where: { id: line.accountId },
          data: {
            currentBalance: {
              increment: netChange
            }
          }
        });
        try {
          await AccountingService.recalculateAccountBalance(tx, line.accountId);
        } catch (e) {}
      }
    }

    // Re-create ledger entries if restoring to Posted status
    if (newStatus === 'Posted') {
      for (const line of je.lines) {
        await tx.ledgerEntry.create({
          data: {
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            reference: je.voucherNo,
            description: line.description || je.description,
            postingDate: je.postingDate,
          }
        });
      }
    }

    try {
      await tx.auditLog.create({
        data: {
          userId: postedBy && postedBy.length === 36 ? postedBy : null,
          action: `Restore Journal (${je.voucherNo})`,
          module: 'Journal Entries',
          oldValues: { status: 'Cancelled' },
          newValues: { status: newStatus, voucherNo: je.voucherNo },
        }
      });
    } catch (e) {
      // ignore non-uuid audit user
    }

    return updatedJe;
  }

  /**
   * Permanently deletes a Journal Entry, its lines, and associated Ledger Entries from the database,
   * while recalculating account balances.
   */
  static async deleteJournalEntry(tx: any, journalEntryId: string, postedBy?: string, reason?: string) {
    const je = await tx.journalEntry.findUnique({
      where: { id: journalEntryId },
      include: { lines: true }
    });

    if (!je) return null;

    const accountIds = Array.from(new Set(je.lines.map((l: any) => l.accountId)));
    // LedgerEntry.reference is always set to the journal entry's unique voucherNo (see
    // postTransaction/postDraft/reverseJournalEntry) — never to the free-text JournalEntry.reference
    // field, which isn't unique (many entries default to the literal "Journal Entry"). Matching on
    // je.reference here would risk deleting an unrelated entry's ledger rows on a string collision.
    const voucherRefs = [je.voucherNo, `${je.voucherNo}-REV`];

    // Delete associated ledger entries
    await tx.ledgerEntry.deleteMany({
      where: {
        reference: { in: voucherRefs }
      }
    });

    // Delete journal entry lines
    await tx.journalEntryLine.deleteMany({
      where: { journalEntryId: je.id }
    });

    // Delete the journal entry
    const deletedJe = await tx.journalEntry.delete({
      where: { id: je.id }
    });

    // Recalculate account balances for all affected accounts
    for (const accountId of accountIds) {
      try {
        await AccountingService.recalculateAccountBalance(tx, accountId as string);
      } catch (e) {
        // Ignore if account was already deleted
      }
    }

    try {
      await tx.auditLog.create({
        data: {
          userId: postedBy && postedBy !== 'system' && postedBy.length === 36 ? postedBy : null,
          action: `Delete Journal (${je.voucherNo})`,
          module: 'Journal Entries',
          oldValues: { voucherNo: je.voucherNo, status: je.status, reference: je.reference },
          newValues: { deleted: true, reason: reason || null },
        }
      });
    } catch (e) {
      // ignore non-uuid audit user
    }

    return deletedJe;
  }

  static isCashAccount(name: string, detailType: string): boolean {
    const detailLower = (detailType || '').toLowerCase();
    const nameLower = (name || '').toLowerCase();
    return detailLower === 'cash' || nameLower.includes('cash') || nameLower.includes('till') || nameLower.includes('petty') || nameLower.includes('hand');
  }

  static isBankAccount(name: string, detailType: string): boolean {
    const detailLower = (detailType || '').toLowerCase();
    const nameLower = (name || '').toLowerCase();
    return detailLower === 'bank' || nameLower.includes('bank') || nameLower.includes('al-habib') || nameLower.includes('nbp') || nameLower.includes('national bank') || nameLower.includes('mcb') || nameLower.includes('ubl') || nameLower.includes('allied') || nameLower.includes('faysal');
  }

  static async getGeneralLedger(params: { startDate?: string; endDate?: string; accountId?: string; glCode?: string; page?: string | number; limit?: string | number }) {
    const { startDate, endDate, accountId, glCode, page = '1', limit = '100' } = params;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 100;
    const skip = (pageNum - 1) * limitNum;

    // Resolve Account
    let targetAccount = null;
    if (accountId) {
      targetAccount = await prisma.account.findUnique({ where: { id: accountId }, include: { accountType: true } });
    } else if (glCode) {
      targetAccount = await prisma.account.findUnique({ where: { glCode }, include: { accountType: true } });
    }

    if (!targetAccount && (accountId || glCode)) {
      throw Object.assign(new Error('Account not found'), { status: 404 });
    }

    // Build Where Clause for Entries within Date Range
    const entryWhere: any = {};
    if (targetAccount) {
      entryWhere.accountId = targetAccount.id;
    }
    
    if (startDate || endDate) {
      entryWhere.postingDate = {};
      if (startDate) entryWhere.postingDate.gte = new Date(startDate);
      if (endDate) entryWhere.postingDate.lte = new Date(endDate);
    }

    // Fetch entries
    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: entryWhere,
        include: { account: { select: { glCode: true, accountName: true, initialBalance: true, accountType: { select: { name: true } } } } },
        orderBy: { postingDate: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.ledgerEntry.count({ where: entryWhere })
    ]);

    // For each unique account present in the fetched entries, calculate its opening balance
    const uniqueAccountIds = [...new Set(entries.map(e => e.accountId))];
    const accountMeta: Record<string, { openingBalance: number; type: string; initialBalance: number; name: string }> = {};

    for (const accId of uniqueAccountIds) {
      const firstEntry = entries.find(e => e.accountId === accId);
      const initialBal = firstEntry?.account?.initialBalance || 0;
      const typeName = (firstEntry?.account as any)?.accountType?.name?.toUpperCase() || 'ASSET';
      const glCodeVal = firstEntry?.account?.glCode || '';
      const name = firstEntry?.account?.accountName || '';
      
      let opBal = initialBal;

      if (startDate) {
        const prior = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: accId,
            postingDate: { lt: new Date(startDate) }
          },
          _sum: { debit: true, credit: true }
        });
        const pDebit = prior._sum.debit || 0;
        const pCredit = prior._sum.credit || 0;
        if (['ASSET', 'EXPENSE'].includes(typeName)) {
          opBal += (pDebit - pCredit);
        } else {
          opBal += (pCredit - pDebit);
        }
      }
      accountMeta[glCodeVal] = { openingBalance: opBal, type: typeName, initialBalance: initialBal, name };
    }

    // Calculate Opening Balance
    let openingBalance = 0;
    
    if (targetAccount) {
      openingBalance = targetAccount.initialBalance || 0;
      
      // Calculate net activity before startDate
      if (startDate) {
        const priorEntries = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: targetAccount.id,
            postingDate: { lt: new Date(startDate) }
          },
          _sum: { debit: true, credit: true }
        });
        
        const priorDebit = priorEntries._sum.debit || 0;
        const priorCredit = priorEntries._sum.credit || 0;
        
        const typeName = targetAccount.accountType?.name?.toUpperCase() || 'ASSET';
        
        // Debit normal accounts
        if (['ASSET', 'EXPENSE'].includes(typeName)) {
          openingBalance += (priorDebit - priorCredit);
        } else {
          // Credit normal accounts (LIABILITY, EQUITY, REVENUE)
          openingBalance += (priorCredit - priorDebit);
        }
      }
    } else if (entries.length > 0) {
        openingBalance = 0;
    }

    // Calculate Debit and Credit totals within range
    let totalDebit = 0;
    let totalCredit = 0;

    const formattedEntries = entries.map(entry => {
      totalDebit += entry.debit;
      totalCredit += entry.credit;
      
      return {
        id: entry.id,
        date: entry.postingDate.toISOString().split('T')[0],
        glCode: entry.account.glCode,
        accountName: entry.account.accountName,
        reference: entry.reference,
        description: entry.description,
        debit: entry.debit,
        credit: entry.credit
      };
    });

    let closingBalance = 0;
    if (targetAccount) {
        const typeName = targetAccount.accountType?.name?.toUpperCase() || 'ASSET';
        if (['ASSET', 'EXPENSE'].includes(typeName)) {
            closingBalance = openingBalance + totalDebit - totalCredit;
        } else {
            closingBalance = openingBalance + totalCredit - totalDebit;
        }
    }

    return {
      account: targetAccount ? {
          glCode: targetAccount.glCode,
          name: targetAccount.accountName,
          type: targetAccount.accountType?.name || 'Unknown'
      } : null,
      summary: {
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance: targetAccount ? closingBalance : null
      },
      accountMeta,
      entries: formattedEntries,
      total,
      page: pageNum,
      limit: limitNum
    };
  }

  static async getTrialBalance(startDate?: string, endDate?: string) {
    const activeAccounts = await prisma.account.findMany({
      include: {
        accountType: true
      },
      orderBy: { glCode: 'asc' }
    });

    let totalDebit = 0;
    let totalCredit = 0;
    let openingRetainedEarnings = 0;

    const formatted: any[] = [];

    for (const acc of activeAccounts) {
      let balance = acc.currentBalance;

      // If date filter is provided, compute balance from ledger entries in that range
      if (startDate || endDate) {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.lte = end;
        }

        const agg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: dateFilter
          },
          _sum: { debit: true, credit: true }
        });

        const d = Number(agg._sum.debit) || 0;
        const c = Number(agg._sum.credit) || 0;

        const typeName = (acc.accountType?.name || '').toUpperCase();
        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);
        const isPnl = ['REVENUE', 'EXPENSE'].includes(typeName);

        if (isPnl) {
          balance = isDebitNormal ? d - c : c - d;
        } else {
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            const cumAgg = await prisma.ledgerEntry.aggregate({
              where: { accountId: acc.id, postingDate: { lte: end } },
              _sum: { debit: true, credit: true }
            });
            const cd = Number(cumAgg._sum.debit) || 0;
            const cc = Number(cumAgg._sum.credit) || 0;
            const initBal = Number(acc.initialBalance) || 0;
            balance = isDebitNormal ? initBal + cd - cc : initBal + cc - cd;
          }
        }
      }

      // Skip accounts with zero balance
      if (balance === 0) continue;

      const typeName = acc.accountType?.name?.toUpperCase() || 'ASSET';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);

      let debit = 0;
      let credit = 0;

      if (isDebitNormal) {
        if (balance > 0) debit = balance;
        else credit = Math.abs(balance);
      } else {
        if (balance > 0) credit = balance;
        else debit = Math.abs(balance);
      }

      totalDebit += debit;
      totalCredit += credit;

      // Handle retained earnings opening balance from previous periods if we have a startDate
      if (startDate && ['REVENUE', 'EXPENSE'].includes(typeName)) {
        const priorAgg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: { lt: new Date(startDate) }
          },
          _sum: { debit: true, credit: true }
        });
        const pd = Number(priorAgg._sum.debit) || 0;
        const pc = Number(priorAgg._sum.credit) || 0;
        if (typeName === 'REVENUE' || typeName === 'INCOME') {
          openingRetainedEarnings += (pc - pd);
        } else {
          openingRetainedEarnings -= (pd - pc);
        }
      }

      formatted.push({
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountType: acc.accountType?.name || 'Asset',
        balance,
        debit,
        credit
      });
    }

    if (startDate && openingRetainedEarnings !== 0) {
      const isDebit = openingRetainedEarnings < 0;
      const absAmt = Math.abs(openingRetainedEarnings);
      formatted.push({
        id: 'retained-earnings-opening-diff',
        glCode: '3010199',
        accountName: 'Retained Earnings (Prior Periods)',
        accountType: 'EQUITY',
        balance: openingRetainedEarnings,
        debit: isDebit ? absAmt : 0,
        credit: isDebit ? 0 : absAmt
      });
      if (isDebit) totalDebit += absAmt;
      else totalCredit += absAmt;
    }

    return {
      accounts: formatted,
      totalDebit,
      totalCredit,
      difference: Math.abs(totalDebit - totalCredit)
    };
  }

  static async getBalanceSheet(startDate?: string, endDate?: string) {
    const allAccounts = await prisma.account.findMany({
      include: {
        accountType: true
      },
      orderBy: { glCode: 'asc' }
    });

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    
    let totalRevenue = 0;
    let totalExpense = 0;
    let openingRetainedEarnings = 0;

    for (const acc of allAccounts) {
      const type = acc.accountType?.name;
      let balance = acc.currentBalance;

      if (type === 'REVENUE' || type === 'EXPENSE') {
        if (startDate || endDate) {
          const dateFilter: any = {};
          if (startDate) dateFilter.gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.lte = end;
          }
          const agg = await prisma.ledgerEntry.aggregate({
            where: { accountId: acc.id, postingDate: dateFilter },
            _sum: { debit: true, credit: true }
          });
          const d = Number(agg._sum.debit) || 0;
          const c = Number(agg._sum.credit) || 0;
          balance = type === 'REVENUE' ? (c - d) : (d - c);
        }
      } else {
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const agg = await prisma.ledgerEntry.aggregate({
            where: { accountId: acc.id, postingDate: { lte: end } },
            _sum: { debit: true, credit: true }
          });
          const d = Number(agg._sum.debit) || 0;
          const c = Number(agg._sum.credit) || 0;
          const initialBal = Number(acc.initialBalance) || 0;
          const typeName = (type || '').toUpperCase();
          const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);
          balance = isDebitNormal ? initialBal + d - c : initialBal + c - d;
        }
      }

      if (balance === 0) continue;
      
      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance
      };

      if (type === 'ASSET') {
        assets.push(formatted);
        totalAssets += balance;
      } else if (type === 'LIABILITY') {
        liabilities.push(formatted);
        totalLiabilities += balance;
      } else if (type === 'EQUITY') {
        equity.push(formatted);
        totalEquity += balance;
      } else if (type === 'REVENUE') {
        totalRevenue += balance;
      } else if (type === 'EXPENSE') {
        totalExpense += balance;
      }

      if (startDate && (type === 'REVENUE' || type === 'EXPENSE')) {
        const priorAgg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: { lt: new Date(startDate) }
          },
          _sum: { debit: true, credit: true }
        });
        const pd = Number(priorAgg._sum.debit) || 0;
        const pc = Number(priorAgg._sum.credit) || 0;
        if (type === 'REVENUE') {
          openingRetainedEarnings += (pc - pd);
        } else {
          openingRetainedEarnings -= (pd - pc);
        }
      }
    }

    const netPeriodIncome = totalRevenue - totalExpense;
    let retainedEarnings = netPeriodIncome;
    if (startDate) {
      retainedEarnings += openingRetainedEarnings;
    }

    if (retainedEarnings !== 0) {
      equity.push({
        id: 'retained-earnings-net',
        glCode: '3010199',
        accountName: 'Retained Earnings (P&L Transfer)',
        balance: retainedEarnings
      });
      totalEquity += retainedEarnings;
    }

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      netPeriodIncome,
      openingRetainedEarnings,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity
    };
  }

  static async getIncomeStatement(startDate?: string, endDate?: string) {
    const pnlAccounts = await prisma.account.findMany({
      where: {
        accountType: {
          name: { in: ['REVENUE', 'EXPENSE'] }
        }
      },
      include: {
        accountType: true
      },
      orderBy: { glCode: 'asc' }
    });

    const revenues: any[] = [];
    const expenses: any[] = [];
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const acc of pnlAccounts) {
      const type = acc.accountType?.name;
      let balance = acc.currentBalance;

      if (startDate || endDate) {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.lte = end;
        }

        const agg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: dateFilter
          },
          _sum: { debit: true, credit: true }
        });

        const totalDebit = Number(agg._sum.debit) || 0;
        const totalCredit = Number(agg._sum.credit) || 0;

        if (type === 'REVENUE') {
          balance = totalCredit - totalDebit;
        } else if (type === 'EXPENSE') {
          balance = totalDebit - totalCredit;
        }
      }

      if (balance === 0) continue;

      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance
      };

      if (type === 'REVENUE') {
        revenues.push(formatted);
        totalRevenue += balance;
      } else if (type === 'EXPENSE') {
        expenses.push(formatted);
        totalExpense += balance;
      }
    }

    return {
      revenues,
      expenses,
      totalRevenue,
      totalExpense,
      netProfit: totalRevenue - totalExpense
    };
  }

  static async getFinancialSummary(startDate?: string, endDate?: string) {
    const allAccounts = await prisma.account.findMany({
      include: { accountType: true }
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpense = 0;
    let cashBalance = 0;
    let bankBalance = 0;
    let openingRetainedEarnings = 0;
    const hasDateFilter = Boolean(startDate || endDate);

    for (const acc of allAccounts) {
      const typeName = (acc.accountType?.name || '').toUpperCase();
      const isLeaf = !allAccounts.some(a => a.parentId === acc.id);
      if (!isLeaf) continue;

      let bal = Number(acc.currentBalance) || 0;

      if (hasDateFilter) {
        if (typeName === 'REVENUE' || typeName === 'EXPENSE') {
          const periodFilter: any = {};
          if (startDate) periodFilter.gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            periodFilter.lte = end;
          }

          const agg = await prisma.ledgerEntry.aggregate({
            where: {
              accountId: acc.id,
              postingDate: periodFilter
            },
            _sum: { debit: true, credit: true }
          });

          const d = Number(agg._sum.debit) || 0;
          const c = Number(agg._sum.credit) || 0;
          bal = typeName === 'REVENUE' ? (c - d) : (d - c);
        } else if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const agg = await prisma.ledgerEntry.aggregate({
            where: {
              accountId: acc.id,
              postingDate: { lte: end }
            },
            _sum: { debit: true, credit: true }
          });

          const d = Number(agg._sum.debit) || 0;
          const c = Number(agg._sum.credit) || 0;
          const initialBal = Number(acc.initialBalance) || 0;
          const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);
          bal = isDebitNormal ? initialBal + d - c : initialBal + c - d;
        }
      }

      if (typeName === 'ASSET' || typeName === 'ASSETS') {
        totalAssets += bal;
        if (this.isBankAccount(acc.accountName, acc.detailType)) {
          bankBalance += bal;
        } else if (this.isCashAccount(acc.accountName, acc.detailType)) {
          cashBalance += bal;
        }
      } else if (typeName === 'LIABILITY' || typeName === 'LIABILITIES') {
        totalLiabilities += (bal < 0 ? Math.abs(bal) : bal);
      } else if (typeName === 'EQUITY') {
        totalEquity += bal;
      } else if (typeName === 'REVENUE' || typeName === 'INCOME') {
        totalRevenue += bal;
      } else if (typeName === 'EXPENSE' || typeName === 'EXPENSES' || (acc.glCode.startsWith('4') && !acc.glCode.startsWith('3') && !acc.glCode.startsWith('1') && !acc.glCode.startsWith('2'))) {
        totalExpense += bal;
      }

      if (startDate && (typeName === 'REVENUE' || typeName === 'EXPENSE')) {
        const priorAgg = await prisma.ledgerEntry.aggregate({
          where: {
            accountId: acc.id,
            postingDate: { lt: new Date(startDate) }
          },
          _sum: { debit: true, credit: true }
        });
        const pd = Number(priorAgg._sum.debit) || 0;
        const pc = Number(priorAgg._sum.credit) || 0;
        if (typeName === 'REVENUE' || typeName === 'INCOME') {
          openingRetainedEarnings += (pc - pd);
        } else {
          openingRetainedEarnings -= (pd - pc);
        }
      }
    }

    const netPeriodIncome = totalRevenue - totalExpense;
    let retainedEarnings = netPeriodIncome;
    if (startDate) {
      retainedEarnings += openingRetainedEarnings;
    }

    totalEquity += retainedEarnings;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenue,
      totalExpense,
      cashBalance,
      bankBalance,
      netPeriodIncome,
      openingRetainedEarnings,
      retainedEarnings
    };
  }
}
