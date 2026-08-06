import { prisma } from '../_prisma.js';
import { AccountingService } from './accounting.service.js';

/**
 * Single, documented entry point for "recalculate cached balances from the
 * posted ledger" — the operation that must run after any transaction is
 * added, edited, deleted, posted, reverted, or repaired, so Dashboard, Trial
 * Balance, General Ledger, Income Statement, Balance Sheet, and Cash Flow
 * never drift apart. This is a thin facade, not a new calculation: all three
 * methods delegate to AccountingService, which already implements the actual
 * SQL (see accounting.service.ts — recalculateBalancesForJournalEntry,
 * recalculateAccountBalance, recalculateAllBalances / rebuildBalanceCache).
 * Route handlers should call BalanceRebuildService rather than reaching into
 * AccountingService's balance methods directly, so every rebuild call site
 * is greppable under one name.
 */
export class BalanceRebuildService {
  /**
   * Call after a single journal entry is created, edited, soft-deleted,
   * restored, or reversed. Recomputes every account that entry's lines
   * touch, from the posted ledger only.
   */
  static forJournalEntry(tx: any, journalEntryId: string): Promise<string[]> {
    return AccountingService.recalculateBalancesForJournalEntry(tx ?? prisma, journalEntryId);
  }

  /**
   * Call after a Chart-of-Accounts-level repair (GL code correction,
   * category/head remapping) that affects one specific account outside the
   * context of a single journal entry.
   */
  static forAccount(tx: any, accountId: string): Promise<number> {
    return AccountingService.recalculateAccountBalance(tx ?? prisma, accountId);
  }

  /**
   * Full rebuild of every posting account's cached balance from the posted
   * ledger — one batch SQL statement, safe to run for thousands of accounts.
   * Used by Accounting Health Check's Auto Repair; also the right call for
   * any future "rebuild everything" action.
   */
  static forEntireChartOfAccounts(tx?: any): Promise<{ updated: number }> {
    return AccountingService.recalculateAllBalances(tx);
  }
}
