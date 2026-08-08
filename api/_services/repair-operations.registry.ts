import { AccountingService } from './accounting.service.js';
import { AccountingBalanceRebuildService } from './accounting-balance-rebuild.service.js';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface IssueLike {
  entityRef: string | null;
  affectedRecords: unknown;
  type: string;
}

/**
 * Fixed registry of repair operations the AI Accounting Auto-Repair system
 * may ever execute. This is the sole safety authority: an AI-proposed
 * `aiRiskLevel` is stored for transparency only and can never promote an
 * operation past its hardcoded `maxRiskLevel`/`autoExecutable` here. Every
 * `execute` function wraps an existing, already-tested AccountingService/
 * AccountingBalanceRebuildService method — nothing here invents a new
 * financial mutation path. `execute: null` means "detect and explain only";
 * the executor will never attempt to run it, regardless of approval.
 */
export interface RepairOperation {
  key: string;
  label: string;
  description: string;
  maxRiskLevel: RiskLevel;
  autoExecutable: boolean;
  applicableIssueTypes: string[];
  resolveParams: (issue: IssueLike) => Record<string, any> | null;
  execute: ((tx: any, params: Record<string, any>, actorId?: string) => Promise<any>) | null;
}

function extractAffectedId(issue: IssueLike, model: string): string | null {
  const records = Array.isArray(issue.affectedRecords) ? (issue.affectedRecords as any[]) : [];
  const match = records.find((r) => r?.model === model);
  return match?.id ?? null;
}

export const REPAIR_OPERATIONS: Record<string, RepairOperation> = {
  REBUILD_ACCOUNT_BALANCE: {
    key: 'REBUILD_ACCOUNT_BALANCE',
    label: 'Rebuild account balance',
    description: "Recomputes this account's cached balance directly from its posted ledger lines.",
    maxRiskLevel: 'LOW',
    autoExecutable: true,
    applicableIssueTypes: ['cached_balance_drift'],
    resolveParams: (issue) => {
      const accountId = extractAffectedId(issue, 'Account');
      return accountId ? { accountId } : null;
    },
    execute: async (tx, params) => {
      await AccountingService.recalculateAccountBalance(tx, params.accountId);
    },
  },

  REBUILD_ALL_BALANCES: {
    key: 'REBUILD_ALL_BALANCES',
    label: 'Rebuild all account balances',
    description: "Recomputes every account's cached balance from posted ledger lines in one batch.",
    maxRiskLevel: 'LOW',
    autoExecutable: true,
    applicableIssueTypes: ['trial_balance_mismatch', 'cached_balance_drift', 'cross_endpoint_cash_mismatch', 'unbalanced_journal_entry'],
    resolveParams: () => ({}),
    execute: async (tx) => {
      await AccountingService.recalculateAllBalances(tx);
    },
  },

  REFRESH_FINANCIAL_SUMMARY: {
    key: 'REFRESH_FINANCIAL_SUMMARY',
    label: 'Refresh financial summary',
    description: 'Rebuilds derived dashboard/report totals (assets, liabilities, equity, cash, bank) from the ledger.',
    maxRiskLevel: 'LOW',
    autoExecutable: true,
    applicableIssueTypes: ['balance_sheet_equation_mismatch', 'income_mismatch', 'expense_mismatch'],
    resolveParams: () => ({}),
    execute: async (tx) => {
      await AccountingBalanceRebuildService.rebuildAllSummaries(tx);
    },
  },

  RELINK_CATEGORY_HEAD_GL: {
    key: 'RELINK_CATEGORY_HEAD_GL',
    label: 'Relink category/head GL mapping',
    description: 'Ensures every income category and expense head has a valid linked GL account.',
    maxRiskLevel: 'LOW',
    autoExecutable: true,
    applicableIssueTypes: ['revenue_head_missing_account', 'expense_head_missing_account'],
    resolveParams: () => ({}),
    execute: async (tx) => {
      await AccountingService.ensureCategoryAndHeadGLAccounts(tx);
    },
  },

  HEAL_JOURNAL_ACCOUNTS: {
    key: 'HEAL_JOURNAL_ACCOUNTS',
    label: 'Heal journal account links',
    description: 'Re-links historical journal lines to the correct GL account where a mapping was fixed after posting.',
    maxRiskLevel: 'LOW',
    autoExecutable: true,
    applicableIssueTypes: ['invalid_journal_account'],
    resolveParams: () => ({}),
    execute: async (tx) => {
      await AccountingService.healJournalEntryAccounts(tx);
    },
  },

  CANCEL_ORPHAN_JOURNAL_ENTRY: {
    key: 'CANCEL_ORPHAN_JOURNAL_ENTRY',
    label: 'Cancel orphaned journal entry',
    description: 'Reverses/cancels a journal entry that is still Posted even though its source transaction was deleted or reverted.',
    maxRiskLevel: 'HIGH',
    autoExecutable: false,
    applicableIssueTypes: ['orphan_posted_journal_for_deleted_source', 'orphan_posted_journal_for_reverted_source'],
    resolveParams: (issue) => {
      const journalEntryId = extractAffectedId(issue, 'JournalEntry');
      return journalEntryId ? { journalEntryId } : null;
    },
    execute: async (tx, params, actorId) => {
      await AccountingService.reverseJournalEntry(
        tx,
        params.journalEntryId,
        actorId,
        'AI-detected orphan posted journal — linked source record was deleted or reverted'
      );
    },
  },
};

export function getRepairOperation(key: string | null | undefined): RepairOperation | null {
  if (!key) return null;
  return REPAIR_OPERATIONS[key] ?? null;
}

/** First operation (by declaration order) whose applicableIssueTypes includes this issue type, if any. */
export function findOperationForIssueType(issueType: string): RepairOperation | null {
  return Object.values(REPAIR_OPERATIONS).find((op) => op.applicableIssueTypes.includes(issueType)) ?? null;
}
