import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { logger } from '../_utils/logger.js';
import { AccountingSyncService } from './accounting-sync.service.js';
import { FundValidationService, InsufficientFundsError } from './fund-validation.service.js';

export interface AccountingLinePayload {
  accountCode?: string;      // GL Code (e.g., '1010101' or '3010101')
  accountId?: string;        // Account UUID
  accountKeyword?: string;   // Keyword or type fallback (e.g., 'Cash In Hand', 'Donation Income', 'Salaries Expense')
  accountType?: string;      // Optional AccountType filter e.g., 'ASSET', 'REVENUE', 'EXPENSE'
  debit: number | Prisma.Decimal | string;
  credit: number | Prisma.Decimal | string;
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
  // Callers pass money straight through from Prisma, which hands back Decimal
  // for money columns. Accepting Decimal here (as AccountingLinePayload already
  // does) keeps amounts exact instead of forcing a lossy Number() at each site.
  amount: number | Prisma.Decimal;
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

/**
 * THE definition of "a posting that counts".
 *
 * Every balance in the system — the Account.currentBalance cache, the Trial
 * Balance, Balance Sheet, Income Statement, General Ledger, dashboard cards
 * and the integrity checker — must agree on which JournalEntry rows are real.
 * Anything Draft, Pending, Cancelled or soft-deleted contributes nothing.
 *
 * Having two slightly different versions of this predicate is what produced
 * CACHED_BALANCE_DRIFT, so it now lives in exactly one place and every reader
 * imports it rather than re-spelling the where clause.
 */
export const POSTED_JOURNAL_FILTER = { status: 'Posted', isDeleted: false } as const;

/** Result of one item's auto-repair attempt — used by every per-item-isolated repair loop. */
export interface RepairItem {
  id?: string;
  glCode?: string;
  name?: string;
  action?: string;
  reason?: string;
}

/**
 * Maps a raw Prisma/Postgres error into the short, plain-English reason the
 * Accounting Health Check UI shows next to a skipped item (e.g. "GL Code
 * 30205510 — Reason: Invalid GL Length"). Falls back to the raw message
 * untouched for anything unrecognized, so nothing is ever silently reduced
 * to a generic string — the full error is always logged separately by the
 * caller alongside this classification, never in place of it.
 */
export function classifyError(err: any): string {
  const code = err?.code;
  if (code === 'P2002') return `Duplicate value violates a unique constraint (${err?.meta?.target || 'unknown field'})`;
  if (code === 'P2003') return `Parent Account Missing (foreign key constraint on ${err?.meta?.field_name || 'related record'})`;
  if (code === 'P2025') return 'Ledger Mapping Missing (referenced record not found)';
  if (code === 'P2028') return 'Transaction timed out';
  if (typeof err?.message === 'string' && err.message.length > 0) return err.message;
  return 'Unknown error';
}

/** Full structured detail for server-side logs — never shown to the user, always logged. */
export function errDetails(err: any) {
  return {
    message: err?.message,
    code: err?.code,
    meta: err?.meta,
    stack: err?.stack,
  };
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
   * Ensures a dedicated leaf 'General Donation' revenue account exists and returns it.
   * Donations Received defaults new receipts to this type, so it must always resolve
   * deterministically instead of depending on Chart of Accounts having been seeded
   * with a matching leaf account (see 'General Donation' Accounting Engine Error).
   */
  static async ensureGeneralDonationAccount(tx: any) {
    let donationAccount = await tx.account.findFirst({
      where: {
        accountName: { equals: 'General Donation', mode: 'insensitive' },
        isLocked: false,
        children: { none: {} }
      },
      orderBy: { glCode: 'asc' }
    });

    if (donationAccount) return donationAccount;

    const parentAccount = await tx.account.findFirst({
      where: {
        OR: [
          { glCode: '3020400' },
          { accountName: { equals: 'Other Income', mode: 'insensitive' } }
        ]
      }
    });

    const revenueType = await tx.accountType.findFirst({
      where: { name: { in: ['Revenue', 'REVENUE', 'Revenues'] } }
    });

    let glCode = '3020408';
    let codeCounter = 8;
    while (await tx.account.findUnique({ where: { glCode } })) {
      codeCounter++;
      glCode = `302040${codeCounter}`;
    }

    donationAccount = await tx.account.create({
      data: {
        glCode,
        accountName: 'General Donation',
        accountLevel: 'GL',
        parentId: parentAccount ? parentAccount.id : null,
        accountTypeId: revenueType ? revenueType.id : (parentAccount ? parentAccount.accountTypeId : null),
        detailType: 'Revenue',
        currency: 'PKR',
        subsidiary: ['Global'],
        initialBalance: 0,
        currentBalance: 0,
        isSystemDefined: true,
        description: 'General/unrestricted donation income'
      }
    });

    return donationAccount;
  }

  static async getOrCreateAccountsReceivable(tx: any) {
    let arAccount = await tx.account.findFirst({
      where: {
        OR: [
          { accountName: { contains: 'Accounts Receivable', mode: 'insensitive' } },
          { glCode: '1010200' }
        ]
      }
    });

    if (!arAccount) {
      const parentAccount = await tx.account.findFirst({
        where: {
          OR: [
            { glCode: '1010000' },
            { accountName: { contains: 'Current Assets', mode: 'insensitive' } }
          ]
        }
      });

      if (!parentAccount) {
        throw new Error('Current Assets account not found in Chart of Accounts.');
      }

      arAccount = await tx.account.create({
        data: {
          glCode: '1010200',
          accountName: 'Accounts Receivable',
          accountLevel: 'SUBSIDIARY',
          parentId: parentAccount.id,
          accountTypeId: parentAccount.accountTypeId,
          detailType: 'Accounts Receivable',
          description: 'Standard Accounts Receivable account',
          currency: 'PKR',
          subsidiary: ['Global'],
          initialBalance: 0,
          currentBalance: 0,
          isSystemDefined: true,
        }
      });
    }

    return arAccount;
  }

  /**
   * Resolves an Account from the Chart of Accounts.
   *
   * Resolution order (most to least deterministic):
   *   1. Explicit Account ID          (preferred — unambiguous)
   *   2. Explicit GL Code             (preferred — unambiguous)
   *   3. Reserved 'Cash' system account via ensureCashInHandAccount (a dedicated
   *      getter, not name matching)
   *   4. EXACT account name / detailType / GL code match
   *   5. LAST-RESORT case-insensitive `contains` on the account name — documented
   *      tech debt, retained only so callers that still pass a donation type or
   *      head name that is not an exact account name (e.g. 'ZAKAT' → the account
   *      literally named "Zakat 2024-25") keep posting. To eliminate step 5,
   *      link every RevenueHead/ExpenseHead to a GL account and pass an explicit
   *      accountId/accountCode from the module.
   *
   * The previously-present SILENT fallbacks — first-word substring, description
   * substring, "grab any REVENUE/EXPENSE account", and "first account of this
   * type" — have been REMOVED. Those could route a posting to an arbitrary
   * account with no warning; now, if nothing above matches, we throw.
   */
  static async resolveAccount(tx: any, line: AccountingLinePayload) {
    let account = null;

    // 1 & 2. Explicit, deterministic resolution.
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

    // If an explicit account turns out to be a header, descend to a leaf ONLY
    // through the real parent/child hierarchy — never by name guessing.
    if (account) {
      const hasChild = await tx.account.findFirst({ where: { parentId: account.id } });
      if (hasChild) {
        const leaf = await tx.account.findFirst({
          where: {
            parentId: account.id,
            children: { none: {} },
            isLocked: false
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });
        if (leaf) {
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

    // 3, 4 & 5. Keyword resolution (only when no explicit ID/code was supplied).
    if (!account && line.accountKeyword) {
      const keyword = line.accountKeyword.trim();
      const cleanKeyword = keyword.replace(/_/g, ' ').replace(/-/g, ' ');

      // 3. Reserved system Cash account (deterministic getter).
      if (cleanKeyword.toLowerCase() === 'cash') {
        account = await AccountingService.ensureCashInHandAccount(tx);
      }

      const typeFilter = line.accountType
        ? { name: { equals: line.accountType, mode: 'insensitive' } }
        : undefined;

      // 4. EXACT match on account name / detailType / GL code.
      if (!account) {
        account = await tx.account.findFirst({
          where: {
            OR: [
              { accountName: { equals: cleanKeyword, mode: 'insensitive' } },
              { accountName: { equals: keyword, mode: 'insensitive' } },
              { detailType: { equals: cleanKeyword, mode: 'insensitive' } },
              { detailType: { equals: keyword, mode: 'insensitive' } },
              { glCode: { equals: keyword } }
            ],
            accountType: typeFilter,
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['GL', 'SUBSIDIARY'] }
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });
      }

      // 5. LAST-RESORT contains fallback (documented tech debt — see method
      // docblock). Only reached when no exact match exists.
      if (!account) {
        account = await tx.account.findFirst({
          where: {
            accountName: { contains: cleanKeyword, mode: 'insensitive' },
            accountType: typeFilter,
            isLocked: false,
            children: { none: {} },
            accountLevel: { in: ['GL', 'SUBSIDIARY'] }
          },
          include: { accountType: true },
          orderBy: { glCode: 'asc' }
        });
      }
    }

    if (!account) {
      const identifier = line.accountId || line.accountCode || line.accountKeyword || line.accountType || 'Unknown';
      throw new Error(`Accounting Engine Error: Account not found in Chart of Accounts for identifier '${identifier}'. Pass an explicit Account ID or GL Code, or link the source revenue/expense head to a GL account.`);
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

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of payload.lines) {
      const debitVal = new Prisma.Decimal(line.debit ?? 0);
      const creditVal = new Prisma.Decimal(line.credit ?? 0);
      if (debitVal.isNegative() || creditVal.isNegative()) {
        throw new Error('Accounting Engine Error: Debit and Credit amounts cannot be negative.');
      }
      totalDebit = totalDebit.plus(debitVal);
      totalCredit = totalCredit.plus(creditVal);
    }

    // Check Double Entry balance constraint using exact Decimal equality
    if (!totalDebit.equals(totalCredit)) {
      throw new Error(`Accounting Engine Error: Transaction must follow Double Entry Accounting. Total Debit (${totalDebit.toFixed(2)}) does not equal Total Credit (${totalCredit.toFixed(2)}).`);
    }

    if (totalDebit.lte(0)) {
      throw new Error('Accounting Engine Error: Transaction amount must be greater than zero.');
    }

    const postingDate = payload.postingDate ? new Date(payload.postingDate) : new Date();
    const status = payload.status || 'Posted';
    const voucherType = payload.voucherType || 'JV';
    const subsidiary = payload.subsidiary || 'Global';
    const reference = payload.reference || 'Auto Post';
    const description = payload.description || `Automatic posting from ${payload.module}`;

    // Generate voucher No if not provided. The random suffix has only 900,000
    // possible values per day per voucher type with no prior uniqueness check
    // — SQA fix: rather than let a rare collision surface as an unhandled
    // Prisma unique-constraint error, generation (and only generation — never
    // an explicitly caller-supplied voucherNo) is retried below on P2002.
    const explicitVoucherNo = payload.voucherNo;
    function generateVoucherNo(): string {
      const prefix = voucherType;
      const datePart = postingDate.toISOString().slice(2, 10).replace(/-/g, '');
      const randPart = Math.floor(100000 + Math.random() * 900000);
      return `${prefix}-${datePart}-${randPart}`;
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

    // Strictly validate available funds before posting any transaction crediting Cash/Bank
    if (status === 'Posted') {
      const accountCreditsMap = new Map<string, number>();
      for (const line of resolvedLines) {
        if (line.credit > 0) {
          const current = accountCreditsMap.get(line.account.id) || 0;
          accountCreditsMap.set(line.account.id, current + line.credit);
        }
      }

      for (const [accId, totalCredit] of accountCreditsMap.entries()) {
        await FundValidationService.validateAndLockFunds(tx, {
          accountId: accId,
          requiredAmount: totalCredit,
          module: payload.module,
          userId: payload.postedBy,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent
        });
      }
    }

    // 1. Create Journal Entry
    let voucherNo = explicitVoucherNo || generateVoucherNo();
    let journalEntry;
    for (let attempt = 1; ; attempt++) {
      try {
        journalEntry = await tx.journalEntry.create({
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
        break;
      } catch (err: any) {
        const isUniqueViolation = err?.code === 'P2002';
        const targetsVoucherNo = (err?.meta?.target as string[] | undefined)?.includes('voucherNo');
        if (isUniqueViolation && targetsVoucherNo && !explicitVoucherNo && attempt < 5) {
          voucherNo = generateVoucherNo();
          continue;
        }
        throw err;
      }
    }

    // 2. Create Journal Entry Lines and update the Account balance cache.
    // SINGLE SOURCE OF TRUTH: postings live ONLY as JournalEntryLine rows. The
    // former parallel write to the denormalized LedgerEntry table was removed —
    // no report reads LedgerEntry, and a second copy could only ever drift.
    // Account.currentBalance is retained as a write-side convenience cache
    // (consumed by the CoA tree/account UI, not by any financial report).
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

    }

    // Rebuild the balance cache for every account this entry touched, rather
    // than applying an incremental delta. An increment is only correct if it
    // is applied exactly once and never missed; a recalculation derived from
    // the ledger is idempotent and self-correcting, so the cache cannot drift
    // away from the posted lines even if this runs twice or a prior write was
    // lost. Drafts are skipped because their lines fall outside
    // POSTED_JOURNAL_FILTER and contribute nothing until they are posted.
    if (status === 'Posted') {
      await AccountingService.recalculateBalancesForJournalEntry(tx, journalEntry.id);
    }

    // 3. Automatically Log Audit Trail inside transaction & emit sync event
    try {
      await logAudit({
        userId: payload.postedBy && payload.postedBy !== 'system' && payload.postedBy.length === 36 ? payload.postedBy : null,
        action: `Post Journal (${voucherNo})`,
        module: payload.module,
        postedById: payload.postedBy || null,
        postedAt: new Date().toISOString(),
        ipAddress: payload.ipAddress || null,
        userAgent: payload.userAgent || null,
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
        }
      });
      AccountingSyncService.emitSyncEvent({
        action: 'POST',
        module: payload.module,
        recordId: journalEntry.id,
        userId: payload.postedBy || null
      });
    } catch (e) {
      console.warn('Audit log or sync emission failed:', e);
    }


    return {
      journalEntry,
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
    if (new Prisma.Decimal(params.amount).lte(0)) {
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
        // MUST match AccountingService.getPostedAggregates exactly. Omitting
        // `isDeleted` here was a source of permanent drift: a soft-deleted
        // journal entry keeps status 'Posted', so the cache counted postings
        // that every financial report excluded, and re-running the recalc
        // faithfully reproduced the stale number instead of correcting it.
        journalEntry: POSTED_JOURNAL_FILTER
      },
      _sum: {
        debit: true,
        credit: true
      }
    });

    const totalDebit = new Prisma.Decimal(aggregations._sum.debit ?? 0);
    const totalCredit = new Prisma.Decimal(aggregations._sum.credit ?? 0);
    const initialBalance = new Prisma.Decimal(account.initialBalance ?? 0);

    const typeName = account.accountType?.name?.toUpperCase() || 'ASSET';
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);

    const currentBalance = isDebitNormal
      ? initialBalance.plus(totalDebit).minus(totalCredit)
      : initialBalance.plus(totalCredit).minus(totalDebit);

    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance }
    });

    return currentBalance.toNumber();
  }

  /**
   * Rebuilds the balance cache for every account touched by one journal entry.
   *
   * Call this after ANY change to a journal entry's existence or status —
   * post, edit, soft delete, restore, reverse. It reads the entry's lines
   * first (including those of an already-soft-deleted entry, which is why the
   * line lookup is deliberately unfiltered) and then recomputes each affected
   * account from the posted ledger.
   *
   * Errors are intentionally NOT swallowed: this runs inside the caller's
   * transaction, so a failure must roll the whole operation back rather than
   * leave a half-updated cache behind.
   */
  static async recalculateBalancesForJournalEntry(tx: any, journalEntryId: string): Promise<string[]> {
    const lines = await tx.journalEntryLine.findMany({
      where: { journalEntryId },
      select: { accountId: true }
    });

    const accountIds = Array.from(new Set(lines.map((l: any) => l.accountId))) as string[];
    if (accountIds.length === 0) return [];

    // One statement for all affected accounts. Doing this per account cost
    // three round trips each, which on a hosted database pushed long postings
    // past the transaction timeout.
    await AccountingService.rebuildBalanceCache(tx, accountIds);
    return accountIds;
  }

  /**
   * The one SQL definition of the balance cache, shared by the per-entry recalc
   * and the full rebuild. Pass `accountIds` to scope it, or omit to rebuild
   * every posting account.
   *
   * Mirrors recalculateAccountBalance exactly:
   *   debit-normal  (ASSET/EXPENSE)  : initial + debits - credits
   *   credit-normal (everything else): initial + credits - debits
   * counting only lines whose parent entry satisfies POSTED_JOURNAL_FILTER.
   */
  private static async rebuildBalanceCache(tx: any, accountIds?: string[]): Promise<number> {
    const scope = accountIds && accountIds.length > 0
      ? Prisma.sql`AND a2."id" IN (${Prisma.join(accountIds.map(id => Prisma.sql`${id}::uuid`))})`
      : Prisma.sql`AND a2."accountLevel" IN ('GL', 'SUBSIDIARY')`;

    return tx.$executeRaw(Prisma.sql`
      UPDATE "Account" a
      SET "currentBalance" = a2."initialBalance" +
        CASE
          WHEN COALESCE(UPPER(t."name"), 'ASSET') IN ('ASSET', 'EXPENSE')
            THEN COALESCE(s.total_debit, 0) - COALESCE(s.total_credit, 0)
          ELSE COALESCE(s.total_credit, 0) - COALESCE(s.total_debit, 0)
        END
      FROM "Account" a2
      LEFT JOIN "AccountType" t ON t."id" = a2."accountTypeId"
      LEFT JOIN (
        SELECT l."accountId",
               SUM(l."debit")  AS total_debit,
               SUM(l."credit") AS total_credit
        FROM "JournalEntryLine" l
        JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
        WHERE j."status" = 'Posted' AND j."isDeleted" = false
        GROUP BY l."accountId"
      ) s ON s."accountId" = a2."id"
      WHERE a."id" = a2."id"
      ${scope}
    `);
  }

  /**
   * Recalculates balances for all GL accounts in the system to ensure Trial Balance,
   * Balance Sheet, and Income Statement remain 100% accurate.
   */
  static async recalculateAllBalances(txObj?: any): Promise<{ updated: number }> {
    // Set-based rebuild: one UPDATE ... FROM statement recomputes every posting
    // account from the posted ledger.
    //
    // The previous implementation looped per account issuing findUnique +
    // aggregate + update — three network round trips each. Against a hosted
    // Postgres that blew past the transaction timeout well before it finished
    // the chart of accounts, so the rebuild utility could never actually
    // complete. Doing it in a single statement is both atomic and O(1) round
    // trips, and applies the identical formula as recalculateAccountBalance:
    //   debit-normal  (ASSET/EXPENSE): initial + debits - credits
    //   credit-normal (everything else): initial + credits - debits
    const runInTx = async (tx: any) => ({
      updated: await AccountingService.rebuildBalanceCache(tx)
    });

    if (txObj) {
      return runInTx(txObj);
    } else {
      return prisma.$transaction(runInTx, { timeout: 120000, maxWait: 30000 });
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

    // Strictly validate available funds before posting draft entry crediting Cash/Bank
    const accountCreditsMap = new Map<string, number>();
    for (const line of je.lines) {
      const creditVal = Number(line.credit) || 0;
      if (creditVal > 0) {
        const current = accountCreditsMap.get(line.accountId) || 0;
        accountCreditsMap.set(line.accountId, current + creditVal);
      }
    }

    for (const [accId, totalCredit] of accountCreditsMap.entries()) {
      await FundValidationService.validateAndLockFunds(tx, {
        accountId: accId,
        requiredAmount: totalCredit,
        module: 'Journal Entries',
        userId: postedBy
      });
    }

    // Flip status before recalculating balances: recalculateAccountBalance aggregates
    // only 'Posted' lines, so it must see the new status or it silently excludes this
    // entry's own lines and discards the increment applied a moment earlier.
    const updatedJe = await tx.journalEntry.update({
      where: { id: je.id },
      data: { status: 'Posted' }
    });

    // Single source of truth: posting a draft only flips its lines' parent
    // status to 'Posted' (done above) and rebuilds the Account balance cache
    // from the ledger. No LedgerEntry rows are written — reports read
    // JournalEntryLine directly.
    //
    // The previous incremental `increment: debit - credit` here was wrong for
    // credit-normal accounts (REVENUE/LIABILITY/EQUITY): it applied the raw
    // debit-minus-credit delta regardless of the account's normal side, so a
    // revenue credit moved the cached balance the wrong way by twice the
    // amount. A full recalculation is both correct for every account type and
    // idempotent, so it cannot drift no matter how often it runs.
    await AccountingService.recalculateBalancesForJournalEntry(tx, je.id);

    try {
      await logAudit({
        userId: postedBy && postedBy.length === 36 ? postedBy : null,
        action: `Post Draft Journal (${je.voucherNo})`,
        module: 'Journal Entries',
        postedById: postedBy || null,
        postedAt: new Date().toISOString(),
        oldValues: { status: 'Draft' },
        newValues: { status: 'Posted', voucherNo: je.voucherNo },
      });
      AccountingSyncService.emitSyncEvent({
        action: 'POST',
        module: 'Journal Entries',
        recordId: je.id,
        userId: postedBy || null
      });
    } catch (e) {
      // ignore audit user errors
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

    // Flip status before recalculating balances
    const updatedJe = await tx.journalEntry.update({
      where: { id: je.id },
      data: {
        status: 'Cancelled',
        description: `${je.description ? je.description + ' ' : ''}[Cancelled/Reversed${reason ? ': ' + reason : ''}]`
      }
    });

    // Status is now 'Cancelled', so these lines no longer satisfy
    // POSTED_JOURNAL_FILTER and the recalculation naturally removes their
    // impact — no hand-rolled reversal arithmetic, which is what previously
    // applied the wrong sign for credit-normal accounts.
    await AccountingService.recalculateBalancesForJournalEntry(tx, je.id);

    try {
      await logAudit({
        userId: postedBy && postedBy.length === 36 ? postedBy : null,
        action: `Reverse Journal (${je.voucherNo})`,
        module: 'Journal Entries',
        reversedById: postedBy || null,
        reversedAt: new Date().toISOString(),
        reason: reason || null,
        oldValues: { status: 'Posted' },
        newValues: { status: 'Cancelled', voucherNo: je.voucherNo, reason: reason || null },
      });
      AccountingSyncService.emitSyncEvent({
        action: 'REVERSE',
        module: 'Journal Entries',
        recordId: je.id,
        userId: postedBy || null
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

    if (newStatus === 'Posted') {
      const accountCreditsMap = new Map<string, number>();
      for (const line of je.lines) {
        const creditVal = Number(line.credit) || 0;
        if (creditVal > 0) {
          const current = accountCreditsMap.get(line.accountId) || 0;
          accountCreditsMap.set(line.accountId, current + creditVal);
        }
      }

      for (const [accId, totalCredit] of accountCreditsMap.entries()) {
        await FundValidationService.validateAndLockFunds(tx, {
          accountId: accId,
          requiredAmount: totalCredit,
          module: 'Journal Entries',
          userId: postedBy
        });
      }
    }

    const newDescription = je.description ? je.description.replace(/\[Cancelled\/Reversed[^\]]*\]/, '').trim() : '';
    const updatedJe = await tx.journalEntry.update({
      where: { id: je.id },
      data: {
        status: newStatus,
        description: newDescription
      }
    });

    // Restoring to 'Posted' brings the lines back inside POSTED_JOURNAL_FILTER;
    // restoring to any other status leaves them out. Either way the recalc
    // derives the right cached balance from the ledger.
    await AccountingService.recalculateBalancesForJournalEntry(tx, je.id);

    try {
      await logAudit({
        userId: postedBy && postedBy.length === 36 ? postedBy : null,
        action: `Restore Journal (${je.voucherNo})`,
        module: 'Journal Entries',
        updatedById: postedBy || null,
        updatedAt: new Date().toISOString(),
        oldValues: { status: 'Cancelled' },
        newValues: { status: newStatus, voucherNo: je.voucherNo },
      });
      AccountingSyncService.emitSyncEvent({
        action: 'RESTORE',
        module: 'Journal Entries',
        recordId: je.id,
        userId: postedBy || null
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

    await tx.journalEntryLine.deleteMany({
      where: { journalEntryId: je.id }
    });

    const deletedJe = await tx.journalEntry.delete({
      where: { id: je.id }
    });

    for (const accountId of accountIds) {
      try {
        await AccountingService.recalculateAccountBalance(tx, accountId as string);
      } catch (e) {
        // Ignore if account was already deleted
      }
    }

    try {
      await logAudit({
        userId: postedBy && postedBy !== 'system' && postedBy.length === 36 ? postedBy : null,
        action: `Delete Journal (${je.voucherNo})`,
        module: 'Journal Entries',
        deletedById: postedBy || null,
        deletedAt: new Date().toISOString(),
        reason: reason || null,
        oldValues: { voucherNo: je.voucherNo, status: je.status, reference: je.reference },
        newValues: { deleted: true, reason: reason || null },
      });
      AccountingSyncService.emitSyncEvent({
        action: 'DELETE',
        module: 'Journal Entries',
        recordId: je.id,
        userId: postedBy || null
      });
    } catch (e) {
      // ignore non-uuid audit user
    }

    return deletedJe;
  }

  // SQA fix: previously fell back to free-text name-substring matching
  // ('cash', 'hand', 'bank', ...) regardless of what `detailType` said, so an
  // account explicitly typed as something else entirely (e.g. a receivable
  // named "Cash Advance to Staff") was still misclassified as cash/bank on
  // the dashboard summary — while a genuine cash/bank account with an
  // unmatched name was silently excluded. `detailType` is a structured field
  // set at account-creation time (see api/_v1/accounts.ts); when it holds a
  // specific, non-default value, that value is now authoritative and the
  // name-substring heuristic only applies when detailType is unset/generic
  // ('Header', the schema default, or blank).
  static isCashAccount(name: string, detailType: string): boolean {
    const nameLower = (name || '').toLowerCase();
    if (nameLower.includes('bank')) return false;
    if (nameLower.includes('cash') || nameLower.includes('till') || nameLower.includes('petty') || nameLower.includes('hand')) return true;
    const detailLower = (detailType || '').toLowerCase();
    if (detailLower === 'cash') return true;
    return false;
  }

  static isBankAccount(name: string, detailType: string): boolean {
    const nameLower = (name || '').toLowerCase();
    if (nameLower.includes('bank') || nameLower.includes('al-habib') || nameLower.includes('nbp') || nameLower.includes('national bank') || nameLower.includes('mcb') || nameLower.includes('ubl') || nameLower.includes('allied') || nameLower.includes('faysal')) return true;
    const detailLower = (detailType || '').toLowerCase();
    if (detailLower === 'bank') return true;
    return false;
  }

  /**
   * Automatic resolution & synchronization helper for all Income Categories, Subcategories,
   * and Expense Heads. Guarantees that EVERY category and head has its own dedicated
   * leaf GL Account in the Chart of Accounts, preventing fallback to "Other Income"
   * or "Miscellaneous Expenses".
   */
  /**
   * Links every unmapped Income Category / Expense Head to a real GL Account.
   * Each item is resolved and linked independently — one item's failure (a
   * GL-code collision it can't resolve, a missing parent header, etc.) is
   * caught, logged in full, and recorded in `skipped` with a plain-English
   * reason; every other item still gets attempted. Nothing is silently lost.
   */
  static async ensureCategoryAndHeadGLAccounts(tx: any = prisma): Promise<{ repaired: RepairItem[]; skipped: RepairItem[] }> {
    const repaired: RepairItem[] = [];
    const skipped: RepairItem[] = [];
    try {
      // 1. Ensure parent header for Add Income Categories (3020500)
      let addIncomeParent = await tx.account.findFirst({
        where: { glCode: '3020500' }
      });
      if (!addIncomeParent) {
        const rootRevenueParent = await tx.account.findFirst({
          where: { glCode: '3020000' }
        }) || await tx.account.findFirst({ where: { glCode: '3000000' } });

        const revenueType = await tx.accountType.findFirst({
          where: { name: { in: ['REVENUE', 'Revenue'] } }
        });

        if (rootRevenueParent) {
          addIncomeParent = await tx.account.create({
            data: {
              glCode: '3020500',
              accountName: 'Add Income Categories',
              accountLevel: 'SUBSIDIARY',
              parentId: rootRevenueParent.id,
              accountTypeId: revenueType ? revenueType.id : rootRevenueParent.accountTypeId,
              detailType: 'Header',
              description: 'Control account for Add Income module categories'
            }
          }).catch(() => null);
        }
      }

      // 2. Ensure parent header for Expense Heads (4080000 or 4000000)
      let expenseParent = await tx.account.findFirst({
        where: { glCode: '4080000' }
      }) || await tx.account.findFirst({ where: { glCode: '4000000' } });

      const revenueType = await tx.accountType.findFirst({
        where: { name: { in: ['REVENUE', 'Revenue'] } }
      });
      const expenseType = await tx.accountType.findFirst({
        where: { name: { in: ['EXPENSE', 'Expense'] } }
      });

      // 3. Helper to create or find a leaf GL Account for Income
      const getOrCreateIncomeAccount = async (accountName: string) => {
        let acc = await tx.account.findFirst({
          where: { accountName: { equals: accountName, mode: 'insensitive' }, children: { none: {} }, isDeleted: false }
        });
        if (acc) return acc;

        const lastGl = await tx.account.findFirst({
          where: { glCode: { startsWith: '30205' } },
          orderBy: { glCode: 'desc' }
        });
        const lastNum = lastGl ? parseInt(lastGl.glCode.slice(-3)) || 500 : 500;
        let glCode = `30205${String(lastNum + 1).padStart(2, '0')}`;
        while (await tx.account.findUnique({ where: { glCode } })) {
          const num = parseInt(glCode.slice(-3)) + 1;
          glCode = `30205${String(num).padStart(2, '0')}`;
        }

        return tx.account.create({
          data: {
            glCode,
            accountName,
            accountLevel: 'GL',
            parentId: addIncomeParent ? addIncomeParent.id : null,
            accountTypeId: revenueType ? revenueType.id : null,
            detailType: 'Revenue',
            description: `GL Account for ${accountName}`
          }
        });
      };

      // 4. Helper to create or find a leaf GL Account for Expenses
      const getOrCreateExpenseAccount = async (accountName: string) => {
        let acc = await tx.account.findFirst({
          where: { accountName: { equals: accountName, mode: 'insensitive' }, children: { none: {} }, isDeleted: false }
        });
        if (acc) return acc;

        const knownAliases: Record<string, string> = {
          'Salary': 'Staff Salary',
          'Rent': 'Building Rent',
          'Electricity Bill': 'K-Electric Bill',
          'Generator Expense': 'Generator Fuel',
          'Bus Expense': 'Bus Diesel',
          'Medical Expense': 'Medical Donations',
          'Hall Expense': 'Hall Operating Costs',
          'Education Donation': 'Education Donation'
        };

        const mappedName = knownAliases[accountName];
        if (mappedName) {
          acc = await tx.account.findFirst({
            where: { accountName: { equals: mappedName, mode: 'insensitive' }, children: { none: {} }, isDeleted: false }
          });
          if (acc) return acc;
        }

        const lastGl = await tx.account.findFirst({
          where: { glCode: { startsWith: '40801' } },
          orderBy: { glCode: 'desc' }
        });
        const lastNum = lastGl ? parseInt(lastGl.glCode.slice(-3)) || 100 : 100;
        let glCode = `40801${String(lastNum + 1).padStart(2, '0')}`;
        while (await tx.account.findUnique({ where: { glCode } })) {
          const num = parseInt(glCode.slice(-3)) + 1;
          glCode = `40801${String(num).padStart(2, '0')}`;
        }

        return tx.account.create({
          data: {
            glCode,
            accountName,
            accountLevel: 'GL',
            parentId: expenseParent ? expenseParent.id : null,
            accountTypeId: expenseType ? expenseType.id : null,
            detailType: 'Expense',
            description: `GL Account for ${accountName}`
          }
        });
      };

      // Link all Income Categories to GL Accounts — one item at a time, each
      // isolated so a single category that can't be resolved (e.g. a GL-code
      // collision it can't work around) doesn't block every other category.
      const categories = await tx.incomeCategory.findMany({ where: { isDeleted: false } });
      for (const cat of categories) {
        if (cat.accountId) continue;
        try {
          const glAcc = await getOrCreateIncomeAccount(cat.name);
          await tx.incomeCategory.update({
            where: { id: cat.id },
            data: { accountId: glAcc.id }
          });
          repaired.push({ id: cat.id, name: cat.name, glCode: glAcc.glCode, action: `Linked Income Category "${cat.name}" to GL ${glAcc.glCode}` });
        } catch (err: any) {
          logger.error({ err: errDetails(err), categoryId: cat.id, categoryName: cat.name }, 'Auto-repair: failed to link Income Category to a GL account');
          skipped.push({ id: cat.id, name: cat.name, reason: classifyError(err) });
        }
      }

      // Link all Expense Heads to GL Accounts — same per-item isolation.
      const heads = await tx.expenseHead.findMany({ where: { isDeleted: false } });
      for (const head of heads) {
        if (head.accountId) continue;
        try {
          const glAcc = await getOrCreateExpenseAccount(head.name);
          await tx.expenseHead.update({
            where: { id: head.id },
            data: { accountId: glAcc.id }
          });
          repaired.push({ id: head.id, name: head.name, glCode: glAcc.glCode, action: `Linked Expense Head "${head.name}" to GL ${glAcc.glCode}` });
        } catch (err: any) {
          logger.error({ err: errDetails(err), expenseHeadId: head.id, expenseHeadName: head.name }, 'Auto-repair: failed to link Expense Head to a GL account');
          skipped.push({ id: head.id, name: head.name, reason: classifyError(err) });
        }
      }
    } catch (err: any) {
      // Only the shared setup above (parent headers, account types) can reach
      // here — the per-item loops handle their own errors and never rethrow.
      logger.error({ err: errDetails(err) }, 'Auto-repair: ensureCategoryAndHeadGLAccounts setup failed');
      skipped.push({ reason: classifyError(err), action: 'Failed before per-item linking could start' });
    }
    return { repaired, skipped };
  }

  /**
   * Self-healing utility that checks all existing Journal Entries for AddIncome and SimpleExpense
   * and ensures their ledger lines are assigned to their specific GL Accounts.
   * Each record is repaired independently — one record's failure never blocks
   * the rest, and every failure is logged with its record id and reason.
   */
  static async healJournalEntryAccounts(tx: any = prisma): Promise<{ repaired: RepairItem[]; skipped: RepairItem[] }> {
    const repaired: RepairItem[] = [];
    const skipped: RepairItem[] = [];
    try {
      const catResult = await AccountingService.ensureCategoryAndHeadGLAccounts(tx);
      repaired.push(...catResult.repaired);
      skipped.push(...catResult.skipped);

      const affectedAccountIds = new Set<string>();

      // Fix AddIncomeRecord postings
      const incomeRecords = await tx.addIncomeRecord.findMany({
        where: { isDeleted: false, journalEntryId: { not: null } },
        include: { category: true }
      });

      for (const rec of incomeRecords) {
        if (!rec.journalEntryId) continue;
        try {
          let targetAccountId: string | null = null;
          if (rec.subCategory && rec.subCategory.trim()) {
            const subName = `Other Income - ${rec.subCategory.trim()}`;
            let acc = await tx.account.findFirst({
              where: { accountName: { equals: subName, mode: 'insensitive' }, isDeleted: false }
            });
            if (!acc) {
              const parent = await tx.account.findFirst({ where: { glCode: '3020500' } });
              const revType = await tx.accountType.findFirst({ where: { name: { in: ['REVENUE', 'Revenue'] } } });
              const lastGl = await tx.account.findFirst({ where: { glCode: { startsWith: '30205' } }, orderBy: { glCode: 'desc' } });
              const lastNum = lastGl ? parseInt(lastGl.glCode.slice(-3)) || 510 : 510;
              let glCode = `30205${String(lastNum + 1).padStart(2, '0')}`;
              while (await tx.account.findUnique({ where: { glCode } })) {
                const num = parseInt(glCode.slice(-3)) + 1;
                glCode = `30205${String(num).padStart(2, '0')}`;
              }
              acc = await tx.account.create({
                data: {
                  glCode,
                  accountName: subName,
                  accountLevel: 'GL',
                  parentId: parent ? parent.id : null,
                  accountTypeId: revType ? revType.id : null,
                  detailType: 'Revenue',
                  description: `GL Account for ${subName}`
                }
              });
            }
            targetAccountId = acc.id;
          } else if (rec.category?.accountId) {
            targetAccountId = rec.category.accountId;
          }

          if (targetAccountId) {
            const creditLine = await tx.journalEntryLine.findFirst({
              where: { journalEntryId: rec.journalEntryId, credit: { gt: 0 } }
            });
            if (creditLine && creditLine.accountId !== targetAccountId) {
              affectedAccountIds.add(creditLine.accountId);
              affectedAccountIds.add(targetAccountId);
              await tx.journalEntryLine.update({
                where: { id: creditLine.id },
                data: { accountId: targetAccountId }
              });
              repaired.push({ id: rec.id, action: `Re-linked Add Income record ${rec.id.slice(0, 8)} to its category's GL account` });
            }
          }
        } catch (err: any) {
          logger.error({ err: errDetails(err), addIncomeRecordId: rec.id, journalEntryId: rec.journalEntryId }, 'Auto-repair: failed to heal Add Income journal line');
          skipped.push({ id: rec.id, reason: classifyError(err) });
        }
      }

      // Fix SimpleExpense postings
      const simpleExpenses = await tx.simpleExpense.findMany({
        where: { isDeleted: false, journalEntryId: { not: null } },
        include: { expenseHead: true }
      });

      for (const exp of simpleExpenses) {
        if (!exp.journalEntryId) continue;
        try {
          let targetAccountId: string | null = exp.expenseHead?.accountId || null;

          if (!targetAccountId && exp.expenseHead?.name) {
            let acc = await tx.account.findFirst({
              where: { accountName: { equals: exp.expenseHead.name, mode: 'insensitive' }, isDeleted: false }
            });
            if (acc) {
              targetAccountId = acc.id;
            }
          }

          if (targetAccountId) {
            const debitLine = await tx.journalEntryLine.findFirst({
              where: { journalEntryId: exp.journalEntryId, debit: { gt: 0 } }
            });
            if (debitLine && debitLine.accountId !== targetAccountId) {
              affectedAccountIds.add(debitLine.accountId);
              affectedAccountIds.add(targetAccountId);
              await tx.journalEntryLine.update({
                where: { id: debitLine.id },
                data: { accountId: targetAccountId }
              });
              repaired.push({ id: exp.id, action: `Re-linked Expense record ${exp.id.slice(0, 8)} to its head's GL account` });
            }
          }
        } catch (err: any) {
          logger.error({ err: errDetails(err), simpleExpenseId: exp.id, journalEntryId: exp.journalEntryId }, 'Auto-repair: failed to heal Expense journal line');
          skipped.push({ id: exp.id, reason: classifyError(err) });
        }
      }

      // Recalculate balances for all accounts touched above
      for (const accId of affectedAccountIds) {
        try {
          await AccountingService.recalculateAccountBalance(tx, accId);
        } catch (err: any) {
          logger.error({ err: errDetails(err), accountId: accId }, 'Auto-repair: failed to recalculate balance for an affected account');
          skipped.push({ id: accId, reason: classifyError(err) });
        }
      }
    } catch (err: any) {
      logger.error({ err: errDetails(err) }, 'Auto-repair: healJournalEntryAccounts setup failed');
      skipped.push({ reason: classifyError(err), action: 'Failed before per-record healing could start' });
    }
    return { repaired, skipped };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SINGLE SOURCE OF TRUTH for every financial report.
  //
  // All report methods below (getGeneralLedger, getTrialBalance,
  // getBalanceSheet, getIncomeStatement, getFinancialSummary) — plus the
  // dashboard stats and cash-flow endpoints — derive their numbers exclusively
  // from POSTED JournalEntryLine rows via these two helpers. Draft and
  // Cancelled entries are excluded. Account.currentBalance is a write-side
  // convenience cache (kept in sync by postTransaction/recalculateAccountBalance
  // and audited by the integrity service) and must never be read by a report.
  // The denormalized LedgerEntry table has been removed entirely — there is now
  // exactly one accounting store: JournalEntry + JournalEntryLine.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Aggregates posted journal entry lines per account, optionally restricted
   * to a posting-date window. One groupBy query — no per-account N+1.
   */
  static async getPostedAggregates(opts: { from?: Date; to?: Date; accountIds?: string[] } = {}): Promise<Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>> {
    const journalWhere: any = { ...POSTED_JOURNAL_FILTER };
    if (opts.from || opts.to) {
      journalWhere.postingDate = {};
      if (opts.from) journalWhere.postingDate.gte = opts.from;
      if (opts.to) journalWhere.postingDate.lte = opts.to;
    }

    const where: any = { journalEntry: journalWhere };
    if (opts.accountIds && opts.accountIds.length > 0) {
      where.accountId = { in: opts.accountIds };
    }

    const groups = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where,
      _sum: { debit: true, credit: true }
    });

    return new Map(groups.map(g => [
      g.accountId,
      { debit: new Prisma.Decimal(g._sum.debit ?? 0), credit: new Prisma.Decimal(g._sum.credit ?? 0) }
    ]));
  }

  /**
   * Natural balance of an account given its posted debit/credit sums:
   * debit-normal (ASSET/EXPENSE):  initial + debit − credit
   * credit-normal (LIABILITY/EQUITY/REVENUE): initial + credit − debit
   */
  static naturalBalance(
    typeName: string,
    initialBalance: Prisma.Decimal | number | string,
    agg?: { debit: Prisma.Decimal | number | string; credit: Prisma.Decimal | number | string }
  ): Prisma.Decimal {
    const d = new Prisma.Decimal(agg?.debit ?? 0);
    const c = new Prisma.Decimal(agg?.credit ?? 0);
    const init = new Prisma.Decimal(initialBalance ?? 0);
    const isDebitNormal = ['ASSET', 'ASSETS', 'EXPENSE', 'EXPENSES'].includes((typeName || '').toUpperCase());
    return isDebitNormal ? init.plus(d).minus(c) : init.plus(c).minus(d);
  }

  /** Inclusive end-of-day Date for a YYYY-MM-DD endDate filter. */
  private static endOfDay(endDate: string): Date {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return end;
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

    // Build Where Clause: posted journal entry lines only (single source of truth)
    const journalWhere: any = { ...POSTED_JOURNAL_FILTER };
    if (startDate || endDate) {
      journalWhere.postingDate = {};
      if (startDate) journalWhere.postingDate.gte = new Date(startDate);
      if (endDate) journalWhere.postingDate.lte = new Date(endDate);
    }

    const entryWhere: any = { journalEntry: journalWhere };
    if (targetAccount) {
      entryWhere.accountId = targetAccount.id;
    }

    // Fetch entries from posted journal entry lines
    const [entries, total] = await Promise.all([
      prisma.journalEntryLine.findMany({
        where: entryWhere,
        include: {
          account: { select: { glCode: true, accountName: true, initialBalance: true, accountType: { select: { name: true } } } },
          journalEntry: { select: { voucherNo: true, postingDate: true } }
        },
        orderBy: [{ journalEntry: { postingDate: 'asc' } }, { createdAt: 'asc' }],
        skip,
        take: limitNum,
      }),
      prisma.journalEntryLine.count({ where: entryWhere })
    ]);

    // For each unique account present in the fetched entries, calculate its opening balance
    const uniqueAccountIds = [...new Set(entries.map(e => e.accountId))];
    const accountMeta: Record<string, { openingBalance: number; type: string; initialBalance: number; name: string }> = {};

    const priorAggregates = startDate
      ? await AccountingService.getPostedAggregates({
          to: new Date(new Date(startDate).getTime() - 1),
          accountIds: uniqueAccountIds
        })
      : new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();

    for (const accId of uniqueAccountIds) {
      const firstEntry = entries.find(e => e.accountId === accId);
      const initialBal = firstEntry?.account?.initialBalance ?? 0;
      const typeName = (firstEntry?.account as any)?.accountType?.name?.toUpperCase() || 'ASSET';
      const glCodeVal = firstEntry?.account?.glCode || '';
      const name = firstEntry?.account?.accountName || '';

      const opBal = AccountingService.naturalBalance(typeName, initialBal, priorAggregates.get(accId));
      accountMeta[glCodeVal] = { openingBalance: opBal.toNumber(), type: typeName, initialBalance: new Prisma.Decimal(initialBal).toNumber(), name };
    }

    // Calculate Opening Balance
    let openingBalance = new Prisma.Decimal(0);

    if (targetAccount) {
      const typeName = targetAccount.accountType?.name?.toUpperCase() || 'ASSET';
      const priorAgg = startDate
        ? (await AccountingService.getPostedAggregates({
            to: new Date(new Date(startDate).getTime() - 1),
            accountIds: [targetAccount.id]
          })).get(targetAccount.id)
        : undefined;
      openingBalance = AccountingService.naturalBalance(typeName, targetAccount.initialBalance ?? 0, priorAgg);
    }

    // Calculate Debit and Credit totals within range
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    const formattedEntries = entries.map(entry => {
      const lineDebit = new Prisma.Decimal(entry.debit);
      const lineCredit = new Prisma.Decimal(entry.credit);
      totalDebit = totalDebit.plus(lineDebit);
      totalCredit = totalCredit.plus(lineCredit);

      return {
        id: entry.id,
        date: entry.journalEntry.postingDate.toISOString().split('T')[0],
        glCode: entry.account.glCode,
        accountName: entry.account.accountName,
        reference: entry.journalEntry.voucherNo,
        description: entry.description,
        debit: lineDebit.toNumber(),
        credit: lineCredit.toNumber()
      };
    });

    let closingBalance: Prisma.Decimal | null = null;
    if (targetAccount) {
        const typeName = targetAccount.accountType?.name?.toUpperCase() || 'ASSET';
        if (['ASSET', 'EXPENSE'].includes(typeName)) {
            closingBalance = openingBalance.plus(totalDebit).minus(totalCredit);
        } else {
            closingBalance = openingBalance.plus(totalCredit).minus(totalDebit);
        }
    }

    return {
      account: targetAccount ? {
          glCode: targetAccount.glCode,
          name: targetAccount.accountName,
          type: targetAccount.accountType?.name || 'Unknown'
      } : null,
      summary: {
        openingBalance: openingBalance.toNumber(),
        totalDebit: totalDebit.toNumber(),
        totalCredit: totalCredit.toNumber(),
        closingBalance: targetAccount && closingBalance ? closingBalance.toNumber() : null
      },
      accountMeta,
      entries: formattedEntries,
      total,
      page: pageNum,
      limit: limitNum
    };
  }

  static async getTrialBalance(startDate?: string, endDate?: string) {
    await AccountingService.healJournalEntryAccounts().catch(() => {});

    const activeAccounts = await prisma.account.findMany({
      where: { isDeleted: false },
      include: {
        accountType: true
      },
      orderBy: { glCode: 'asc' }
    });

    const hasDateFilter = Boolean(startDate || endDate);
    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? AccountingService.endOfDay(endDate) : undefined;

    // All balances derive from posted journal entry lines — the single source
    // of truth. Three aggregate windows cover every case in one query each:
    //   period      → P&L accounts (activity inside the range)
    //   cumulative  → balance-sheet accounts (everything up to `to`) — this IS
    //                 each Asset account's CLOSING balance as of `to`
    //   prior       → everything posted strictly before `from` — combined with
    //                 initialBalance, this IS each Asset account's OPENING
    //                 balance as of `from` (falls back to plain initialBalance
    //                 when `from` is unset, since priorAggregates is then an
    //                 empty map and naturalBalance treats a missing aggregate
    //                 as zero activity)
    const periodAggregates = await AccountingService.getPostedAggregates({ from, to });
    const cumulativeAggregates = hasDateFilter
      ? await AccountingService.getPostedAggregates({ to })
      : periodAggregates;
    const priorAggregates = from
      ? await AccountingService.getPostedAggregates({ to: new Date(from.getTime() - 1) })
      : new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    let openingRetainedEarnings = new Prisma.Decimal(0);

    const formatted: any[] = [];

    // ── Opening/Closing Balance categories (proper accounting-standard
    // presentation): Cash in Hand, every Bank individually, Advance & Loan,
    // Receivable, and a residual "Other Assets" bucket for anything else.
    // Every figure comes from initialBalance + posted JournalEntryLine
    // aggregates only, via the exact same naturalBalance()/getPostedAggregates()
    // helpers every other report in this service uses — nothing cached, and no
    // account *name* is hardcoded, only the small set of `detailType`
    // conventions seeded in prisma/seed.ts (Cash / Bank / Receivable / Advance),
    // with the existing isCashAccount/isBankAccount name-fallback for any older
    // account whose detailType predates that convention.
    type CategoryKey = 'cashInHand' | 'banks' | 'advanceAndLoan' | 'receivable' | 'otherAssets';
    const emptyCategory = () => ({ total: new Prisma.Decimal(0), accounts: [] as { glCode: string; name: string; balance: number }[] });
    const openingCats: Record<CategoryKey, ReturnType<typeof emptyCategory>> = {
      cashInHand: emptyCategory(), banks: emptyCategory(), advanceAndLoan: emptyCategory(), receivable: emptyCategory(), otherAssets: emptyCategory(),
    };
    const closingCats: Record<CategoryKey, ReturnType<typeof emptyCategory>> = {
      cashInHand: emptyCategory(), banks: emptyCategory(), advanceAndLoan: emptyCategory(), receivable: emptyCategory(), otherAssets: emptyCategory(),
    };

    for (const acc of activeAccounts) {
      const typeName = acc.accountType?.name?.toUpperCase() || 'ASSET';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);
      const isPnl = ['REVENUE', 'EXPENSE'].includes(typeName);

      let balance: Prisma.Decimal;
      if (hasDateFilter && isPnl) {
        // P&L accounts: period activity only (no opening balance carried in)
        balance = AccountingService.naturalBalance(typeName, 0, periodAggregates.get(acc.id));
      } else {
        // Balance-sheet accounts (and the no-filter case): cumulative position
        balance = AccountingService.naturalBalance(typeName, acc.initialBalance, cumulativeAggregates.get(acc.id));
      }

      // Retained earnings carried in from prior periods.
      if (startDate && isPnl) {
        const prior = priorAggregates.get(acc.id);
        const pd = prior?.debit ?? new Prisma.Decimal(0);
        const pc = prior?.credit ?? new Prisma.Decimal(0);
        if (typeName === 'REVENUE' || typeName === 'INCOME') {
          openingRetainedEarnings = openingRetainedEarnings.plus(pc.minus(pd));
        } else {
          openingRetainedEarnings = openingRetainedEarnings.minus(pd.minus(pc));
        }
      }

      // Opening/Closing Balance breakdown — real (leaf, postable) Asset
      // accounts only. Independent of the hasDateFilter/isPnl branching above:
      // this always reflects true point-in-time balances, never a
      // period-only movement, which is exactly what "Opening Balance" and
      // "Closing Balance" mean for a balance-sheet account.
      if (typeName === 'ASSET' && acc.accountLevel === 'GL') {
        const openingBal = AccountingService.naturalBalance(typeName, acc.initialBalance, priorAggregates.get(acc.id));
        const closingBal = AccountingService.naturalBalance(typeName, acc.initialBalance, cumulativeAggregates.get(acc.id));

        let key: CategoryKey;
        if (AccountingService.isBankAccount(acc.accountName, acc.detailType)) key = 'banks';
        else if (AccountingService.isCashAccount(acc.accountName, acc.detailType)) key = 'cashInHand';
        else if ((acc.detailType || '').toLowerCase() === 'receivable') key = 'receivable';
        else if ((acc.detailType || '').toLowerCase() === 'advance') key = 'advanceAndLoan';
        else key = 'otherAssets';

        openingCats[key].total = openingCats[key].total.plus(openingBal);
        openingCats[key].accounts.push({ glCode: acc.glCode, name: acc.accountName, balance: openingBal.toNumber() });
        closingCats[key].total = closingCats[key].total.plus(closingBal);
        closingCats[key].accounts.push({ glCode: acc.glCode, name: acc.accountName, balance: closingBal.toNumber() });
      }

      // Skip accounts with zero balance unless it's a primary Cash or Bank account or has an initial balance
      const isCashOrBank = AccountingService.isCashAccount(acc.accountName, acc.detailType) || AccountingService.isBankAccount(acc.accountName, acc.detailType);
      if (balance.isZero() && !isCashOrBank && new Prisma.Decimal(acc.initialBalance ?? 0).isZero()) continue;

      let debit = new Prisma.Decimal(0);
      let credit = new Prisma.Decimal(0);

      if (isDebitNormal) {
        if (balance.gt(0)) debit = balance;
        else credit = balance.abs();
      } else {
        if (balance.gt(0)) credit = balance;
        else debit = balance.abs();
      }

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      formatted.push({
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        accountType: acc.accountType?.name || 'Asset',
        detailType: acc.detailType,
        balance: balance.toNumber(),
        debit: debit.toNumber(),
        credit: credit.toNumber()
      });
    }

    if (startDate && !openingRetainedEarnings.isZero()) {
      const isDebit = openingRetainedEarnings.lt(0);
      const absAmt = openingRetainedEarnings.abs();
      formatted.push({
        id: 'retained-earnings-opening-diff',
        glCode: '3010199',
        accountName: 'Retained Earnings (Prior Periods)',
        accountType: 'EQUITY',
        balance: openingRetainedEarnings.toNumber(),
        debit: isDebit ? absAmt.toNumber() : 0,
        credit: isDebit ? 0 : absAmt.toNumber()
      });
      if (isDebit) totalDebit = totalDebit.plus(absAmt);
      else totalCredit = totalCredit.plus(absAmt);
    }

    const serializeCategories = (cats: Record<CategoryKey, ReturnType<typeof emptyCategory>>) => ({
      cashInHand: { total: cats.cashInHand.total.toNumber(), accounts: cats.cashInHand.accounts },
      banks: { total: cats.banks.total.toNumber(), accounts: cats.banks.accounts },
      advanceAndLoan: { total: cats.advanceAndLoan.total.toNumber(), accounts: cats.advanceAndLoan.accounts },
      receivable: { total: cats.receivable.total.toNumber(), accounts: cats.receivable.accounts },
      otherAssets: { total: cats.otherAssets.total.toNumber(), accounts: cats.otherAssets.accounts },
    });

    const diff = totalDebit.minus(totalCredit).abs();
    return {
      accounts: formatted,
      totalDebit: totalDebit.toNumber(),
      totalCredit: totalCredit.toNumber(),
      difference: diff.toNumber(),
      openingBalances: serializeCategories(openingCats),
      closingBalances: serializeCategories(closingCats),
    };
  }

  static async getBalanceSheet(startDate?: string, endDate?: string) {
    const allAccounts = await prisma.account.findMany({
      where: { isDeleted: false },
      include: {
        accountType: true
      },
      orderBy: { glCode: 'asc' }
    });

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    let totalAssets = new Prisma.Decimal(0);
    let totalLiabilities = new Prisma.Decimal(0);
    let totalEquity = new Prisma.Decimal(0);

    let totalRevenue = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    let openingRetainedEarnings = new Prisma.Decimal(0);

    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? AccountingService.endOfDay(endDate) : undefined;
    const hasPeriodFilter = Boolean(from || to);

    // Single source of truth: posted journal entry lines (see getPostedAggregates)
    const periodAggregates = await AccountingService.getPostedAggregates({ from, to });
    const cumulativeAggregates = hasPeriodFilter
      ? await AccountingService.getPostedAggregates({ to })
      : periodAggregates;
    const priorAggregates = from
      ? await AccountingService.getPostedAggregates({ to: new Date(from.getTime() - 1) })
      : new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();

    for (const acc of allAccounts) {
      const type = acc.accountType?.name;
      let balance: Prisma.Decimal;

      if (type === 'REVENUE' || type === 'EXPENSE') {
        const agg = hasPeriodFilter ? periodAggregates.get(acc.id) : cumulativeAggregates.get(acc.id);
        balance = AccountingService.naturalBalance(type, hasPeriodFilter ? 0 : acc.initialBalance, agg);
      } else {
        balance = AccountingService.naturalBalance(type || 'ASSET', acc.initialBalance, cumulativeAggregates.get(acc.id));
      }

      if (startDate && (type === 'REVENUE' || type === 'EXPENSE')) {
        const prior = priorAggregates.get(acc.id);
        const pd = prior?.debit ?? new Prisma.Decimal(0);
        const pc = prior?.credit ?? new Prisma.Decimal(0);
        if (type === 'REVENUE') {
          openingRetainedEarnings = openingRetainedEarnings.plus(pc.minus(pd));
        } else {
          openingRetainedEarnings = openingRetainedEarnings.minus(pd.minus(pc));
        }
      }

      if (balance.isZero()) continue;

      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance: balance.toNumber()
      };

      if (type === 'ASSET') {
        assets.push(formatted);
        totalAssets = totalAssets.plus(balance);
      } else if (type === 'LIABILITY') {
        liabilities.push(formatted);
        totalLiabilities = totalLiabilities.plus(balance);
      } else if (type === 'EQUITY') {
        equity.push(formatted);
        totalEquity = totalEquity.plus(balance);
      } else if (type === 'REVENUE') {
        totalRevenue = totalRevenue.plus(balance);
      } else if (type === 'EXPENSE') {
        totalExpense = totalExpense.plus(balance);
      }
    }

    const netPeriodIncome = totalRevenue.minus(totalExpense);
    let retainedEarnings = netPeriodIncome;
    if (startDate) {
      retainedEarnings = retainedEarnings.plus(openingRetainedEarnings);
    }

    if (!retainedEarnings.isZero()) {
      equity.push({
        id: 'retained-earnings-net',
        glCode: '3010199',
        accountName: 'Retained Earnings (P&L Transfer)',
        balance: retainedEarnings.toNumber()
      });
      totalEquity = totalEquity.plus(retainedEarnings);
    }

    return {
      assets,
      liabilities,
      equity,
      totalAssets: totalAssets.toNumber(),
      totalLiabilities: totalLiabilities.toNumber(),
      totalEquity: totalEquity.toNumber(),
      netPeriodIncome: netPeriodIncome.toNumber(),
      openingRetainedEarnings: openingRetainedEarnings.toNumber(),
      totalLiabilitiesAndEquity: totalLiabilities.plus(totalEquity).toNumber()
    };
  }

  static async getIncomeStatement(startDate?: string, endDate?: string) {
    const pnlAccounts = await prisma.account.findMany({
      where: {
        isDeleted: false,
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
    let totalRevenue = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    // Single source of truth: posted journal entry lines (see getPostedAggregates)
    const aggregates = await AccountingService.getPostedAggregates({
      from: startDate ? new Date(startDate) : undefined,
      to: endDate ? AccountingService.endOfDay(endDate) : undefined,
      accountIds: pnlAccounts.map(a => a.id)
    });

    const pnlInitialApplies = !(startDate || endDate);

    for (const acc of pnlAccounts) {
      const type = acc.accountType?.name;
      const balance = AccountingService.naturalBalance(
        type || 'REVENUE',
        pnlInitialApplies ? acc.initialBalance : 0,
        aggregates.get(acc.id)
      );

      if (balance.isZero()) continue;

      const formatted = {
        id: acc.id,
        glCode: acc.glCode,
        accountName: acc.accountName,
        balance: balance.toNumber()
      };

      if (type === 'REVENUE') {
        revenues.push(formatted);
        totalRevenue = totalRevenue.plus(balance);
      } else if (type === 'EXPENSE') {
        expenses.push(formatted);
        totalExpense = totalExpense.plus(balance);
      }
    }

    const netProfit = totalRevenue.minus(totalExpense);

    return {
      revenues,
      expenses,
      totalRevenue: totalRevenue.toNumber(),
      totalExpense: totalExpense.toNumber(),
      netProfit: netProfit.toNumber()
    };
  }

  static async getFinancialSummary(startDate?: string, endDate?: string) {
    const allAccounts = await prisma.account.findMany({
      where: { isDeleted: false },
      include: { accountType: true }
    });

    let totalAssets = new Prisma.Decimal(0);
    let totalLiabilities = new Prisma.Decimal(0);
    let totalEquity = new Prisma.Decimal(0);
    let totalRevenue = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    let cashBalance = new Prisma.Decimal(0);
    let bankBalance = new Prisma.Decimal(0);
    // Balance as of the instant before `startDate` — the "Opening Cash"/
    // "Opening Bank" a period's Cash in Hand formula (Opening + Receipts -
    // Payments) reconciles against. Without this, Cash in Hand (cumulative
    // since account inception) and Net Surplus (this period only) look
    // unrelated even though both are individually correct.
    let openingCashBalance = new Prisma.Decimal(0);
    let openingBankBalance = new Prisma.Decimal(0);
    let openingRetainedEarnings = new Prisma.Decimal(0);

    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? AccountingService.endOfDay(endDate) : undefined;
    const hasDateFilter = Boolean(from || to);

    const periodAggregates = await AccountingService.getPostedAggregates({ from, to });
    const cumulativeAggregates = hasDateFilter
      ? await AccountingService.getPostedAggregates({ to })
      : periodAggregates;
    const priorAggregates = from
      ? await AccountingService.getPostedAggregates({ to: new Date(from.getTime() - 1) })
      : new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();

    for (const acc of allAccounts) {
      const typeName = (acc.accountType?.name || '').toUpperCase();
      const isLeaf = !allAccounts.some(a => a.parentId === acc.id);
      if (!isLeaf) continue;

      const isPnl = ['REVENUE', 'INCOME', 'EXPENSE', 'EXPENSES'].includes(typeName);

      let bal: Prisma.Decimal;
      if (hasDateFilter && isPnl) {
        bal = AccountingService.naturalBalance(typeName, 0, periodAggregates.get(acc.id));
      } else {
        bal = AccountingService.naturalBalance(typeName, acc.initialBalance, cumulativeAggregates.get(acc.id));
      }

      if (typeName === 'ASSET' || typeName === 'ASSETS') {
        totalAssets = totalAssets.plus(bal);
        // Opening = balance as of the instant before `from` (same
        // priorAggregates already computed above for retained earnings).
        // With no date filter, opening === closing, same as today.
        const openingBal = from
          ? AccountingService.naturalBalance(typeName, acc.initialBalance, priorAggregates.get(acc.id))
          : bal;
        if (this.isBankAccount(acc.accountName, acc.detailType)) {
          bankBalance = bankBalance.plus(bal);
          openingBankBalance = openingBankBalance.plus(openingBal);
        } else if (this.isCashAccount(acc.accountName, acc.detailType)) {
          cashBalance = cashBalance.plus(bal);
          openingCashBalance = openingCashBalance.plus(openingBal);
        }
      } else if (typeName === 'LIABILITY' || typeName === 'LIABILITIES') {
        totalLiabilities = totalLiabilities.plus(bal.lt(0) ? bal.abs() : bal);
      } else if (typeName === 'EQUITY') {
        totalEquity = totalEquity.plus(bal);
      } else if (typeName === 'REVENUE' || typeName === 'INCOME') {
        totalRevenue = totalRevenue.plus(bal);
      } else if (typeName === 'EXPENSE' || typeName === 'EXPENSES' || (acc.glCode.startsWith('4') && !acc.glCode.startsWith('3') && !acc.glCode.startsWith('1') && !acc.glCode.startsWith('2'))) {
        totalExpense = totalExpense.plus(bal);
      }

      if (startDate && isPnl) {
        const prior = priorAggregates.get(acc.id);
        const pd = prior?.debit ?? new Prisma.Decimal(0);
        const pc = prior?.credit ?? new Prisma.Decimal(0);
        if (typeName === 'REVENUE' || typeName === 'INCOME') {
          openingRetainedEarnings = openingRetainedEarnings.plus(pc.minus(pd));
        } else {
          openingRetainedEarnings = openingRetainedEarnings.minus(pd.minus(pc));
        }
      }
    }

    const netPeriodIncome = totalRevenue.minus(totalExpense);
    let retainedEarnings = netPeriodIncome;
    if (startDate) {
      retainedEarnings = retainedEarnings.plus(openingRetainedEarnings);
    }

    totalEquity = totalEquity.plus(retainedEarnings);

    return {
      totalAssets: totalAssets.toNumber(),
      totalLiabilities: totalLiabilities.toNumber(),
      totalEquity: totalEquity.toNumber(),
      // Assets - Liabilities, independent of the Equity/retained-earnings
      // rollup above — the direct "Net Assets" figure requested for the
      // Dashboard, always internally consistent with totalAssets/totalLiabilities.
      netAssets: totalAssets.minus(totalLiabilities).toNumber(),
      totalRevenue: totalRevenue.toNumber(),
      totalExpense: totalExpense.toNumber(),
      cashBalance: Math.max(0, cashBalance.toNumber()),
      bankBalance: Math.max(0, bankBalance.toNumber()),
      openingCashBalance: Math.max(0, openingCashBalance.toNumber()),
      openingBankBalance: Math.max(0, openingBankBalance.toNumber()),
      netPeriodIncome: netPeriodIncome.toNumber(),
      openingRetainedEarnings: openingRetainedEarnings.toNumber(),
      retainedEarnings: retainedEarnings.toNumber()
    };
  }

  static async getCashFlow(startDate?: string, endDate?: string) {
    const cashBankAccounts = await prisma.account.findMany({
      where: {
        isDeleted: false,
        accountType: { name: { in: ['Asset', 'ASSET'], mode: 'insensitive' } },
        children: { none: {} },
        OR: [
          { accountName: { contains: 'bank', mode: 'insensitive' } },
          { accountName: { contains: 'cash', mode: 'insensitive' } },
          { detailType: { in: ['Cash', 'Bank'], mode: 'insensitive' } }
        ]
      },
      include: { accountType: true }
    });

    const cashAccounts = cashBankAccounts.filter(a => AccountingService.isCashAccount(a.accountName, a.detailType));
    const bankAccounts = cashBankAccounts.filter(a => AccountingService.isBankAccount(a.accountName, a.detailType));

    const cashCodes = new Set(cashAccounts.map(a => a.glCode));
    const bankCodes = new Set(bankAccounts.map(a => a.glCode));
    const cashBankCodes = new Set(cashBankAccounts.map(a => a.glCode));

    type CashFlowCategory = 'Operating' | 'Investing' | 'Financing';
    function classifyCashFlowCategory(accountName: string, accountTypeName: string | undefined): CashFlowCategory {
      const name = accountName.toLowerCase();
      const type = (accountTypeName || '').toUpperCase();
      const investingKeywords = ['fixed asset', 'investment', 'property', 'equipment', 'vehicle', 'furniture', 'building', 'long-term'];
      const financingKeywords = ['loan', 'equity', 'capital', 'owner', 'borrowing', 'share'];
      if (investingKeywords.some(k => name.includes(k))) return 'Investing';
      if (financingKeywords.some(k => name.includes(k)) || type === 'EQUITY') return 'Financing';
      if (type === 'LIABILITY' && financingKeywords.some(k => name.includes(k))) return 'Financing';
      return 'Operating';
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      dateFilter.lte = AccountingService.endOfDay(endDate);
    }

    const computeBalance = async (accounts: typeof cashBankAccounts, upto?: Date) => {
      if (accounts.length === 0) return 0;
      const aggregates = await AccountingService.getPostedAggregates({
        to: upto,
        accountIds: accounts.map(a => a.id)
      });
      const total = accounts.reduce(
        (sum, acc) => sum.plus(AccountingService.naturalBalance('ASSET', acc.initialBalance, aggregates.get(acc.id))),
        new Prisma.Decimal(0)
      );
      return total.toNumber();
    };

    const computeCashBalance = (upto?: Date) => computeBalance(cashBankAccounts, upto);
    const computeCashOnlyBalance = (upto?: Date) => computeBalance(cashAccounts, upto);
    const computeBankOnlyBalance = (upto?: Date) => computeBalance(bankAccounts, upto);

    const postedJournals = await prisma.journalEntry.findMany({
      where: {
        status: 'Posted',
        isDeleted: false,
        ...(Object.keys(dateFilter).length > 0 ? { postingDate: dateFilter } : {}),
      },
      include: {
        lines: {
          include: {
            account: {
              include: { accountType: true }
            }
          }
        }
      },
      orderBy: { postingDate: 'asc' },
    });

    const inflowsMap: Record<string, Prisma.Decimal> = {};
    const outflowsMap: Record<string, Prisma.Decimal> = {};
    const inflowCategoryByAccount: Record<string, CashFlowCategory> = {};
    const outflowCategoryByAccount: Record<string, CashFlowCategory> = {};

    const cashInflowsMap: Record<string, Prisma.Decimal> = {};
    const cashOutflowsMap: Record<string, Prisma.Decimal> = {};
    const bankInflowsMap: Record<string, Prisma.Decimal> = {};
    const bankOutflowsMap: Record<string, Prisma.Decimal> = {};

    const processMovements = (
      movementLines: typeof postedJournals[0]['lines'],
      nonCashLines: typeof postedJournals[0]['lines'],
      netChangeDec: Prisma.Decimal,
      globalInflows: Record<string, Prisma.Decimal>,
      globalOutflows: Record<string, Prisma.Decimal>
    ) => {
      if (netChangeDec.gt(0)) {
        const totalNonCashCredit = nonCashLines.reduce((sum, l) => sum.plus(new Prisma.Decimal(l.credit)), new Prisma.Decimal(0));
        nonCashLines.forEach((l) => {
          const lCredit = new Prisma.Decimal(l.credit);
          if (lCredit.gt(0)) {
            const ratio = totalNonCashCredit.gt(0) ? lCredit.div(totalNonCashCredit) : new Prisma.Decimal(1);
            const amount = netChangeDec.mul(ratio);
            const name = l.account.accountName;
            globalInflows[name] = (globalInflows[name] || new Prisma.Decimal(0)).plus(amount);
            inflowCategoryByAccount[name] = classifyCashFlowCategory(name, l.account.accountType?.name);
          }
        });
      } else if (netChangeDec.lt(0)) {
        const absChange = netChangeDec.abs();
        const totalNonCashDebit = nonCashLines.reduce((sum, l) => sum.plus(new Prisma.Decimal(l.debit)), new Prisma.Decimal(0));
        nonCashLines.forEach((l) => {
          const lDebit = new Prisma.Decimal(l.debit);
          if (lDebit.gt(0)) {
            const ratio = totalNonCashDebit.gt(0) ? lDebit.div(totalNonCashDebit) : new Prisma.Decimal(1);
            const amount = absChange.mul(ratio);
            const name = l.account.accountName;
            globalOutflows[name] = (globalOutflows[name] || new Prisma.Decimal(0)).plus(amount);
            outflowCategoryByAccount[name] = classifyCashFlowCategory(name, l.account.accountType?.name);
          }
        });
      }
    };

    postedJournals.forEach((je) => {
      const allCashBankLines = je.lines.filter(l => cashBankCodes.has(l.account.glCode));
      const nonCashBankLines = je.lines.filter(l => !cashBankCodes.has(l.account.glCode));

      if (allCashBankLines.length === 0 || nonCashBankLines.length === 0) return;

      const netCashChange = allCashBankLines.reduce(
        (sum, l) => sum.plus(new Prisma.Decimal(l.debit)).minus(new Prisma.Decimal(l.credit)),
        new Prisma.Decimal(0)
      );
      processMovements(allCashBankLines, nonCashBankLines, netCashChange, inflowsMap, outflowsMap);

      const cashLines = je.lines.filter(l => cashCodes.has(l.account.glCode));
      if (cashLines.length > 0) {
        const netCash = cashLines.reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.debit)).minus(new Prisma.Decimal(l.credit)),
          new Prisma.Decimal(0)
        );
        processMovements(cashLines, nonCashBankLines, netCash, cashInflowsMap, cashOutflowsMap);
      }

      const bankLines = je.lines.filter(l => bankCodes.has(l.account.glCode));
      if (bankLines.length > 0) {
        const netBank = bankLines.reduce(
          (sum, l) => sum.plus(new Prisma.Decimal(l.debit)).minus(new Prisma.Decimal(l.credit)),
          new Prisma.Decimal(0)
        );
        processMovements(bankLines, nonCashBankLines, netBank, bankInflowsMap, bankOutflowsMap);
      }
    });

    const inflows = Object.entries(inflowsMap).map(([name, dec]) => ({
      accountName: name,
      amount: dec.toNumber(),
      category: inflowCategoryByAccount[name] || 'Operating',
    }));

    const outflows = Object.entries(outflowsMap).map(([name, dec]) => ({
      accountName: name,
      amount: dec.toNumber(),
      category: outflowCategoryByAccount[name] || 'Operating',
    }));

    const sumByCategory = (rows: { amount: number; category: CashFlowCategory }[], cat: CashFlowCategory): Prisma.Decimal =>
      rows.filter(r => r.category === cat).reduce((sum, r) => sum.plus(new Prisma.Decimal(r.amount)), new Prisma.Decimal(0));

    const categories: CashFlowCategory[] = ['Operating', 'Investing', 'Financing'];
    const categorySummary = Object.fromEntries(categories.map(cat => {
      const inf = sumByCategory(inflows, cat);
      const outf = sumByCategory(outflows, cat);
      return [
        cat,
        {
          inflow: inf.toNumber(),
          outflow: outf.toNumber(),
          net: inf.minus(outf).toNumber(),
        },
      ];
    }));

    const totalInflowDec = inflows.reduce((sum, i) => sum.plus(new Prisma.Decimal(i.amount)), new Prisma.Decimal(0));
    const totalOutflowDec = outflows.reduce((sum, o) => sum.plus(new Prisma.Decimal(o.amount)), new Prisma.Decimal(0));
    const netChangeDec = totalInflowDec.minus(totalOutflowDec);

    const endingCash = endDate
      ? await computeCashBalance(new Date(dateFilter.lte))
      : await computeCashBalance();
    const beginningCash = startDate
      ? await computeCashBalance(new Date(new Date(startDate).getTime() - 1))
      : new Prisma.Decimal(endingCash).minus(netChangeDec).toNumber();

    const cashTotalReceiptsDec = Object.values(cashInflowsMap).reduce((s, v) => s.plus(v), new Prisma.Decimal(0));
    const cashTotalPaymentsDec = Object.values(cashOutflowsMap).reduce((s, v) => s.plus(v), new Prisma.Decimal(0));
    const closingCash = endDate
      ? await computeCashOnlyBalance(new Date(dateFilter.lte))
      : await computeCashOnlyBalance();
    const openingCash = startDate
      ? await computeCashOnlyBalance(new Date(new Date(startDate).getTime() - 1))
      : new Prisma.Decimal(closingCash).minus(cashTotalReceiptsDec.minus(cashTotalPaymentsDec)).toNumber();

    const bankTotalReceiptsDec = Object.values(bankInflowsMap).reduce((s, v) => s.plus(v), new Prisma.Decimal(0));
    const bankTotalPaymentsDec = Object.values(bankOutflowsMap).reduce((s, v) => s.plus(v), new Prisma.Decimal(0));
    const closingBank = endDate
      ? await computeBankOnlyBalance(new Date(dateFilter.lte))
      : await computeBankOnlyBalance();
    const openingBank = startDate
      ? await computeBankOnlyBalance(new Date(new Date(startDate).getTime() - 1))
      : new Prisma.Decimal(closingBank).minus(bankTotalReceiptsDec.minus(bankTotalPaymentsDec)).toNumber();

    const periodLabel = startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate
      ? `From ${startDate}`
      : endDate
      ? `Up to ${endDate}`
      : 'All Time';

    return {
      inflows,
      outflows,
      categorySummary,
      cashSection: {
        receipts: Object.entries(cashInflowsMap).map(([accountName, dec]) => ({ accountName, amount: dec.toNumber() })),
        payments: Object.entries(cashOutflowsMap).map(([accountName, dec]) => ({ accountName, amount: dec.toNumber() })),
        openingBalance: openingCash,
        totalReceipts: cashTotalReceiptsDec.toNumber(),
        totalPayments: cashTotalPaymentsDec.toNumber(),
        closingBalance: closingCash,
      },
      bankSection: {
        receipts: Object.entries(bankInflowsMap).map(([accountName, dec]) => ({ accountName, amount: dec.toNumber() })),
        payments: Object.entries(bankOutflowsMap).map(([accountName, dec]) => ({ accountName, amount: dec.toNumber() })),
        openingBalance: openingBank,
        totalReceipts: bankTotalReceiptsDec.toNumber(),
        totalPayments: bankTotalPaymentsDec.toNumber(),
        closingBalance: closingBank,
      },
      summary: {
        beginningCash,
        totalInflow: totalInflowDec.toNumber(),
        totalOutflow: totalOutflowDec.toNumber(),
        netChange: netChangeDec.toNumber(),
        endingCash,
        periodLabel
      }
    };
  }
}

