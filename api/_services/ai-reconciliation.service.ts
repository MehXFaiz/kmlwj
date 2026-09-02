import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';
import { AccountingService, POSTED_JOURNAL_FILTER, errDetails } from './accounting.service.js';
import { AccountingBalanceRebuildService, type FinancialSummaryTotals } from './accounting-balance-rebuild.service.js';
import { FundValidationService } from './fund-validation.service.js';
import { AccountingIntegrityService, type IntegrityIssue } from './accounting-integrity.service.js';

const OPEN_STATUSES = ['OPEN', 'ANALYZED', 'PENDING_APPROVAL'] as const;

export interface ReconciliationRunResult {
  timestamp: Date;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  newCount: number;
  resolvedCount: number;
  issues: Awaited<ReturnType<typeof prisma.aiRepairIssue.findMany>>;
}

/**
 * AiReconciliationService — the "Issue Detection" / "Reconciliation Engine"
 * step of the AI Accounting Health & Auto-Repair pipeline. Everything here is
 * deterministic and read-only (no AI, no writes to financial data); it wraps
 * the existing AccountingIntegrityService.runFullCheck() (10 checks) and adds
 * checks for the mismatch types that check didn't cover, then persists the
 * combined result into AiRepairIssue so the AI auditor and repair executor
 * have a stable, addressable issue queue to work from.
 */
export class AiReconciliationService {
  static async runFullReconciliation(): Promise<ReconciliationRunResult> {
    const issues: IntegrityIssue[] = [];

    // 1. Reuse the existing 10 deterministic checks — never duplicate them.
    try {
      const legacy = await AccountingIntegrityService.runFullCheck();
      issues.push(...legacy.issues);
    } catch (err) {
      logger.error({ err: errDetails(err) }, 'AiReconciliationService: legacy runFullCheck failed');
    }

    // 2. One shared expensive computation (raw-SQL balance rebuild + live
    // totals), reused by several of the new checks below instead of each
    // recomputing it independently.
    let summary: FinancialSummaryTotals | null = null;
    try {
      summary = await AccountingBalanceRebuildService.rebuildAllSummaries(prisma);
    } catch (err) {
      logger.error({ err: errDetails(err) }, 'AiReconciliationService: rebuildAllSummaries failed');
    }

    const checks: Promise<IntegrityIssue[]>[] = [
      this.checkUnbalancedJournalEntries(),
      this.checkDuplicateJournalLines(),
      this.checkDuplicateSourceTransactions(),
      this.checkOrphanPostedJournalForDeletedSource(),
      this.checkOrphanPostedJournalForRevertedSource(),
      this.checkDraftSourceWithPostedJournal(),
      this.checkOpeningBalanceOnNonLeafAccount(),
    ];
    if (summary) {
      checks.push(
        this.checkCrossEndpointConsistency(summary),
        this.checkIncomeExpenseMismatch(summary),
        this.checkBalanceSheetEquation(summary)
      );
    }

    const results = await Promise.allSettled(checks);
    for (const r of results) {
      if (r.status === 'fulfilled') issues.push(...r.value);
      else logger.error({ err: errDetails(r.reason) }, 'AiReconciliationService: a reconciliation check failed');
    }

    return this.persistIssues(issues);
  }

  /**
   * Upserts detected issues into AiRepairIssue by (type, entityRef), and
   * resolves any previously-open issue that wasn't reproduced in this run
   * (self-healing — this is the "Re-run Reconciliation" loop in the
   * architecture diagram). AI advisory fields on an existing OPEN issue are
   * left untouched here — only `analyze` overwrites them — and are never
   * cleared on resolve, so repair history/explanations survive a flicker.
   */
  private static async persistIssues(issues: IntegrityIssue[]): Promise<ReconciliationRunResult> {
    const now = new Date();
    const seenIds = new Set<string>();
    let newCount = 0;

    for (const issue of issues) {
      const entityRef = issue.item?.glCode || issue.item?.reference || issue.item?.id || null;
      try {
        const existing = await prisma.aiRepairIssue.findFirst({
          where: { type: issue.type, entityRef, status: { in: [...OPEN_STATUSES] } },
        });

        if (existing) {
          await prisma.aiRepairIssue.update({
            where: { id: existing.id },
            data: {
              description: issue.description,
              severity: issue.severity,
              currentValue: issue.currentValue ?? null,
              expectedValue: issue.expectedValue ?? null,
              difference: issue.difference ?? null,
              affectedRecords: issue.affectedRecords ? (issue.affectedRecords as any) : undefined,
              lastSeenAt: now,
            },
          });
          seenIds.add(existing.id);
        } else {
          const created = await prisma.aiRepairIssue.create({
            data: {
              type: issue.type,
              severity: issue.severity,
              description: issue.description,
              entityRef: entityRef ?? undefined,
              currentValue: issue.currentValue ?? undefined,
              expectedValue: issue.expectedValue ?? undefined,
              difference: issue.difference ?? undefined,
              affectedRecords: issue.affectedRecords ? (issue.affectedRecords as any) : undefined,
              status: 'OPEN',
              detectedAt: now,
              lastSeenAt: now,
            },
          });
          seenIds.add(created.id);
          newCount++;
        }
      } catch (err) {
        logger.error({ err: errDetails(err) }, `AiReconciliationService: failed to persist issue type=${issue.type}`);
      }
    }

    const resolved = await prisma.aiRepairIssue.updateMany({
      where: { status: { in: [...OPEN_STATUSES] }, id: { notIn: Array.from(seenIds) } },
      data: { status: 'RESOLVED', resolvedAt: now },
    });

    const persisted = await prisma.aiRepairIssue.findMany({
      where: { status: { in: [...OPEN_STATUSES] } },
    });

    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    persisted.sort((a, b) => {
      const s = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      return s !== 0 ? s : b.detectedAt.getTime() - a.detectedAt.getTime();
    });

    return {
      timestamp: now,
      totalIssues: persisted.length,
      criticalCount: persisted.filter((i) => i.severity === 'critical').length,
      warningCount: persisted.filter((i) => i.severity === 'warning').length,
      infoCount: persisted.filter((i) => i.severity === 'info').length,
      newCount,
      resolvedCount: resolved.count,
      issues: persisted,
    };
  }

  // ── New checks beyond the legacy 10 ────────────────────────────────────

  /**
   * Per-entry balance check. The legacy trial-balance check only verifies
   * global debit=credit; two entries with offsetting errors could still pass
   * it while each individually being wrong. This checks every posted entry.
   */
  private static async checkUnbalancedJournalEntries(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    try {
      const sums = await prisma.journalEntryLine.groupBy({
        by: ['journalEntryId'],
        where: { journalEntry: POSTED_JOURNAL_FILTER },
        _sum: { debit: true, credit: true },
      });

      const mismatched = sums.filter((s) => {
        const d = new Prisma.Decimal(s._sum.debit ?? 0);
        const c = new Prisma.Decimal(s._sum.credit ?? 0);
        return !d.equals(c);
      });
      if (mismatched.length === 0) return issues;

      const entries = await prisma.journalEntry.findMany({
        where: { id: { in: mismatched.map((m) => m.journalEntryId) } },
        select: { id: true, voucherNo: true },
      });
      const byId = new Map(entries.map((e) => [e.id, e]));

      for (const m of mismatched) {
        const entry = byId.get(m.journalEntryId);
        const d = new Prisma.Decimal(m._sum.debit ?? 0);
        const c = new Prisma.Decimal(m._sum.credit ?? 0);
        const diff = d.minus(c).abs();
        issues.push({
          type: 'unbalanced_journal_entry',
          severity: 'critical',
          description: `Journal entry ${entry?.voucherNo ?? m.journalEntryId} is unbalanced: Debit ${d.toFixed(2)} vs Credit ${c.toFixed(2)} (difference ${diff.toFixed(2)}).`,
          item: { id: m.journalEntryId, reference: entry?.voucherNo },
          currentValue: d.toNumber(),
          expectedValue: c.toNumber(),
          difference: diff.toNumber(),
          affectedRecords: [{ model: 'JournalEntry', id: m.journalEntryId, ref: entry?.voucherNo }],
        });
      }
    } catch (err) {
      logger.error({ err: errDetails(err) }, 'AiReconciliationService: checkUnbalancedJournalEntries failed');
    }
    return issues;
  }

  /**
   * Flags exact-duplicate lines within the same entry — same account, debit,
   * credit AND description. Matching on the full tuple (not just account)
   * avoids false positives on legitimate split postings, which typically
   * differ in amount or description.
   */
  private static async checkDuplicateJournalLines(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    try {
      const grouped = await prisma.journalEntryLine.groupBy({
        by: ['journalEntryId', 'accountId', 'debit', 'credit', 'description'],
        where: { journalEntry: POSTED_JOURNAL_FILTER },
        _count: { _all: true },
      });
      const flagged = grouped.filter((g) => g._count._all > 1).slice(0, 50);
      if (flagged.length === 0) return issues;

      const journalEntryIds = [...new Set(flagged.map((f) => f.journalEntryId))];
      const entries = await prisma.journalEntry.findMany({
        where: { id: { in: journalEntryIds } },
        select: { id: true, voucherNo: true },
      });
      const entryById = new Map(entries.map((e) => [e.id, e.voucherNo]));

      for (const f of flagged) {
        const amount = new Prisma.Decimal(f.debit).greaterThan(0) ? f.debit : f.credit;
        issues.push({
          type: 'duplicate_journal_lines',
          severity: 'warning',
          description: `Journal entry ${entryById.get(f.journalEntryId) ?? f.journalEntryId} has ${f._count._all} identical lines (same account, debit, credit, and description) for amount ${new Prisma.Decimal(amount).toFixed(2)} — possible duplicate posting.`,
          item: { id: f.journalEntryId, reference: entryById.get(f.journalEntryId) },
          affectedRecords: [{ model: 'JournalEntry', id: f.journalEntryId, ref: entryById.get(f.journalEntryId) }],
        });
      }
    } catch (err) {
      logger.error({ err: errDetails(err) }, 'AiReconciliationService: checkDuplicateJournalLines failed');
    }
    return issues;
  }

  /**
   * Classic double-submit detector: same amount + same day + same category/
   * head/donor + same creator across each source-transaction model.
   */
  private static async checkDuplicateSourceTransactions(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    const models: { name: string; find: () => Promise<any[]> }[] = [
      {
        name: 'SimpleIncome',
        find: () => prisma.simpleIncome.findMany({ where: { isDeleted: false }, select: { id: true, amount: true, date: true, revenueHeadId: true, createdById: true } }),
      },
      {
        name: 'SimpleExpense',
        find: () => prisma.simpleExpense.findMany({ where: { isDeleted: false }, select: { id: true, amount: true, date: true, expenseHeadId: true, createdById: true } }),
      },
      {
        name: 'DonationReceived',
        find: () => prisma.donationReceived.findMany({ where: { isDeleted: false }, select: { id: true, amount: true, receiptDate: true, donorId: true, createdById: true } }),
      },
      {
        name: 'AddIncomeRecord',
        find: () => prisma.addIncomeRecord.findMany({ where: { isDeleted: false }, select: { id: true, amount: true, date: true, categoryId: true, createdById: true } }),
      },
      {
        name: 'RevenueCollection',
        find: () => prisma.revenueCollection.findMany({ where: { isDeleted: false }, select: { id: true, amount: true, eventDate: true, category: true, createdById: true } }),
      },
    ];

    for (const m of models) {
      try {
        const rows = await m.find();
        const groups = new Map<string, any[]>();
        for (const r of rows) {
          const dateVal = r.date || r.receiptDate || r.eventDate;
          if (!dateVal || r.amount == null) continue;
          const dayKey = new Date(dateVal).toISOString().slice(0, 10);
          const bucketKey = r.revenueHeadId || r.expenseHeadId || r.donorId || r.categoryId || r.category || 'na';
          const key = `${dayKey}|${bucketKey}|${new Prisma.Decimal(r.amount).toFixed(2)}|${r.createdById || 'na'}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(r);
        }
        for (const rows2 of groups.values()) {
          if (rows2.length > 1) {
            issues.push({
              type: 'duplicate_source_transaction',
              severity: 'warning',
              description: `${rows2.length} ${m.name} records share the same amount (${new Prisma.Decimal(rows2[0].amount).toFixed(2)}), date, category/head, and creator — possible duplicate entry.`,
              item: { id: rows2[0].id, reference: m.name },
              affectedRecords: rows2.map((r) => ({ model: m.name, id: r.id })),
            });
          }
        }
      } catch (err) {
        logger.error({ err: errDetails(err) }, `AiReconciliationService: checkDuplicateSourceTransactions failed for ${m.name}`);
      }
    }
    return issues;
  }

  /** Deleted source record whose journal entry is still Posted and affecting the GL. */
  private static async checkOrphanPostedJournalForDeletedSource(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    const sources: { name: string; find: () => Promise<{ id: string; journalEntryId: string | null }[]> }[] = [
      { name: 'SimpleIncome', find: () => prisma.simpleIncome.findMany({ where: { isDeleted: true, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
      { name: 'SimpleExpense', find: () => prisma.simpleExpense.findMany({ where: { isDeleted: true, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
      { name: 'DonationReceived', find: () => prisma.donationReceived.findMany({ where: { isDeleted: true, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
      { name: 'AddIncomeRecord', find: () => prisma.addIncomeRecord.findMany({ where: { isDeleted: true, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
      { name: 'HallBooking', find: () => prisma.hallBooking.findMany({ where: { isDeleted: true, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
      { name: 'RevenueCollection', find: () => prisma.revenueCollection.findMany({ where: { isDeleted: true, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
      { name: 'ZakatCard', find: () => prisma.zakatCard.findMany({ where: { isDeleted: true, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
    ];

    for (const s of sources) {
      try {
        const rows = await s.find();
        if (rows.length === 0) continue;
        const jeIds = rows.map((r) => r.journalEntryId!).filter(Boolean);
        const stillPosted = await prisma.journalEntry.findMany({
          where: { id: { in: jeIds }, status: 'Posted', isDeleted: false },
          select: { id: true, voucherNo: true },
        });
        const stillPostedMap = new Map(stillPosted.map((j) => [j.id, j.voucherNo]));
        for (const r of rows) {
          if (r.journalEntryId && stillPostedMap.has(r.journalEntryId)) {
            issues.push({
              type: 'orphan_posted_journal_for_deleted_source',
              severity: 'critical',
              description: `${s.name} record ${r.id} was deleted, but its journal entry ${stillPostedMap.get(r.journalEntryId)} is still Posted and affecting the General Ledger.`,
              item: { id: r.journalEntryId, reference: stillPostedMap.get(r.journalEntryId) || undefined },
              affectedRecords: [
                { model: s.name, id: r.id },
                { model: 'JournalEntry', id: r.journalEntryId, ref: stillPostedMap.get(r.journalEntryId) || undefined },
              ],
            });
          }
        }
      } catch (err) {
        logger.error({ err: errDetails(err) }, `AiReconciliationService: checkOrphanPostedJournalForDeletedSource failed for ${s.name}`);
      }
    }
    return issues;
  }

  /** Reverted/cancelled source record whose journal entry is still Posted. */
  private static async checkOrphanPostedJournalForRevertedSource(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    try {
      const [revertedExpenses, revertedIncomes, cancelledDonations] = await Promise.all([
        prisma.simpleExpense.findMany({ where: { isDeleted: false, revertedAt: { not: null }, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }),
        prisma.addIncomeRecord.findMany({ where: { isDeleted: false, revertedAt: { not: null }, journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }),
        prisma.donationReceived.findMany({ where: { isDeleted: false, status: 'CANCELLED', journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }),
      ]);

      const candidates = [
        ...revertedExpenses.map((r) => ({ ...r, model: 'SimpleExpense' })),
        ...revertedIncomes.map((r) => ({ ...r, model: 'AddIncomeRecord' })),
        ...cancelledDonations.map((r) => ({ ...r, model: 'DonationReceived' })),
      ];
      if (candidates.length === 0) return issues;

      const jeIds = candidates.map((c) => c.journalEntryId!).filter(Boolean);
      const stillPosted = await prisma.journalEntry.findMany({
        where: { id: { in: jeIds }, status: 'Posted', isDeleted: false },
        select: { id: true, voucherNo: true },
      });
      const stillPostedMap = new Map(stillPosted.map((j) => [j.id, j.voucherNo]));

      for (const c of candidates) {
        if (c.journalEntryId && stillPostedMap.has(c.journalEntryId)) {
          issues.push({
            type: 'orphan_posted_journal_for_reverted_source',
            severity: 'critical',
            description: `${c.model} record ${c.id} was reverted/cancelled, but its journal entry ${stillPostedMap.get(c.journalEntryId)} is still Posted and affecting the General Ledger.`,
            item: { id: c.journalEntryId, reference: stillPostedMap.get(c.journalEntryId) || undefined },
            affectedRecords: [
              { model: c.model, id: c.id },
              { model: 'JournalEntry', id: c.journalEntryId, ref: stillPostedMap.get(c.journalEntryId) || undefined },
            ],
          });
        }
      }
    } catch (err) {
      logger.error({ err: errDetails(err) }, 'AiReconciliationService: checkOrphanPostedJournalForRevertedSource failed');
    }
    return issues;
  }

  /** Source record still flagged PENDING_POST whose linked journal entry is already Posted. */
  private static async checkDraftSourceWithPostedJournal(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    const models = [
      { name: 'SimpleExpense', find: () => prisma.simpleExpense.findMany({ where: { isDeleted: false, status: 'PENDING_POST', journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
      { name: 'AddIncomeRecord', find: () => prisma.addIncomeRecord.findMany({ where: { isDeleted: false, status: 'PENDING_POST', journalEntryId: { not: null } }, select: { id: true, journalEntryId: true } }) },
    ];
    for (const m of models) {
      try {
        const rows = await m.find();
        if (rows.length === 0) continue;
        const jeIds = rows.map((r) => r.journalEntryId!).filter(Boolean);
        const posted = await prisma.journalEntry.findMany({ where: { id: { in: jeIds }, status: 'Posted', isDeleted: false }, select: { id: true, voucherNo: true } });
        const postedMap = new Map(posted.map((j) => [j.id, j.voucherNo]));
        for (const r of rows) {
          if (r.journalEntryId && postedMap.has(r.journalEntryId)) {
            issues.push({
              type: 'draft_source_with_posted_journal',
              severity: 'warning',
              description: `${m.name} record ${r.id} is still marked PENDING_POST but its linked journal entry ${postedMap.get(r.journalEntryId)} is already Posted — the source record's own status flag was not updated.`,
              item: { id: r.journalEntryId, reference: postedMap.get(r.journalEntryId) || undefined },
              affectedRecords: [{ model: m.name, id: r.id }],
            });
          }
        }
      } catch (err) {
        logger.error({ err: errDetails(err) }, `AiReconciliationService: checkDraftSourceWithPostedJournal failed for ${m.name}`);
      }
    }
    return issues;
  }

  /** Non-leaf (non-GL) accounts should never carry an opening balance of their own. */
  private static async checkOpeningBalanceOnNonLeafAccount(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    try {
      const nonLeafWithBalance = await prisma.account.findMany({
        where: { isDeleted: false, accountLevel: { not: 'GL' }, initialBalance: { not: 0 } },
        select: { id: true, glCode: true, accountName: true, accountLevel: true, initialBalance: true },
      });
      for (const acc of nonLeafWithBalance) {
        const bal = new Prisma.Decimal(acc.initialBalance);
        issues.push({
          type: 'opening_balance_on_non_leaf_account',
          severity: 'warning',
          description: `Account ${acc.glCode} - ${acc.accountName} (${acc.accountLevel} level, not a posting-leaf GL account) carries a non-zero opening balance of ${bal.toFixed(2)}. Opening balances should only be set on GL-level accounts.`,
          item: { id: acc.id, glCode: acc.glCode, name: acc.accountName },
          currentValue: bal.toNumber(),
          expectedValue: 0,
          difference: bal.abs().toNumber(),
          affectedRecords: [{ model: 'Account', id: acc.id, ref: acc.glCode }],
        });
      }
    } catch (err) {
      logger.error({ err: errDetails(err) }, 'AiReconciliationService: checkOpeningBalanceOnNonLeafAccount failed');
    }
    return issues;
  }

  /**
   * The practical, fully server-side version of "DATABASE vs BACKEND API vs
   * GL vs TRIAL BALANCE vs DASHBOARD" — compares the Cash-in-Hand balance
   * computed via three genuinely independent existing code paths.
   */
  private static async checkCrossEndpointConsistency(summary: FinancialSummaryTotals): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    try {
      const allAccounts = await prisma.account.findMany({
        where: { isDeleted: false },
        include: { accountType: true }
      });
      const cashAccounts = allAccounts.filter(a => AccountingService.isCashAccount(a.accountName, a.detailType));
      const cashAccountIds = cashAccounts.map(a => a.id);

      let viaFundValidation = new Prisma.Decimal(0);
      for (const acc of cashAccounts) {
        const fv = await FundValidationService.getAvailableBalance(prisma, acc.id);
        viaFundValidation = viaFundValidation.plus(fv.availableBalance);
      }

      const agg = await AccountingService.getPostedAggregates({ accountIds: cashAccountIds });
      let naturalBal = new Prisma.Decimal(0);
      for (const acc of cashAccounts) {
        const nat = AccountingService.naturalBalance('ASSET', acc.initialBalance, agg.get(acc.id));
        naturalBal = naturalBal.plus(nat);
      }

      const a = viaFundValidation;
      const b = naturalBal;
      const c = new Prisma.Decimal(summary.cashBalance);
      const maxDiff = Prisma.Decimal.max(a.minus(b).abs(), a.minus(c).abs(), b.minus(c).abs());

      if (maxDiff.greaterThan(0.01)) {
        const primaryCash = cashAccounts.find(acc => acc.glCode === '1010103') || cashAccounts[0];
        issues.push({
          type: 'cross_endpoint_cash_mismatch',
          severity: 'critical',
          description: `Cash balance disagrees across independent calculation paths: fund validation=${a.toFixed(2)}, direct ledger aggregate=${b.toFixed(2)}, financial summary=${c.toFixed(2)} (max difference ${maxDiff.toFixed(2)}).`,
          item: primaryCash ? { id: primaryCash.id, glCode: primaryCash.glCode, name: primaryCash.accountName } : undefined,
          currentValue: a.toNumber(),
          expectedValue: b.toNumber(),
          difference: maxDiff.toNumber(),
          affectedRecords: cashAccounts.map(acc => ({ model: 'Account', id: acc.id, ref: acc.glCode })),
        });
      }
    } catch (err) {
      logger.error({ err: errDetails(err) }, 'AiReconciliationService: checkCrossEndpointConsistency failed');
    }
    return issues;
  }

  /** Income Statement totals vs the independently-coded Financial Summary aggregation. */
  private static async checkIncomeExpenseMismatch(summary: FinancialSummaryTotals): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];
    try {
      const incomeStatement = await AccountingService.getIncomeStatement();
      const revDiff = new Prisma.Decimal(incomeStatement.totalRevenue).minus(summary.totalRevenue).abs();
      const expDiff = new Prisma.Decimal(incomeStatement.totalExpense).minus(summary.totalExpense).abs();

      if (revDiff.greaterThan(0.01)) {
        issues.push({
          type: 'income_mismatch',
          severity: 'critical',
          description: `Total revenue disagrees between the Income Statement (${incomeStatement.totalRevenue.toFixed(2)}) and the Financial Summary (${summary.totalRevenue.toFixed(2)}) by ${revDiff.toFixed(2)}.`,
          currentValue: incomeStatement.totalRevenue,
          expectedValue: summary.totalRevenue,
          difference: revDiff.toNumber(),
        });
      }
      if (expDiff.greaterThan(0.01)) {
        issues.push({
          type: 'expense_mismatch',
          severity: 'critical',
          description: `Total expense disagrees between the Income Statement (${incomeStatement.totalExpense.toFixed(2)}) and the Financial Summary (${summary.totalExpense.toFixed(2)}) by ${expDiff.toFixed(2)}.`,
          currentValue: incomeStatement.totalExpense,
          expectedValue: summary.totalExpense,
          difference: expDiff.toNumber(),
        });
      }
    } catch (err) {
      logger.error({ err: errDetails(err) }, 'AiReconciliationService: checkIncomeExpenseMismatch failed');
    }
    return issues;
  }

  /** Assets = Liabilities + Equity, read from the already-computed epsilon-tolerant flag. */
  private static async checkBalanceSheetEquation(summary: FinancialSummaryTotals): Promise<IntegrityIssue[]> {
    if (summary.isEquationBalanced) return [];
    const totalLE = summary.totalLiabilities + summary.totalEquity;
    const diff = new Prisma.Decimal(summary.totalAssets).minus(totalLE).abs();
    return [
      {
        type: 'balance_sheet_equation_mismatch',
        severity: 'critical',
        description: `Assets (${summary.totalAssets.toFixed(2)}) do not equal Liabilities + Equity (${totalLE.toFixed(2)}); difference ${diff.toFixed(2)}.`,
        currentValue: summary.totalAssets,
        expectedValue: totalLE,
        difference: diff.toNumber(),
      },
    ];
  }
}
