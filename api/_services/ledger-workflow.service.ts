import { prisma } from '../_prisma.js';
import { AccountingService } from './accounting.service.ts';
import { logAudit } from '../_utils/audit.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

export class LedgerConflictError extends Error {
  status: number = 409;
  statusCode: number = 409;
  constructor(message = 'Transaction has already been posted to the General Ledger.') {
    super(message);
    this.name = 'LedgerConflictError';
  }
}

async function getExpenseAccountForDonation(donationType: string, tx: any) {
  let acc = await tx.account.findFirst({
    where: {
      accountType: { name: { equals: 'Expense', mode: 'insensitive' } },
      NOT: { accountName: { contains: 'Salary', mode: 'insensitive' } },
      OR: [
        { accountName: { contains: donationType, mode: 'insensitive' } },
        { accountName: { contains: 'Aid', mode: 'insensitive' } },
        { accountName: { contains: 'Welfare', mode: 'insensitive' } },
        { accountName: { contains: 'Donation', mode: 'insensitive' } }
      ],
      children: { none: {} },
      isLocked: false,
      isDeleted: false
    },
    orderBy: { glCode: 'asc' }
  });

  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { equals: 'Expense', mode: 'insensitive' } },
        NOT: { accountName: { contains: 'Salary', mode: 'insensitive' } },
        children: { none: {} },
        isLocked: false,
        isDeleted: false
      },
      orderBy: { glCode: 'asc' }
    });
  }

  return acc;
}

async function getIncomeAccountForCategory(category: string, tx: any) {
  let searchKeyword = category;
  if (/hall/i.test(category)) searchKeyword = 'Hall';
  else if (/bus/i.test(category)) searchKeyword = 'Bus';
  else if (/membership/i.test(category)) searchKeyword = 'Membership';
  else if (/zakat/i.test(category)) searchKeyword = 'Zakat';

  let acc = await tx.account.findFirst({
    where: {
      accountType: { name: { in: ['Revenue', 'Income'], mode: 'insensitive' } },
      accountName: { contains: searchKeyword, mode: 'insensitive' },
      isLocked: false,
      children: { none: {} }
    },
    orderBy: { glCode: 'asc' }
  });

  if (!acc && searchKeyword !== category) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { in: ['Revenue', 'Income'], mode: 'insensitive' } },
        accountName: { contains: category, mode: 'insensitive' },
        isLocked: false,
        children: { none: {} }
      },
      orderBy: { glCode: 'asc' }
    });
  }

  if (!acc) {
    acc = await tx.account.findFirst({
      where: {
        accountType: { name: { in: ['Revenue', 'Income'], mode: 'insensitive' } },
        isLocked: false,
        children: { none: {} }
      },
      orderBy: { glCode: 'asc' }
    });
  }

  return acc;
}

async function getOrCreateAccountsReceivable(tx: any) {
  let arAccount = await tx.account.findFirst({
    where: { accountName: { contains: 'Accounts Receivable', mode: 'insensitive' } }
  });

  if (!arAccount) {
    const currentAsset = await tx.account.findFirst({
      where: { glCode: '1010000' }
    });

    if (!currentAsset) {
      throw new Error('Current Assets account (1010000) not found in Chart of Accounts.');
    }

    let newGlCode = '1010200';
    let codeExists = true;
    while (codeExists) {
      const existing = await tx.account.findFirst({ where: { glCode: newGlCode } });
      if (existing) {
        newGlCode = (parseInt(newGlCode) + 1).toString();
      } else {
        codeExists = false;
      }
    }

    arAccount = await tx.account.create({
      data: {
        glCode: newGlCode,
        accountName: 'Accounts Receivable',
        accountLevel: 'SUBSIDIARY',
        parentId: currentAsset.id,
        accountTypeId: currentAsset.accountTypeId,
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

export class LedgerWorkflowService {
  /**
   * Posts a transaction to the General Ledger.
   * Creates double-entry journal entry, updates GL, updates account balances.
   * Enforces duplicate post protection (throws LedgerConflictError 409 if already posted)
   * and creates an audit record (Action: POST_TO_LEDGER).
   */
  static async postToLedger(params: {
    module: string;
    recordId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { module, recordId, userId, ipAddress, userAgent } = params;

    // Fetch user details for audit trail
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });
    const userRole = user?.role?.name || 'User';

    return await prisma.$transaction(async (tx) => {
      const normModule = (module || '').toLowerCase().trim();

      // ── 1. Add Income ──────────────────────────────────────────────────────────
      if (normModule.includes('income') || normModule === 'add-income' || normModule === 'add income') {
        const record = await tx.addIncomeRecord.findUnique({
          where: { id: recordId },
          include: { category: true, bankAccount: true }
        });

        if (!record) throw new Error('Income record not found');
        if (record.status === 'POSTED' || record.journalEntryId) {
          throw new LedgerConflictError('Transaction has already been posted to the General Ledger.');
        }

        let creditAccountId = record.category?.accountId;
        const cleanSubCategory = record.subCategory && record.subCategory.trim() ? record.subCategory.trim() : null;

        if (cleanSubCategory) {
          const subAccName = `Other Income - ${cleanSubCategory}`;
          let subAcc = await tx.account.findFirst({
            where: { accountName: { equals: subAccName, mode: 'insensitive' }, isDeleted: false }
          });
          if (!subAcc) {
            const parent = await tx.account.findFirst({ where: { glCode: '3020500' } }) || await tx.account.findFirst({ where: { glCode: '3020000' } });
            const revType = await tx.accountType.findFirst({ where: { name: { in: ['REVENUE', 'Revenue'] } } });
            const lastGl = await tx.account.findFirst({ where: { glCode: { startsWith: '30205' } }, orderBy: { glCode: 'desc' } });
            const lastCodeNum = lastGl ? parseInt(lastGl.glCode) : 3020500;
            let nextNum = (isNaN(lastCodeNum) ? 3020500 : lastCodeNum) + 1;
            let glCode = String(nextNum);
            if (glCode.length !== 7) nextNum = 3020501, glCode = '3020501';
            while (await tx.account.findUnique({ where: { glCode } })) {
              nextNum += 1;
              glCode = String(nextNum);
              if (glCode.length > 7) throw new Error(`GL code space exhausted under prefix 30205 — all 7-digit codes are taken.`);
            }
            subAcc = await tx.account.create({
              data: {
                glCode,
                accountName: subAccName,
                accountLevel: 'GL',
                parentId: parent ? parent.id : null,
                accountTypeId: revType ? revType.id : null,
                detailType: 'Revenue',
                description: `GL Account for ${subAccName}`
              }
            });
          }
          creditAccountId = subAcc.id;
        }

        const postingDescription = record.remarks
          ? `${record.remarks} (${record.category?.name}${cleanSubCategory ? ` - ${cleanSubCategory}` : ''})`
          : `Income received for ${record.category?.name}${cleanSubCategory ? ` - ${cleanSubCategory}` : ''}`;

        const isBankPayment = record.paymentMethod === 'BANK' || record.paymentMethod === 'ONLINE' || record.paymentMethod === 'CHEQUE';

        const postingResult = await AccountingService.postReceipt(tx, {
          amount: record.amount,
          cashOrBankAccountId: isBankPayment && record.bankAccountId ? record.bankAccountId : undefined,
          cashOrBankAccountKeyword: !(isBankPayment && record.bankAccountId) ? 'Cash' : undefined,
          incomeAccountId: creditAccountId || undefined,
          incomeAccountKeyword: !creditAccountId ? (record.category?.name || 'Income') : undefined,
          description: postingDescription,
          reference: record.referenceNumber || `Income Ref #${record.id.slice(0, 8)}`,
          module: 'Add Income',
          postedBy: userId,
          postingDate: record.date || record.createdAt,
          ipAddress,
          userAgent
        });

        const updatedRecord = await tx.addIncomeRecord.update({
          where: { id: recordId },
          data: {
            status: 'POSTED',
            journalEntryId: postingResult.journalEntry.id,
            postedAt: new Date(),
            postedById: userId
          },
          include: {
            category: true,
            bankAccount: { select: { id: true, glCode: true, accountName: true } },
            createdBy: { select: { id: true, fullName: true, email: true } },
            journalEntry: { select: { id: true, voucherNo: true, status: true } }
          }
        });

        await logAudit({
          userId,
          action: 'POST_TO_LEDGER',
          module: 'Add Income',
          oldValues: { status: record.status, transaction: recordId, amount: Number(record.amount) },
          newValues: {
            action: 'POST_TO_LEDGER',
            user: user?.fullName || user?.email || userId,
            role: userRole,
            transaction: recordId,
            module: 'Add Income',
            amount: Number(record.amount),
            timestamp: new Date().toISOString(),
            journalEntryId: postingResult.journalEntry.id,
            status: 'POSTED'
          },
          postedById: userId,
          postedAt: new Date(),
          ipAddress,
          userAgent
        });

        return updatedRecord;
      }

      // ── 2. Simple Expense ──────────────────────────────────────────────────────
      if (normModule.includes('expense') || normModule === 'simple-expense' || normModule === 'simple expense') {
        const record = await tx.simpleExpense.findUnique({
          where: { id: recordId },
          include: { expenseHead: true }
        });

        if (!record) throw new Error('Expense record not found');
        if (record.status === 'POSTED' || record.journalEntryId) {
          throw new LedgerConflictError('Transaction has already been posted to the General Ledger.');
        }

        let expenseAccountId = record.expenseHead?.accountId;
        if (!expenseAccountId) {
          let acc = await tx.account.findFirst({
            where: { accountName: { equals: record.expenseHead?.name, mode: 'insensitive' }, isDeleted: false }
          });
          if (acc) expenseAccountId = acc.id;
        }

        const isBankPayment = record.paymentMethod === 'BANK' || record.paymentMethod === 'ONLINE' || record.paymentMethod === 'CHEQUE';

        const postingResult = await AccountingService.postPayment(tx, {
          amount: Number(record.amount),
          cashOrBankAccountId: isBankPayment && record.bankAccountId ? record.bankAccountId : undefined,
          cashOrBankAccountKeyword: !(isBankPayment && record.bankAccountId) ? 'Cash' : undefined,
          expenseAccountId: expenseAccountId || undefined,
          expenseAccountKeyword: !expenseAccountId ? (record.expenseHead?.name || 'Expense') : undefined,
          description: record.description || `Expense for ${record.expenseHead?.name}`,
          reference: record.reference || `Expense Ref #${record.id.slice(0, 8)}`,
          module: 'Simple Expense',
          postedBy: userId,
          postingDate: record.date || record.createdAt,
          ipAddress,
          userAgent
        });

        const updatedRecord = await tx.simpleExpense.update({
          where: { id: recordId },
          data: {
            status: 'POSTED',
            journalEntryId: postingResult.journalEntry.id,
            postedAt: new Date(),
            postedById: userId
          },
          include: {
            expenseHead: true,
            createdBy: { select: { id: true, fullName: true, email: true } }
          }
        });

        await logAudit({
          userId,
          action: 'POST_TO_LEDGER',
          module: 'Simple Expense',
          oldValues: { status: record.status, transaction: recordId, amount: Number(record.amount) },
          newValues: {
            action: 'POST_TO_LEDGER',
            user: user?.fullName || user?.email || userId,
            role: userRole,
            transaction: recordId,
            module: 'Simple Expense',
            amount: Number(record.amount),
            timestamp: new Date().toISOString(),
            journalEntryId: postingResult.journalEntry.id,
            status: 'POSTED'
          },
          postedById: userId,
          postedAt: new Date(),
          ipAddress,
          userAgent
        });

        return updatedRecord;
      }

      // ── 3. Donations / Welfare / Zakat ─────────────────────────────────────────
      if (normModule.includes('donation') || normModule.includes('welfare') || normModule.includes('zakat')) {
        const record = await tx.donation.findUnique({
          where: { id: recordId },
          include: { beneficiary: true, bankAccount: true }
        });

        if (!record) throw new Error('Donation record not found');
        if (record.status === 'APPROVED') {
          throw new LedgerConflictError('Transaction has already been posted to the General Ledger.');
        }

        let cashOrBankAccountId: string | null = null;
        if (record.paymentMethod === 'CASH') {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          cashOrBankAccountId = cashAccount.id;
        } else {
          if (!record.bankAccountId) throw new Error('Bank account is required for BANK/CHEQUE payments');
          cashOrBankAccountId = record.bankAccountId;
        }

        const expenseAccount = await getExpenseAccountForDonation(record.donationType, tx);
        if (!expenseAccount) {
          throw new Error(`Donation Expense account not found in Chart of Accounts for ${record.donationType}`);
        }

        const postingResult = await AccountingService.postTransaction(tx, {
          voucherType: 'PV',
          reference: `DON-${record.id.substring(0, 8)}`,
          description: `Disbursement: ${record.donationType} Aid to ${record.beneficiary?.name || record.donorName || 'Beneficiary'}`,
          module: 'Donations',
          postedBy: userId,
          lines: [
            {
              accountId: expenseAccount.id,
              debit: Number(record.amount),
              credit: 0,
              description: `Debit Expense: ${record.donationType} Aid for ${record.beneficiary?.name || record.donorName || 'Beneficiary'}`
            },
            {
              accountId: cashOrBankAccountId,
              debit: 0,
              credit: Number(record.amount),
              description: `Credit ${record.paymentMethod === 'CASH' ? 'Cash' : 'Bank'} Account`
            }
          ],
          ipAddress,
          userAgent
        });

        const updatedRecord = await tx.donation.update({
          where: { id: recordId },
          data: { status: 'APPROVED' },
          include: { beneficiary: true, bankAccount: true, createdBy: true }
        });

        await logAudit({
          userId,
          action: 'POST_TO_LEDGER',
          module: 'Donations',
          oldValues: { status: record.status, transaction: recordId, amount: Number(record.amount) },
          newValues: {
            action: 'POST_TO_LEDGER',
            user: user?.fullName || user?.email || userId,
            role: userRole,
            transaction: recordId,
            module: 'Donations',
            amount: Number(record.amount),
            timestamp: new Date().toISOString(),
            journalEntryId: postingResult.journalEntry.id,
            status: 'APPROVED'
          },
          postedById: userId,
          postedAt: new Date(),
          ipAddress,
          userAgent
        });

        return updatedRecord;
      }

      // ── 4. Hall Bookings ───────────────────────────────────────────────────────
      if (normModule.includes('hall') || normModule === 'hall-bookings' || normModule === 'hall booking') {
        const record = await tx.hallBooking.findUnique({
          where: { id: recordId },
          include: { hallAccount: true, bankAccount: true }
        });

        if (!record) throw new Error('Hall booking not found');
        if (record.status === 'POSTED') {
          throw new LedgerConflictError('Transaction has already been posted to the General Ledger.');
        }

        const revenueAccountId = record.hallId;
        if (!revenueAccountId) throw new Error('Revenue account (Hall) is required to post.');

        let debitAccountId: string | null = null;
        if (record.paymentMethod === 'CASH') {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          debitAccountId = cashAccount.id;
        } else {
          if (!record.bankAccountId) throw new Error('Bank account is required for BANK/CHEQUE payments');
          debitAccountId = record.bankAccountId;
        }

        const netAmt = Number(record.netAmount ?? record.hallCharges);
        const recAmt = Number(record.receivedAmount ?? 0);
        const remAmt = Number(record.remainingAmount ?? (netAmt - recAmt));

        const lines = [];
        if (recAmt > 0) {
          lines.push({
            accountId: debitAccountId,
            debit: recAmt,
            credit: 0,
            description: `Receipt: Hall Booking Receipt for ${record.bookerName} - ${record.hallAccount?.accountName || 'Selected Hall'}`
          });
        }
        if (remAmt > 0) {
          const arAccount = await getOrCreateAccountsReceivable(tx);
          lines.push({
            accountId: arAccount.id,
            debit: remAmt,
            credit: 0,
            description: `Receivable for ${record.bookerName} - Hall Booking #${record.receiptNo}`
          });
        }
        if (netAmt > 0) {
          lines.push({
            accountId: revenueAccountId,
            debit: 0,
            credit: netAmt,
            description: `Revenue for ${record.bookerName} - ${record.hallAccount?.accountName || 'Selected Hall'}`
          });
        }

        let postingResult: any = null;
        if (lines.length > 0) {
          postingResult = await AccountingService.postTransaction(tx, {
            voucherType: 'BR',
            reference: `HALL-${record.receiptNo}`,
            description: `Hall Booking - ${record.bookerName} (${record.hallAccount?.accountName || 'Selected Hall'})`,
            module: 'Hall Bookings',
            postedBy: userId,
            lines,
            ipAddress,
            userAgent
          });
        }

        const updatedRecord = await tx.hallBooking.update({
          where: { id: recordId },
          data: {
            status: 'POSTED',
            journalEntryId: postingResult ? postingResult.journalEntry.id : null
          },
          include: { hallAccount: true, bankAccount: true, createdBy: true }
        });

        await logAudit({
          userId,
          action: 'POST_TO_LEDGER',
          module: 'Hall Bookings',
          oldValues: { status: record.status, transaction: recordId, amount: netAmt },
          newValues: {
            action: 'POST_TO_LEDGER',
            user: user?.fullName || user?.email || userId,
            role: userRole,
            transaction: recordId,
            module: 'Hall Bookings',
            amount: netAmt,
            timestamp: new Date().toISOString(),
            journalEntryId: postingResult.journalEntry.id,
            status: 'POSTED'
          },
          postedById: userId,
          postedAt: new Date(),
          ipAddress,
          userAgent
        });

        return updatedRecord;
      }

      // ── 5. Revenue Collections (Membership, Bus, Collections, etc.) ────────────
      if (
        normModule.includes('collection') ||
        normModule.includes('membership') ||
        normModule.includes('bus') ||
        normModule === 'revenue-collections' ||
        normModule === 'revenue collection'
      ) {
        const record = await tx.revenueCollection.findUnique({
          where: { id: recordId },
          include: { bankAccount: true }
        });

        if (!record) throw new Error('Revenue collection record not found');
        if (record.status === 'POSTED') {
          throw new LedgerConflictError('Transaction has already been posted to the General Ledger.');
        }

        let debitAccountId: string | null = null;
        if (record.paymentMethod === 'CASH') {
          const cashAccount = await AccountingService.ensureCashInHandAccount(tx);
          debitAccountId = cashAccount.id;
        } else {
          if (!record.bankAccountId) throw new Error('Bank account is required for BANK/CHEQUE payments');
          debitAccountId = record.bankAccountId;
        }

        const incomeAccount = await getIncomeAccountForCategory(record.category, tx);
        if (!incomeAccount) {
          throw new Error(`No revenue account found in Chart of Accounts for ${record.category}`);
        }

        const postingResult = await AccountingService.postReceipt(tx, {
          amount: record.amount,
          cashOrBankAccountId: debitAccountId,
          incomeAccountId: incomeAccount.id,
          reference: `${record.category.slice(0, 3).toUpperCase()}-${record.receiptNo}`,
          description: `${record.category} Receipt from ${record.title} ${record.subTitle ? `(${record.subTitle})` : ''}`,
          module: record.category,
          voucherType: 'BR',
          postedBy: userId,
          postingDate: record.eventDate || new Date(),
          ipAddress,
          userAgent
        });

        const updatedRecord = await tx.revenueCollection.update({
          where: { id: recordId },
          data: {
            status: 'POSTED',
            journalEntryId: postingResult.journalEntry.id
          }
        });

        await logAudit({
          userId,
          action: 'POST_TO_LEDGER',
          module: record.category || 'Revenue Collections',
          oldValues: { status: record.status, transaction: recordId, amount: Number(record.amount) },
          newValues: {
            action: 'POST_TO_LEDGER',
            user: user?.fullName || user?.email || userId,
            role: userRole,
            transaction: recordId,
            module: record.category || 'Revenue Collections',
            amount: Number(record.amount),
            timestamp: new Date().toISOString(),
            journalEntryId: postingResult.journalEntry.id,
            status: 'POSTED'
          },
          postedById: userId,
          postedAt: new Date(),
          ipAddress,
          userAgent
        });

        return updatedRecord;
      }

      // ── 6. Invoices ────────────────────────────────────────────────────────────
      if (normModule.includes('invoice')) {
        const record = await tx.invoice.findUnique({
          where: { id: recordId },
          include: { customer: true, items: true, bankAccount: true }
        });

        if (!record) throw new Error('Invoice not found');
        if (record.status === 'POSTED') {
          throw new LedgerConflictError('Transaction has already been posted to the General Ledger.');
        }

        const arAccount = await getOrCreateAccountsReceivable(tx);
        const revenueAccount = await tx.account.findFirst({
          where: {
            accountType: { name: { in: ['Revenue', 'Income'], mode: 'insensitive' } },
            isLocked: false,
            children: { none: {} }
          },
          orderBy: { glCode: 'asc' }
        });

        if (!revenueAccount) {
          throw new Error('Revenue account not found in Chart of Accounts.');
        }

        const postingResult = await AccountingService.postTransaction(tx, {
          voucherType: 'JV',
          reference: `POST-${record.invoiceNo}`,
          description: `Invoice posted to ${record.customer?.name || 'Customer'} - Inv #${record.invoiceNo}`,
          module: 'Invoices',
          postedBy: userId,
          lines: [
            { accountId: arAccount.id, debit: record.total, credit: 0, description: 'Accounts Receivable Debit' },
            { accountId: revenueAccount.id, debit: 0, credit: record.total, description: 'Sales/Revenue Credit' }
          ],
          ipAddress,
          userAgent
        });

        const updatedRecord = await tx.invoice.update({
          where: { id: recordId },
          data: { status: 'POSTED' },
          include: { customer: true, items: true, bankAccount: true }
        });

        await logAudit({
          userId,
          action: 'POST_TO_LEDGER',
          module: 'Invoices',
          oldValues: { status: record.status, transaction: recordId, amount: Number(record.total) },
          newValues: {
            action: 'POST_TO_LEDGER',
            user: user?.fullName || user?.email || userId,
            role: userRole,
            transaction: recordId,
            module: 'Invoices',
            amount: Number(record.total),
            timestamp: new Date().toISOString(),
            status: 'POSTED'
          },
          postedById: userId,
          postedAt: new Date(),
          ipAddress,
          userAgent
        });

        return updatedRecord;
      }

      // ── 7. Donations Received ──────────────────────────────────────────────────
      if (normModule.includes('donation-received') || normModule.includes('donations-received') || normModule.includes('donations received')) {
        const record = await tx.donationReceived.findUnique({
          where: { id: recordId },
          include: { donor: true, cashAccount: true, bankAccount: true }
        });

        if (!record) throw new Error('Donation receipt not found');
        if (record.status === 'POSTED' && record.journalEntryId) {
          throw new LedgerConflictError('Transaction has already been posted to the General Ledger.');
        }

        let debitAccountId = record.paymentMethod === 'CASH' ? record.cashAccountId : record.bankAccountId;
        if (!debitAccountId) {
          if (record.paymentMethod === 'CASH') {
            const cashAcc = await AccountingService.ensureCashInHandAccount(tx);
            debitAccountId = cashAcc.id;
          } else {
            throw new Error('Bank account is required for BANK/CHEQUE receipts');
          }
        }

        const incomeAccount = await getIncomeAccountForCategory(record.donationType, tx);
        if (!incomeAccount) throw new Error(`Revenue account not found for ${record.donationType}`);

        const postingResult = await AccountingService.postReceipt(tx, {
          amount: record.amount,
          cashOrBankAccountId: debitAccountId,
          incomeAccountId: incomeAccount.id,
          reference: `REC-${record.receiptNo}`,
          description: `Donation received from ${record.donor?.name || 'Donor'} (${record.donationType})`,
          module: 'Donations Received',
          postedBy: userId,
          postingDate: record.receiptDate || new Date(),
          ipAddress,
          userAgent
        });

        const updatedRecord = await tx.donationReceived.update({
          where: { id: recordId },
          data: {
            status: 'POSTED',
            journalEntryId: postingResult.journalEntry.id
          }
        });

        await logAudit({
          userId,
          action: 'POST_TO_LEDGER',
          module: 'Donations Received',
          oldValues: { status: record.status, transaction: recordId, amount: Number(record.amount) },
          newValues: {
            action: 'POST_TO_LEDGER',
            user: user?.fullName || user?.email || userId,
            role: userRole,
            transaction: recordId,
            module: 'Donations Received',
            amount: Number(record.amount),
            timestamp: new Date().toISOString(),
            journalEntryId: postingResult.journalEntry.id,
            status: 'POSTED'
          },
          postedById: userId,
          postedAt: new Date(),
          ipAddress,
          userAgent
        });

        return updatedRecord;
      }

      // ── 8. Journal Entries ─────────────────────────────────────────────────────
      if (normModule.includes('journal')) {
        const record = await tx.journalEntry.findUnique({
          where: { id: recordId },
          include: { lines: true }
        });

        if (!record) throw new Error('Journal entry not found');
        if (record.status === 'Posted') {
          throw new LedgerConflictError('Transaction has already been posted to the General Ledger.');
        }

        await AccountingService.assertFinancialYearOpen(tx, record.postingDate);

        const updatedRecord = await tx.journalEntry.update({
          where: { id: recordId },
          data: {
            status: 'Posted',
            postedAt: new Date(),
            postedById: userId
          }
        });

        await AccountingService.recalculateBalancesForJournalEntry(tx, record.id);

        await logAudit({
          userId,
          action: 'POST_TO_LEDGER',
          module: 'Journal Entries',
          oldValues: { status: record.status, transaction: recordId, amount: Number(record.totalAmount) },
          newValues: {
            action: 'POST_TO_LEDGER',
            user: user?.fullName || user?.email || userId,
            role: userRole,
            transaction: recordId,
            module: 'Journal Entries',
            amount: Number(record.totalAmount),
            timestamp: new Date().toISOString(),
            status: 'Posted'
          },
          postedById: userId,
          postedAt: new Date(),
          ipAddress,
          userAgent
        });

        return updatedRecord;
      }

      throw new Error(`Unsupported module for ledger posting: ${module}`);
    }, accountingTxOptions);
  }

  /**
   * Reverts a previously posted transaction from the General Ledger.
   * Reverses/soft-deletes journal entry and recalculates account balances.
   */
  static async revertPosting(params: {
    module: string;
    recordId: string;
    userId: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { module, recordId, userId, reason, ipAddress, userAgent } = params;

    return await prisma.$transaction(async (tx) => {
      const normModule = (module || '').toLowerCase().trim();

      if (normModule.includes('income') || normModule === 'add-income' || normModule === 'add income') {
        const record = await tx.addIncomeRecord.findUnique({
          where: { id: recordId },
          include: { category: true }
        });

        if (!record) throw new Error('Income record not found');
        if (record.status !== 'POSTED' || !record.journalEntryId) {
          throw new Error('Transaction is not currently posted to the General Ledger.');
        }

        // Delete / reverse Journal Entry
        try {
          await AccountingService.deleteJournalEntry(tx, record.journalEntryId, userId, reason || 'Posting Reverted by User');
        } catch (err) {
          console.warn('deleteJournalEntry error during revert:', err);
        }

        const updatedRecord = await tx.addIncomeRecord.update({
          where: { id: recordId },
          data: {
            status: 'REVERTED',
            journalEntryId: null,
            revertedAt: new Date(),
            revertedById: userId,
            revertReason: reason ? reason.trim() : null
          },
          include: {
            category: true,
            createdBy: { select: { id: true, fullName: true, email: true } }
          }
        });

        await logAudit(userId, 'Revert Posting', 'Add Income', record, updatedRecord, ipAddress, userAgent);

        return updatedRecord;
      }

      if (normModule.includes('expense') || normModule === 'simple-expense' || normModule === 'simple expense') {
        const record = await tx.simpleExpense.findUnique({
          where: { id: recordId },
          include: { expenseHead: true }
        });

        if (!record) throw new Error('Expense record not found');
        if (record.status !== 'POSTED' || !record.journalEntryId) {
          throw new Error('Transaction is not currently posted to the General Ledger.');
        }

        try {
          await AccountingService.deleteJournalEntry(tx, record.journalEntryId, userId, reason || 'Posting Reverted by User');
        } catch (err) {
          console.warn('deleteJournalEntry error during revert:', err);
        }

        const updatedRecord = await tx.simpleExpense.update({
          where: { id: recordId },
          data: {
            status: 'REVERTED',
            journalEntryId: null,
            revertedAt: new Date(),
            revertedById: userId,
            revertReason: reason ? reason.trim() : null
          },
          include: {
            expenseHead: true,
            createdBy: { select: { id: true, fullName: true, email: true } }
          }
        });

        await logAudit(userId, 'Revert Posting', 'Simple Expense', record, updatedRecord, ipAddress, userAgent);

        return updatedRecord;
      }

      throw new Error(`Unsupported module for posting revert: ${module}`);
    }, accountingTxOptions);
  }
}
