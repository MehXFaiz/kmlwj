import { prisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingIntegrityService } from './accounting-integrity.service.js';
import bcrypt from 'bcryptjs';

export type ErpResetMode = 'TRANSACTIONS_ONLY' | 'FULL_FINANCIAL_RESET' | 'FULL_ERP_RESET';

export interface ErpResetPreview {
  timestamp: string;
  affectedCounts: {
    journalEntries: number;
    journalEntryLines: number;
    invoices: number;
    invoiceItems: number;
    addIncomeRecords: number;
    simpleIncomes: number;
    simpleExpenses: number;
    donationsGiven: number;
    donationsReceived: number;
    zakatCards: number;
    hallBookings: number;
    revenueCollections: number;
    pettyCashTransactions: number;
    pettyCashReconciliations: number;
    openingBalanceBatches: number;
    openingBalanceLines: number;
    aiRepairIssues: number;
    aiRepairLogs: number;
    members?: number;
    beneficiaries?: number;
    donors?: number;
    customers?: number;
    totalAffected: number;
  };
  preservedCounts: {
    accounts: number;
    accountTypes: number;
    users: number;
    roles: number;
    permissions: number;
    revenueHeads: number;
    expenseHeads: number;
    incomeCategories: number;
    financialYears: number;
    pettyCashConfigs: number;
    members: number;
    beneficiaries: number;
    donors: number;
    customers: number;
  };
}

export interface ExecuteResetParams {
  userId: string;
  resetMode: ErpResetMode;
  password?: string;
  confirmationText: string;
  ipAddress?: string;
  userAgent?: string;
}

export class ErpResetService {
  /**
   * Checks if ERP reset operations are globally enabled on the server.
   */
  static isResetFeatureAllowed(): boolean {
    if (process.env.ALLOW_ERP_RESET === 'false' || process.env.ERP_RESET_ENABLED === 'false') {
      return false;
    }
    return true;
  }

  /**
   * Queries MongoDB to get live record counts for all affected collections
   * before performing any deletion.
   */
  static async getResetPreview(mode: ErpResetMode = 'TRANSACTIONS_ONLY'): Promise<ErpResetPreview> {
    const [
      jeCount,
      jelCount,
      invCount,
      invItemCount,
      addIncCount,
      simpIncCount,
      simpExpCount,
      donCount,
      donRecCount,
      zakCardCount,
      hallBookCount,
      revCollCount,
      pettyCashTxCount,
      pettyCashRecCount,
      obBatchCount,
      obLineCount,
      aiIssueCount,
      aiLogCount,
      accCount,
      accTypeCount,
      userCount,
      roleCount,
      permCount,
      revHeadCount,
      expHeadCount,
      incCatCount,
      fyCount,
      pettyConfigCount,
      memberCount,
      benCount,
      donorCount,
      custCount,
    ] = await Promise.all([
      prisma.journalEntry.count({ where: { isDeleted: false } }),
      prisma.journalEntryLine.count(),
      prisma.invoice.count({ where: { isDeleted: false } }),
      prisma.invoiceItem.count(),
      prisma.addIncomeRecord.count({ where: { isDeleted: false } }),
      prisma.simpleIncome.count({ where: { isDeleted: false } }),
      prisma.simpleExpense.count({ where: { isDeleted: false } }),
      prisma.donation.count({ where: { isDeleted: false } }),
      prisma.donationReceived.count({ where: { isDeleted: false } }),
      prisma.zakatCard.count({ where: { isDeleted: false } }),
      prisma.hallBooking.count({ where: { isDeleted: false } }),
      prisma.revenueCollection.count({ where: { isDeleted: false } }),
      prisma.pettyCashTransaction.count({ where: { isDeleted: false } }),
      prisma.pettyCashReconciliation.count(),
      prisma.openingBalanceBatch.count(),
      prisma.openingBalanceLine.count(),
      prisma.aiRepairIssue.count(),
      prisma.aiRepairLog.count(),
      prisma.account.count({ where: { isDeleted: false } }),
      prisma.accountType.count(),
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.revenueHead.count({ where: { isDeleted: false } }),
      prisma.expenseHead.count({ where: { isDeleted: false } }),
      prisma.incomeCategory.count({ where: { isDeleted: false } }),
      prisma.financialYear.count(),
      prisma.pettyCashConfig.count(),
      prisma.member.count({ where: { isDeleted: false } }),
      prisma.beneficiary.count({ where: { isDeleted: false } }),
      prisma.donor.count({ where: { isDeleted: false } }),
      prisma.customer.count({ where: { isDeleted: false } }),
    ]);

    let totalAffected =
      jeCount +
      jelCount +
      invCount +
      invItemCount +
      addIncCount +
      simpIncCount +
      simpExpCount +
      donCount +
      donRecCount +
      zakCardCount +
      hallBookCount +
      revCollCount +
      pettyCashTxCount +
      pettyCashRecCount +
      aiIssueCount +
      aiLogCount;

    if (mode === 'FULL_FINANCIAL_RESET' || mode === 'FULL_ERP_RESET') {
      totalAffected += obBatchCount + obLineCount;
    }

    if (mode === 'FULL_ERP_RESET') {
      totalAffected += memberCount + benCount + donorCount + custCount;
    }

    return {
      timestamp: new Date().toISOString(),
      affectedCounts: {
        journalEntries: jeCount,
        journalEntryLines: jelCount,
        invoices: invCount,
        invoiceItems: invItemCount,
        addIncomeRecords: addIncCount,
        simpleIncomes: simpIncCount,
        simpleExpenses: simpExpCount,
        donationsGiven: donCount,
        donationsReceived: donRecCount,
        zakatCards: zakCardCount,
        hallBookings: hallBookCount,
        revenueCollections: revCollCount,
        pettyCashTransactions: pettyCashTxCount,
        pettyCashReconciliations: pettyCashRecCount,
        openingBalanceBatches: obBatchCount,
        openingBalanceLines: obLineCount,
        aiRepairIssues: aiIssueCount,
        aiRepairLogs: aiLogCount,
        members: mode === 'FULL_ERP_RESET' ? memberCount : undefined,
        beneficiaries: mode === 'FULL_ERP_RESET' ? benCount : undefined,
        donors: mode === 'FULL_ERP_RESET' ? donorCount : undefined,
        customers: mode === 'FULL_ERP_RESET' ? custCount : undefined,
        totalAffected,
      },
      preservedCounts: {
        accounts: accCount,
        accountTypes: accTypeCount,
        users: userCount,
        roles: roleCount,
        permissions: permCount,
        revenueHeads: revHeadCount,
        expenseHeads: expHeadCount,
        incomeCategories: incCatCount,
        financialYears: fyCount,
        pettyCashConfigs: pettyConfigCount,
        members: memberCount,
        beneficiaries: benCount,
        donors: donorCount,
        customers: custCount,
      },
    };
  }

  /**
   * Executes the ERP Reset inside an atomic MongoDB/Prisma transaction.
   * Strictly verifies Super Admin permissions and confirmation requirements.
   */
  static async executeReset(params: ExecuteResetParams) {
    const startTime = Date.now();

    // 1. Check server-side safety flag
    if (!this.isResetFeatureAllowed()) {
      throw Object.assign(
        new Error('ERP Data Reset is disabled on this server. Contact system administrator.'),
        { status: 403, code: 'RESET_DISABLED' }
      );
    }

    // 2. Strict Confirmation Text Check
    const normalizedConfirmation = (params.confirmationText || '').trim();
    if (normalizedConfirmation !== 'RESET ERP') {
      throw Object.assign(
        new Error('Invalid confirmation text. You must type "RESET ERP" exactly to proceed.'),
        { status: 400, code: 'INVALID_CONFIRMATION' }
      );
    }

    // 3. Database Authentication & Super Admin Verification
    const adminUser = await prisma.user.findUnique({
      where: { id: params.userId },
      include: { role: true },
    });

    if (!adminUser || adminUser.isDeleted || !adminUser.isActive) {
      throw Object.assign(
        new Error('Authenticated user account is not active or not found.'),
        { status: 401, code: 'UNAUTHORIZED' }
      );
    }

    const roleName = adminUser.role?.name;
    const isSuperAdmin = roleName === 'Super Admin' || roleName === 'SUPER ADMIN';
    if (!isSuperAdmin) {
      throw Object.assign(
        new Error('Forbidden: Only SUPER ADMIN has authorization to execute ERP Data Reset.'),
        { status: 403, code: 'FORBIDDEN' }
      );
    }

    // 4. Password Re-Authentication Verification
    if (!params.password) {
      throw Object.assign(
        new Error('Super Admin password re-authentication is required.'),
        { status: 400, code: 'PASSWORD_REQUIRED' }
      );
    }

    const isPasswordValid = await bcrypt.compare(params.password, adminUser.password);
    if (!isPasswordValid) {
      throw Object.assign(
        new Error('Invalid Super Admin password. ERP Reset aborted.'),
        { status: 401, code: 'INVALID_PASSWORD' }
      );
    }

    const resetMode = params.resetMode || 'TRANSACTIONS_ONLY';
    const previewBefore = await this.getResetPreview(resetMode);
    const resetId = `RST-${Date.now().toString().slice(-6)}`;

    logger.warn(
      { adminEmail: adminUser.email, resetMode, resetId },
      'SUPER ADMIN initiated ERP Data Reset'
    );

    // 5. Execute targeted transactional deletion inside atomic database transaction
    let transactionResults: any;
    try {
      transactionResults = await prisma.$transaction(
        async (tx) => {
          // Step 1: Child Transaction Items
          const invItem = await tx.invoiceItem.deleteMany({});

          let preservedObJeIds: string[] = [];
          let obBatchCount = 0;
          let obLineCount = 0;

          if (resetMode === 'FULL_FINANCIAL_RESET' || resetMode === 'FULL_ERP_RESET') {
            obLineCount = (await tx.openingBalanceLine.deleteMany({})).count;
            obBatchCount = (await tx.openingBalanceBatch.deleteMany({})).count;
          } else {
            // Option A: Preserve opening balance batches & lines
            const obBatches = await tx.openingBalanceBatch.findMany({ select: { journalEntryId: true } });
            preservedObJeIds = obBatches.map((b) => b.journalEntryId).filter(Boolean) as string[];
          }

          // Step 2: Source Module Operational Records
          const inv = await tx.invoice.deleteMany({});
          const addInc = await tx.addIncomeRecord.deleteMany({});
          const simpInc = await tx.simpleIncome.deleteMany({});
          const simpExp = await tx.simpleExpense.deleteMany({});
          const don = await tx.donation.deleteMany({});
          const donRec = await tx.donationReceived.deleteMany({});
          const zakCard = await tx.zakatCard.deleteMany({});
          const hallBook = await tx.hallBooking.deleteMany({});
          const revColl = await tx.revenueCollection.deleteMany({});
          const pettyCashTx = await tx.pettyCashTransaction.deleteMany({});
          const pettyCashRec = await tx.pettyCashReconciliation.deleteMany({});

          // Step 3: Journal Entry Lines & Headers
          let jelCount = 0;
          let jeCount = 0;

          if (resetMode === 'FULL_FINANCIAL_RESET' || resetMode === 'FULL_ERP_RESET') {
            jelCount = (await tx.journalEntryLine.deleteMany({})).count;
            jeCount = (await tx.journalEntry.deleteMany({})).count;
          } else {
            jelCount = (
              await tx.journalEntryLine.deleteMany({
                where: { journalEntryId: { notIn: preservedObJeIds } },
              })
            ).count;
            jeCount = (
              await tx.journalEntry.deleteMany({
                where: { id: { notIn: preservedObJeIds } },
              })
            ).count;
          }

          // Step 4: AI Issues & Diagnostic Logs
          const aiIssues = await tx.aiRepairIssue.deleteMany({});
          const aiLogs = await tx.aiRepairLog.deleteMany({});

          // Step 5: Option C Full Reset (Directory Data)
          let memberCount = 0;
          let benCount = 0;
          let donorCount = 0;
          let custCount = 0;

          if (resetMode === 'FULL_ERP_RESET') {
            await tx.familyRelationship.deleteMany({});
            memberCount = (await tx.member.deleteMany({})).count;
            benCount = (await tx.beneficiary.deleteMany({})).count;
            donorCount = (await tx.donor.deleteMany({})).count;
            custCount = (await tx.customer.deleteMany({})).count;
            await tx.refreshToken.deleteMany({});
          }

          // Step 6: Re-open Financial Years
          await tx.financialYear.updateMany({
            data: {
              isClosed: false,
              closedAt: null,
              closedById: null,
              reopenedAt: null,
              reopenedById: null,
              closingNotes: null,
            },
          });

          // Step 7: Reset Account Balances & Revenue Heads
          let accCount = 0;
          if (resetMode === 'FULL_FINANCIAL_RESET' || resetMode === 'FULL_ERP_RESET') {
            accCount = (
              await tx.account.updateMany({
                data: { initialBalance: 0, currentBalance: 0 },
              })
            ).count;
          } else {
            // Option A: Recalculate balances strictly from preserved Opening Balance entries
            const accounts = await tx.account.findMany({ select: { id: true } });
            accCount = accounts.length;

            for (const acc of accounts) {
              const obLines = await tx.journalEntryLine.aggregate({
                where: { accountId: acc.id, journalEntryId: { in: preservedObJeIds } },
                _sum: { debit: true, credit: true },
              });
              const netOb = Number(obLines._sum.debit || 0) - Number(obLines._sum.credit || 0);
              await tx.account.update({
                where: { id: acc.id },
                data: { currentBalance: netOb, initialBalance: netOb },
              });
            }
          }

          // Reset Revenue Head amounts to 0
          const revHeadCount = (await tx.revenueHead.updateMany({ data: { amount: 0 } })).count;

          // Step 8: Double Entry Verification & Integrity Guard
          const remainingJEs = await tx.journalEntry.count({
            where: resetMode === 'FULL_FINANCIAL_RESET' || resetMode === 'FULL_ERP_RESET' ? {} : { id: { notIn: preservedObJeIds } },
          });

          if (remainingJEs > 0) {
            throw new Error(`Accounting integrity violation: ${remainingJEs} orphan journal entries remain post deletion.`);
          }

          const totals = await tx.journalEntryLine.aggregate({
            _sum: { debit: true, credit: true },
          });
          const totalDebit = Number(totals._sum.debit || 0);
          const totalCredit = Number(totals._sum.credit || 0);
          const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.01;

          if (!isBalanced) {
            throw new Error(
              `Reconciliation failed: Total Debits (PKR ${totalDebit}) != Total Credits (PKR ${totalCredit}). Transaction rolled back.`
            );
          }

          const totalRecordsDeleted =
            invItem.count +
            inv.count +
            addInc.count +
            simpInc.count +
            simpExp.count +
            don.count +
            donRec.count +
            zakCard.count +
            hallBook.count +
            revColl.count +
            pettyCashTx.count +
            pettyCashRec.count +
            aiIssues.count +
            aiLogs.count +
            obBatchCount +
            obLineCount +
            jelCount +
            jeCount +
            memberCount +
            benCount +
            donorCount +
            custCount;

          return {
            resetId,
            resetMode,
            invItemCount: invItem.count,
            invCount: inv.count,
            addIncomeCount: addInc.count,
            simpleIncomeCount: simpInc.count,
            simpleExpenseCount: simpExp.count,
            donationGivenCount: don.count,
            donationReceivedCount: donRec.count,
            zakatCardCount: zakCard.count,
            hallBookingCount: hallBook.count,
            revenueCollectionCount: revColl.count,
            pettyCashTxCount: pettyCashTx.count,
            pettyCashRecCount: pettyCashRec.count,
            obBatchCount,
            obLineCount,
            jelCount,
            jeCount,
            aiIssueCount: aiIssues.count,
            aiLogCount: aiLogs.count,
            memberCount,
            beneficiaryCount: benCount,
            donorCount,
            customerCount: custCount,
            accCount,
            revHeadCount,
            totalRecordsDeleted,
            totalDebit,
            totalCredit,
            isBalanced,
          };
        },
        { timeout: 90000, maxWait: 30000 }
      );
    } catch (dbError: any) {
      logger.error({ error: dbError, adminEmail: adminUser.email }, 'ERP Data Reset database transaction failed');
      throw Object.assign(
        new Error(`ERP reset failed during database execution: ${dbError.message || 'Transaction rolled back'}`),
        { status: 500, code: 'DATABASE_TRANSACTION_FAILED', originalError: dbError }
      );
    }

    const durationMs = Date.now() - startTime;

    // 6. Post-Reset Fresh Accounting Integrity Check
    let integrityCheck: any = null;
    try {
      integrityCheck = await AccountingIntegrityService.runFullCheck();
    } catch (checkErr) {
      logger.warn({ error: checkErr }, 'Post-reset integrity check warning');
    }

    // 7. Create Immutable Audit Log
    const auditSummary = {
      resetId,
      resetMode,
      performedBy: adminUser.fullName,
      adminEmail: adminUser.email,
      totalRecordsDeleted: transactionResults.totalRecordsDeleted,
      durationMs,
      status: 'COMPLETED',
      countsBefore: previewBefore.affectedCounts,
      breakdown: transactionResults,
      integrityCheckSummary: {
        totalIssues: integrityCheck?.totalIssues ?? 0,
        criticalCount: integrityCheck?.criticalCount ?? 0,
        warningCount: integrityCheck?.warningCount ?? 0,
      },
    };

    try {
      await logAudit(
        adminUser.id,
        `ERP_DATA_RESET`,
        'SYSTEM_ADMINISTRATION',
        null,
        auditSummary,
        params.ipAddress || null,
        params.userAgent || null
      );
    } catch (auditErr) {
      logger.error({ error: auditErr }, 'Failed to record ERP reset audit log');
    }

    logger.info(
      { resetId, resetMode, adminEmail: adminUser.email, totalRecordsDeleted: transactionResults.totalRecordsDeleted, durationMs },
      'ERP Data Reset executed successfully'
    );

    return {
      success: true,
      resetId,
      resetMode,
      performedBy: adminUser.fullName,
      adminEmail: adminUser.email,
      timestamp: new Date().toISOString(),
      durationMs,
      totalRecordsDeleted: transactionResults.totalRecordsDeleted,
      preservedCounts: previewBefore.preservedCounts,
      breakdown: transactionResults,
      integrityCheck,
      message: 'ERP System Data Reset completed successfully.',
    };
  }

  /**
   * Retrieves past ERP Reset operations from the audit log.
   */
  static async getResetHistory(limit: number = 20) {
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: 'ERP_DATA_RESET' },
          { action: { startsWith: 'ERP DATA RESET' } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => {
      const details: any = log.newValues || {};
      return {
        id: log.id,
        resetId: details.resetId || `RST-${log.id.slice(0, 6)}`,
        action: log.action,
        resetMode: details.resetMode || 'TRANSACTIONS_ONLY',
        performedBy: log.user?.fullName || details.performedBy || 'System Admin',
        adminEmail: log.user?.email || details.adminEmail || 'Unknown',
        role: log.user?.role?.name || 'Super Admin',
        timestamp: log.createdAt.toISOString(),
        status: details.status || 'COMPLETED',
        totalRecordsDeleted: details.totalRecordsDeleted || (typeof details.jeCount === 'number' ? details.jeCount + (details.jelCount || 0) : 0),
        durationMs: details.durationMs || null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        breakdown: details.breakdown || details,
      };
    });
  }
}
