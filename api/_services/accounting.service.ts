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
   * Resolves an Account from the Chart of Accounts using ID, GL Code, keyword, or type fallback.
   * Enforces that the account exists and is not locked.
   */
  static async resolveAccount(tx: any, line: AccountingLinePayload) {
    let account = null;

    if (line.accountId) {
      account = await tx.account.findUnique({ where: { id: line.accountId } });
    } else if (line.accountCode) {
      account = await tx.account.findUnique({ where: { glCode: line.accountCode } });
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
          orderBy: { glCode: 'asc' }
        });
        if (leaf) account = leaf;
      }
    }

    // Keyword or Name Search fallback
    if (!account && line.accountKeyword) {
      const keyword = line.accountKeyword.trim();
      const cleanKeyword = keyword.replace(/_/g, ' ').replace(/-/g, ' ');

      if (cleanKeyword.toLowerCase() === 'cash') {
        account = await tx.account.findFirst({
          where: {
            OR: [
              { accountName: { equals: 'Cash in Hand', mode: 'insensitive' } },
              { accountName: { contains: 'Cash in Hand', mode: 'insensitive' } },
              { accountName: { contains: 'Cash', mode: 'insensitive' } },
              { detailType: { equals: 'Cash', mode: 'insensitive' } }
            ],
            isLocked: false,
            children: { none: {} }
          },
          orderBy: { glCode: 'asc' }
        });
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
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['GL', 'SUBSIDIARY'] }
          },
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
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['GL', 'SUBSIDIARY'] }
          },
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
            isLocked: false,
            children: { none: {} }
          },
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

        // Update Account Running Balance
        // Formula: Opening Balance + Total Debit - Total Credit = Current Balance
        const netChange = line.debit - line.credit;
        if (netChange !== 0) {
          await tx.account.update({
            where: { id: line.account.id },
            data: {
              currentBalance: {
                increment: netChange
              }
            }
          });
          try {
            await AccountingService.recalculateAccountBalance(tx, line.account.id);
          } catch (e) {
            // fallback if recalculation fails
          }
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
            status
          },
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null
        }
      });
    } catch (auditErr) {
      // If audit logging fails due to non-UUID postedBy string, still log without userId
      await tx.auditLog.create({
        data: {
          userId: null,
          action: `Auto Post Journal (${voucherNo}) [user: ${payload.postedBy}]`,
          module: payload.module,
          oldValues: null,
          newValues: {
            voucherNo,
            voucherType,
            reference,
            totalDebit,
            totalCredit,
            linesCount: resolvedLines.length,
            status
          },
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null
        }
      });
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
        debit: params.amount,
        credit: 0,
        description: `Receipt: ${params.description || params.reference}`
      },
      {
        accountId: params.incomeAccountId,
        accountCode: params.incomeAccountCode,
        accountKeyword: params.incomeAccountKeyword || 'Income',
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
        debit: params.amount,
        credit: 0,
        description: `Expense: ${params.description || params.reference}`
      },
      {
        accountId: params.cashOrBankAccountId,
        accountCode: params.cashOrBankAccountCode,
        accountKeyword: params.cashOrBankAccountKeyword || (!params.cashOrBankAccountId && !params.cashOrBankAccountCode ? 'Cash' : undefined),
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
        debit: params.amount,
        credit: 0,
        description: `Transfer In: ${params.description || params.reference}`
      },
      {
        accountId: params.fromAccountId,
        accountCode: params.fromAccountCode,
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
      : (-initialBalance + totalDebit - totalCredit);

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
            leafAccount = await prismaClient.account.findFirst({
              where: {
                OR: [
                  { accountName: { equals: 'Cash in Hand', mode: 'insensitive' } },
                  { accountName: { contains: 'Cash in Hand', mode: 'insensitive' } },
                  { accountName: { contains: 'Cash', mode: 'insensitive' } }
                ],
                children: { none: {} },
                isLocked: false
              },
              orderBy: { glCode: 'asc' }
            });
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
          }
        }
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
      }
    }

    const updatedJe = await tx.journalEntry.update({
      where: { id: je.id },
      data: { status: 'Posted' }
    });

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
      }
    }

    const updatedJe = await tx.journalEntry.update({
      where: { id: je.id },
      data: { 
        status: 'Cancelled',
        description: `${je.description ? je.description + ' ' : ''}[Cancelled/Reversed${reason ? ': ' + reason : ''}]`
      }
    });

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
    const voucherRefs = [je.voucherNo, `${je.voucherNo}-REV`];
    if (je.reference) {
      voucherRefs.push(je.reference, `${je.reference}-REV`);
    }

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
}

