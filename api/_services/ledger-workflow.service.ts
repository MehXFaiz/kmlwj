import { prisma } from '../_prisma.js';
import { AccountingService } from './accounting.service.ts';
import { logAudit } from '../_utils/audit.js';

const accountingTxOptions = { maxWait: 10000, timeout: 30000 };

export class LedgerWorkflowService {
  /**
   * Posts a transaction to the General Ledger.
   * Creates double-entry journal entry, updates GL, updates account balances.
   */
  static async postToLedger(params: {
    module: string;
    recordId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { module, recordId, userId, ipAddress, userAgent } = params;

    return await prisma.$transaction(async (tx) => {
      const normModule = (module || '').toLowerCase().trim();

      if (normModule.includes('income') || normModule === 'add-income' || normModule === 'add income') {
        const record = await tx.addIncomeRecord.findUnique({
          where: { id: recordId },
          include: { category: true, bankAccount: true }
        });

        if (!record) throw new Error('Income record not found');
        if (record.status === 'POSTED' && record.journalEntryId) {
          throw new Error('Transaction is already posted to the General Ledger.');
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
            // SQA fix: previous generator used `'30205' + suffix.padStart(2)`.
            // padStart(2) does nothing once the suffix exceeds 2 digits, so
            // the 100th sub-category account produced '30205100' (8 digits),
            // violating the system-wide 7-digit GL code constraint. Fix treats
            // the full code as a 7-digit integer, increments from the last
            // known value, and throws clearly if the space is exhausted.
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

        await logAudit(userId, 'Post to Ledger', 'Add Income', record, updatedRecord, ipAddress, userAgent);

        return updatedRecord;
      }

      if (normModule.includes('expense') || normModule === 'simple-expense' || normModule === 'simple expense') {
        const record = await tx.simpleExpense.findUnique({
          where: { id: recordId },
          include: { expenseHead: true }
        });

        if (!record) throw new Error('Expense record not found');
        if (record.status === 'POSTED' && record.journalEntryId) {
          throw new Error('Transaction is already posted to the General Ledger.');
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

        await logAudit(userId, 'Post to Ledger', 'Simple Expense', record, updatedRecord, ipAddress, userAgent);

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
