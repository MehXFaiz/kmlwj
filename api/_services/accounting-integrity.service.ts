
import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';
import { AccountingService, POSTED_JOURNAL_FILTER, classifyError, errDetails, type RepairItem } from './accounting.service.js';

export interface IntegrityIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  item?: {
    id?: string;
    glCode?: string;
    name?: string;
    reference?: string;
  };
}

export interface IntegrityCheckResult {
  timestamp: Date;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issues: IntegrityIssue[];
}

export class AccountingIntegrityService {
  /**
   * Automatic reconciliation and healing for cached balance drift
   */
  static async reconcileAll(): Promise<{ fixedAccountsCount: number; issueCount: number }> {
    const checkResult = await this.runFullCheck();
    await AccountingService.recalculateAllBalances();
    return {
      fixedAccountsCount: checkResult.issues.filter(i => i.type === 'cached_balance_drift').length,
      issueCount: checkResult.totalIssues
    };
  }

  /**
   * Comprehensive integrity check for the entire accounting system
   */
  static async runFullCheck(): Promise<IntegrityCheckResult> {
    const issues: IntegrityIssue[] = [];

    // Run all checks
    issues.push(...(await this.checkDuplicateGLCodes()));
    issues.push(...(await this.checkWrongParentAssignment()));
    issues.push(...(await this.checkWrongAccountNature()));
    issues.push(...(await this.checkWrongGLSeries()));
    issues.push(...(await this.checkMissingGLCodes()));
    issues.push(...(await this.checkBrokenHierarchy()));
    issues.push(...(await this.checkOrphanAccounts()));
    issues.push(...(await this.checkInvalidJournalReferences()));
    issues.push(...(await this.checkTrialBalanceMismatch()));
    issues.push(...(await this.checkCachedBalanceDrift()));

    // Calculate counts
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    return {
      timestamp: new Date(),
      totalIssues: issues.length,
      criticalCount,
      warningCount,
      infoCount,
      issues,
    };
  }

  /**
   * Check 1: Duplicate GL Codes
   */
  private static async checkDuplicateGLCodes(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const glCodeCounts = await prisma.account.groupBy({
      by: ['glCode'],
      having: {
        id: {
          _count: {
            gt: 1,
          },
        },
      },
      _count: {
        id: true,
      },
    });

    for (const group of glCodeCounts) {
      issues.push({
        type: 'duplicate_gl_code',
        severity: 'critical',
        description: `GL Code ${group.glCode} appears ${group._count.id} times (should be unique)`,
        item: {
          glCode: group.glCode,
        },
      });
    }

    return issues;
  }

  /**
   * Check 2: Wrong Parent Assignment (circular references, invalid levels)
   */
  private static async checkWrongParentAssignment(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const accounts = await prisma.account.findMany({
      include: {
        parent: true,
      },
    });

    // Check for circular references
    for (const account of accounts) {
      const visited = new Set<string>();
      let current: any = account;

      while (current) {
        if (visited.has(current.id)) {
          issues.push({
            type: 'circular_reference',
            severity: 'critical',
            description: `Account ${current.glCode} - ${current.accountName} is part of a circular parent reference chain`,
            item: {
              id: account.id,
              glCode: account.glCode,
              name: account.accountName,
            },
          });
          break;
        }
        visited.add(current.id);
        current = current.parent;
      }
    }

    // Check for invalid level hierarchy
    const levelOrder = ['MAIN', 'PARENT', 'SUBSIDIARY', 'GL'];
    for (const account of accounts) {
      if (account.parent) {
        const accountLevelIndex = levelOrder.indexOf(account.accountLevel);
        const parentLevelIndex = levelOrder.indexOf(account.parent.accountLevel);

        if (accountLevelIndex <= parentLevelIndex) {
          issues.push({
            type: 'invalid_hierarchy_level',
            severity: 'warning',
            description: `Account ${account.glCode} (${account.accountLevel}) has parent ${account.parent.glCode} (${account.parent.accountLevel}) - child should be lower in hierarchy`,
            item: {
              id: account.id,
              glCode: account.glCode,
              name: account.accountName,
            },
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check 3: Wrong Account Nature (account type vs GL code prefix)
   */
  private static async checkWrongAccountNature(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const prefixRules = [
      { prefix: '1', expectedType: 'ASSET' },
      { prefix: '2', expectedType: 'LIABILITY' },
      { prefix: '3', expectedType: 'REVENUE' },
      { prefix: '4', expectedType: 'EXPENSE' },
    ];

    const accounts = await prisma.account.findMany({
      include: {
        accountType: true,
      },
    });

    for (const account of accounts) {
      for (const rule of prefixRules) {
        if (account.glCode.startsWith(rule.prefix)) {
          if (!account.accountType) {
            issues.push({
              type: 'missing_account_type',
              severity: 'warning',
              description: `Account ${account.glCode} - ${account.accountName} has no account type assigned`,
              item: {
                id: account.id,
                glCode: account.glCode,
                name: account.accountName,
              },
            });
          } else if (account.accountType.name.toUpperCase() !== rule.expectedType) {
            issues.push({
              type: 'wrong_account_type',
              severity: 'critical',
              description: `Account ${account.glCode} - ${account.accountName} is type ${account.accountType.name} but should be ${rule.expectedType}`,
              item: {
                id: account.id,
                glCode: account.glCode,
                name: account.accountName,
              },
            });
          }
          break;
        }
      }
    }

    return issues;
  }

  /**
   * Check 4: Wrong GL Series (invalid prefix or length)
   */
  private static async checkWrongGLSeries(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const validPrefixes = ['1', '2', '3', '4'];
    const validLength = 7;

    const accounts = await prisma.account.findMany();

    for (const account of accounts) {
      // Check length
      if (account.glCode.length !== validLength) {
        issues.push({
          type: 'invalid_gl_length',
          severity: 'warning',
          description: `GL Code ${account.glCode} has length ${account.glCode.length} (expected ${validLength})`,
          item: {
            id: account.id,
            glCode: account.glCode,
            name: account.accountName,
          },
        });
      }

      // Check prefix
      const hasValidPrefix = validPrefixes.some(prefix => account.glCode.startsWith(prefix));
      if (!hasValidPrefix) {
        issues.push({
          type: 'invalid_gl_prefix',
          severity: 'critical',
          description: `GL Code ${account.glCode} has invalid prefix (should start with 1, 2, 3, or 4)`,
          item: {
            id: account.id,
            glCode: account.glCode,
            name: account.accountName,
          },
        });
      }
    }

    return issues;
  }

  /**
   * Check 5: Missing GL Codes (revenue/expense heads without linked accounts)
   */
  private static async checkMissingGLCodes(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const revenueHeads = await prisma.revenueHead.findMany();
    const expenseHeads = await prisma.expenseHead.findMany();

    // Check revenue heads
    for (const rh of revenueHeads) {
      if (!rh.accountId) {
        issues.push({
          type: 'revenue_head_missing_account',
          severity: 'warning',
          description: `Revenue Head "${rh.name}" (${rh.category}) has no linked GL account`,
          item: {
            id: rh.id,
            name: rh.name,
          },
        });
      }
    }

    // Check expense heads
    for (const eh of expenseHeads) {
      if (!eh.accountId) {
        issues.push({
          type: 'expense_head_missing_account',
          severity: 'warning',
          description: `Expense Head "${eh.name}" (${eh.category}) has no linked GL account`,
          item: {
            id: eh.id,
            name: eh.name,
          },
        });
      }
    }

    return issues;
  }

  /**
   * Check 6: Broken Hierarchy (accounts with parent IDs that don't exist)
   */
  private static async checkBrokenHierarchy(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const accounts = await prisma.account.findMany();
    const accountIds = new Set(accounts.map(a => a.id));

    for (const account of accounts) {
      if (account.parentId && !accountIds.has(account.parentId)) {
        issues.push({
          type: 'broken_hierarchy',
          severity: 'critical',
          description: `Account ${account.glCode} - ${account.accountName} references non-existent parent`,
          item: {
            id: account.id,
            glCode: account.glCode,
            name: account.accountName,
          },
        });
      }
    }

    return issues;
  }

  /**
   * Check 7: Orphan Accounts (accounts not in use anywhere)
   */
  private static async checkOrphanAccounts(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const accounts = await prisma.account.findMany({
      include: {
        journalEntryLines: true,
        revenueHeads: true,
        expenseHeads: true,
      },
    });

    for (const account of accounts) {
      const hasJournalLines = account.journalEntryLines.length > 0;
      const hasRevenueHeads = account.revenueHeads.length > 0;
      const hasExpenseHeads = account.expenseHeads.length > 0;
      const isLeaf = account.accountLevel === 'GL' || account.accountLevel === 'SUBSIDIARY';

      if (isLeaf && !hasJournalLines && !hasRevenueHeads && !hasExpenseHeads) {
        issues.push({
          type: 'orphan_account',
          severity: 'info',
          description: `Account ${account.glCode} - ${account.accountName} appears to be unused`,
          item: {
            id: account.id,
            glCode: account.glCode,
            name: account.accountName,
          },
        });
      }
    }

    return issues;
  }

  /**
   * Check 8: Invalid Journal References (journal lines referencing non-existent accounts)
   */
  private static async checkInvalidJournalReferences(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const journalLines = await prisma.journalEntryLine.findMany({
      include: {
        journalEntry: true,
      },
    });

    const accounts = await prisma.account.findMany();
    const accountIds = new Set(accounts.map(a => a.id));

    for (const line of journalLines) {
      if (!accountIds.has(line.accountId)) {
        issues.push({
          type: 'invalid_journal_account',
          severity: 'critical',
          description: `Journal Entry Line for voucher ${line.journalEntry.voucherNo} references non-existent account`,
          item: {
            id: line.id,
            reference: line.journalEntry.voucherNo,
          },
        });
      }
    }

    return issues;
  }

  /**
   * Check 10: Trial Balance Mismatch (debits != credits)
   */
  private static async checkTrialBalanceMismatch(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const aggregations = await prisma.journalEntryLine.aggregate({
      where: {
        journalEntry: {
          status: 'Posted',
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebit = new Prisma.Decimal(aggregations._sum.debit ?? 0);
    const totalCredit = new Prisma.Decimal(aggregations._sum.credit ?? 0);
    const difference = totalDebit.minus(totalCredit).abs();

    if (!totalDebit.equals(totalCredit)) {
      issues.push({
        type: 'trial_balance_mismatch',
        severity: 'critical',
        description: `Trial Balance mismatch! Total Debits: ${totalDebit.toFixed(2)}, Total Credits: ${totalCredit.toFixed(2)}, Difference: ${difference.toFixed(2)}`,
      });
    }

    return issues;
  }

  /**
   * Check 11: Cached Balance Drift (Account.currentBalance vs recomputed from
   * posted JournalEntryLine rows)
   *
   * SQA fix: Check 10 (Trial Balance Mismatch) only verifies that global
   * debits equal global credits — it can never catch a single account whose
   * *cached* currentBalance has silently diverged from what its own posted
   * ledger lines actually sum to (e.g. from a missed decrement, or a partial
   * failure outside a transaction), because the underlying JournalEntryLine
   * data can still be globally balanced even while one account's cached field
   * is wrong. This check recomputes each account's expected balance using the
   * exact same formula as AccountingService.recalculateAccountBalance (read-
   * only here — it does not write) and flags any divergence, since
   * currentBalance is what Trial Balance, Balance Sheet, and the no-date-
   * filter General Ledger actually read.
   */
  private static async checkCachedBalanceDrift(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    const accounts = await prisma.account.findMany({
      where: { accountLevel: { in: ['GL', 'SUBSIDIARY'] } },
      include: { accountType: true },
    });

    // One grouped aggregate for every account instead of one aggregate query
    // per account (this loop previously issued N+1 queries — on a ledger with
    // hundreds of GL/SUBSIDIARY accounts that's hundreds of round-trips).
    // Same predicate as recalculateAccountBalance and getPostedAggregates.
    // This previously omitted `isDeleted`, so the checker agreed with a
    // stale cache while both disagreed with every financial report — drift
    // that reports showed but the integrity page could not see.
    const sums = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: { accountId: { in: accounts.map((a) => a.id) }, journalEntry: POSTED_JOURNAL_FILTER },
      _sum: { debit: true, credit: true },
    });
    const sumsByAccountId = new Map(sums.map((s) => [s.accountId, s._sum]));

    for (const account of accounts) {
      const aggregations = sumsByAccountId.get(account.id);

      const totalDebit = new Prisma.Decimal(aggregations?.debit ?? 0);
      const totalCredit = new Prisma.Decimal(aggregations?.credit ?? 0);
      const initialBalance = new Prisma.Decimal(account.initialBalance ?? 0);

      const typeName = account.accountType?.name?.toUpperCase() || 'ASSET';
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(typeName);

      const expectedBalance = isDebitNormal
        ? initialBalance.plus(totalDebit).minus(totalCredit)
        : initialBalance.plus(totalCredit).minus(totalDebit);

      const storedBalance = new Prisma.Decimal(account.currentBalance ?? 0);
      const drift = expectedBalance.minus(storedBalance).abs();

      if (!expectedBalance.equals(storedBalance)) {
        issues.push({
          type: 'cached_balance_drift',
          severity: 'warning',
          description: `Account ${account.glCode} - ${account.accountName} has a stored balance of ${storedBalance.toFixed(2)} but its posted ledger lines compute to ${expectedBalance.toFixed(2)} (drift: ${drift.toFixed(2)}). Re-run balance recalculation for this account.`,
          item: {
            id: account.id,
            glCode: account.glCode,
            name: account.accountName,
          },
        });
      }
    }

    return issues;
  }

  /**
   * Complete, permanent automated repair for all accounting health issues.
   * Normalizes GL Codes to 7 digits, eliminates duplicate codes, repairs missing category/head account mappings,
   * cleans orphan lines, and recalculates stored account balances directly from the General Ledger.
   *
   * Design: every account/category/head/line is repaired in its own isolated
   * step (single-statement Prisma writes are already atomic per item; the
   * multi-step category/head linking and journal healing isolate themselves
   * internally — see AccountingService.ensureCategoryAndHeadGLAccounts /
   * healJournalEntryAccounts). One item's failure is caught, logged in full
   * (SQL/Prisma error, code, meta, stack, the specific account id/GL code),
   * classified into a short plain-English reason, and recorded in `skipped`
   * — every other item still gets attempted. Nothing throws out of this
   * method for a single bad account; only a total infrastructure failure
   * (e.g. the DB connection itself dropping) can still throw, and even that
   * is fully logged before it propagates. The final balance rebuild
   * (Step 6) is the one genuinely batch, thousands-of-accounts-in-seconds
   * operation — a single set-based SQL UPDATE — kept exactly as-is.
   */
  static async repairAll(): Promise<{
    success: boolean;
    actionsTaken: string[];
    accountsChecked: number;
    accountsRepaired: number;
    accountsSkipped: number;
    warningsFixed: number;
    executionTimeMs: number;
    repairedItems: RepairItem[];
    skippedItems: RepairItem[];
    checkBefore: IntegrityCheckResult;
    checkAfter: IntegrityCheckResult;
  }> {
    const startedAt = Date.now();
    const checkBefore = await this.runFullCheck();
    const actionsTaken: string[] = [];
    const repairedItems: RepairItem[] = [];
    const skippedItems: RepairItem[] = [];

    // Step 1 — Repair invalid GL code lengths (ensure every GL Code is exactly
    // 7 digits). One account at a time: a collision this account's new code
    // can't resolve doesn't stop the rest of the chart of accounts.
    const accountsForLengthFix = await prisma.account.findMany();
    for (const acc of accountsForLengthFix) {
      if (acc.glCode.length === 7 && /^\d{7}$/.test(acc.glCode)) continue;
      try {
        let newCode = acc.glCode.replace(/\D/g, '');
        if (newCode.length < 7) {
          newCode = newCode.padEnd(7, '0');
        } else if (newCode.length > 7) {
          newCode = newCode.slice(0, 7);
        }
        if (!/^\d{7}$/.test(newCode)) {
          const prefix = acc.glCode.startsWith('2') ? '20' : acc.glCode.startsWith('3') ? '30' : acc.glCode.startsWith('4') ? '40' : '10';
          newCode = `${prefix}00000`.slice(0, 7);
        }
        while (await prisma.account.findFirst({ where: { glCode: newCode, id: { not: acc.id } } })) {
          const num = parseInt(newCode) + 1;
          newCode = String(num).padStart(7, '0');
        }
        await prisma.account.update({ where: { id: acc.id }, data: { glCode: newCode } });
        const action = `Corrected GL Code for "${acc.accountName}" from "${acc.glCode}" to 7-digit "${newCode}"`;
        actionsTaken.push(action);
        repairedItems.push({ id: acc.id, glCode: newCode, name: acc.accountName, action });
      } catch (err: any) {
        logger.error({ err: errDetails(err), accountId: acc.id, glCode: acc.glCode }, 'Auto-repair: failed to normalize GL Code length');
        const reason = classifyError(err);
        actionsTaken.push(`✘ GL Code ${acc.glCode} (${acc.accountName}) — Reason: Invalid GL Length, repair failed: ${reason}`);
        skippedItems.push({ id: acc.id, glCode: acc.glCode, name: acc.accountName, reason });
      }
    }

    // Step 2 — Resolve duplicate GL codes, one collision at a time.
    const allAccounts = await prisma.account.findMany({ orderBy: { createdAt: 'asc' } });
    const seenGlCodes = new Set<string>();
    for (const acc of allAccounts) {
      if (!seenGlCodes.has(acc.glCode)) {
        seenGlCodes.add(acc.glCode);
        continue;
      }
      try {
        let num = parseInt(acc.glCode) + 1;
        let newCode = String(num).padStart(7, '0');
        while (await prisma.account.findFirst({ where: { glCode: newCode } }) || seenGlCodes.has(newCode)) {
          num++;
          newCode = String(num).padStart(7, '0');
        }
        await prisma.account.update({ where: { id: acc.id }, data: { glCode: newCode } });
        seenGlCodes.add(newCode);
        const action = `Reassigned duplicate GL Code for "${acc.accountName}" to unique "${newCode}"`;
        actionsTaken.push(action);
        repairedItems.push({ id: acc.id, glCode: newCode, name: acc.accountName, action });
      } catch (err: any) {
        logger.error({ err: errDetails(err), accountId: acc.id, glCode: acc.glCode }, 'Auto-repair: failed to resolve duplicate GL Code');
        const reason = classifyError(err);
        actionsTaken.push(`✘ GL Code ${acc.glCode} (${acc.accountName}) — Reason: Duplicate GL Code, repair failed: ${reason}`);
        skippedItems.push({ id: acc.id, glCode: acc.glCode, name: acc.accountName, reason });
      }
    }

    // Step 3 — Ensure every Income Category & Expense Head has a linked GL
    // Account (already isolates per-item internally).
    const categoryHeadResult = await AccountingService.ensureCategoryAndHeadGLAccounts(prisma);
    repairedItems.push(...categoryHeadResult.repaired);
    skippedItems.push(...categoryHeadResult.skipped);
    if (categoryHeadResult.repaired.length > 0) {
      actionsTaken.push(`Verified and auto-linked GL Accounts for ${categoryHeadResult.repaired.length} Income Categories / Expense Heads`);
    }
    for (const s of categoryHeadResult.skipped) {
      actionsTaken.push(`✘ ${s.name || s.id || 'Unknown item'} — Reason: Ledger Mapping Missing, repair failed: ${s.reason}`);
    }

    // Step 4 — Synchronize historical Journal Entries with specific GL
    // Accounts (already isolates per-record internally).
    const journalHealResult = await AccountingService.healJournalEntryAccounts(prisma);
    repairedItems.push(...journalHealResult.repaired);
    skippedItems.push(...journalHealResult.skipped);
    if (journalHealResult.repaired.length > 0) {
      actionsTaken.push(`Synchronized ${journalHealResult.repaired.length} historical Journal Entry Lines with their specific GL Accounts`);
    }

    // Step 5 — Clean orphan journal entry lines referencing non-existent
    // accounts, one line at a time.
    const validAccountIds = new Set((await prisma.account.findMany({ select: { id: true } })).map(a => a.id));
    const orphanLines = await prisma.journalEntryLine.findMany({ where: { accountId: { notIn: Array.from(validAccountIds) } } });
    for (const line of orphanLines) {
      try {
        const fallbackAcc = await prisma.account.findFirst({ where: { glCode: { startsWith: '40801' } } }) || await prisma.account.findFirst();
        if (!fallbackAcc) {
          throw Object.assign(new Error('No fallback GL Account exists in the Chart of Accounts'), { code: 'NO_FALLBACK' });
        }
        await prisma.journalEntryLine.update({ where: { id: line.id }, data: { accountId: fallbackAcc.id } });
        const action = `Re-linked orphan journal line #${line.id.slice(0, 8)} to GL Account ${fallbackAcc.glCode} (${fallbackAcc.accountName})`;
        actionsTaken.push(action);
        repairedItems.push({ id: line.id, action });
      } catch (err: any) {
        logger.error({ err: errDetails(err), journalEntryLineId: line.id, orphanAccountId: line.accountId }, 'Auto-repair: failed to re-link orphan journal line');
        const reason = classifyError(err);
        actionsTaken.push(`✘ Journal line #${line.id.slice(0, 8)} — Reason: Orphan Account Reference, repair failed: ${reason}`);
        skippedItems.push({ id: line.id, reason });
      }
    }

    // Step 6 — Recalculate stored account balances directly from posted
    // general ledger entries. This is the one genuinely batch step: a single
    // set-based SQL UPDATE covering every posting account in one round trip
    // (AccountingService.rebuildBalanceCache, via recalculateAllBalances),
    // so this scales to thousands of accounts without looping per account.
    let balanceGroups: { label: string; count: number }[] = [];
    try {
      const rebuildResult = await AccountingService.recalculateAllBalances();
      actionsTaken.push(`Recalculated cached currentBalance for ${rebuildResult.updated} accounts directly from posted ledger entries`);

      // Grouped confirmation lines ("✔ Cash In Hand rebuilt", "✔ Bank
      // rebuilt", ...) — the richer per-category detail requirement #9 asks
      // for, without needing a UI change: these are just more strings in the
      // same actionsTaken list the page already renders.
      const rebuiltAccounts = await prisma.account.findMany({
        where: { accountLevel: { in: ['GL', 'SUBSIDIARY'] }, isDeleted: false },
        include: { accountType: true },
      });
      const groups = new Map<string, number>();
      for (const acc of rebuiltAccounts) {
        const detail = (acc.detailType || '').toLowerCase();
        const typeName = (acc.accountType?.name || '').toUpperCase();
        let label: string;
        if (detail === 'cash') label = 'Cash In Hand';
        else if (detail === 'bank') label = 'Bank';
        else if (typeName === 'REVENUE') label = 'Revenue';
        else if (typeName === 'EXPENSE') label = 'Expenses';
        else if (typeName === 'ASSET') label = 'Assets';
        else if (typeName === 'LIABILITY') label = 'Liabilities';
        else if (typeName === 'EQUITY') label = 'Equity';
        else label = 'Other Accounts';
        groups.set(label, (groups.get(label) || 0) + 1);
      }
      balanceGroups = Array.from(groups.entries()).map(([label, count]) => ({ label, count }));
      for (const g of balanceGroups) {
        actionsTaken.push(`✔ ${g.label} rebuilt (${g.count} account${g.count === 1 ? '' : 's'})`);
      }
    } catch (err: any) {
      logger.error({ err: errDetails(err) }, 'Auto-repair: batch balance rebuild failed');
      const reason = classifyError(err);
      actionsTaken.push(`✘ Balance rebuild — Reason: ${reason}`);
      skippedItems.push({ reason, action: 'Batch currentBalance rebuild (Step 6)' });
    }

    const checkAfter = await this.runFullCheck();
    const executionTimeMs = Date.now() - startedAt;

    const accountsChecked = allAccounts.length; // every Chart of Accounts row evaluated by Steps 1/2/6
    const accountsRepaired = repairedItems.length;
    const accountsUpdated = Math.max(repairedItems.length, balanceGroups.reduce((acc, g) => acc + g.count, 0));
    const accountsSkipped = skippedItems.length;
    const warningsFixed = Math.max(0, checkBefore.warningCount - checkAfter.warningCount);

    actionsTaken.unshift(
      `Summary: ${accountsChecked} accounts checked | ${accountsRepaired} repaired | ${accountsSkipped} skipped | ${warningsFixed} warnings fixed | Execution time: ${executionTimeMs}ms`
    );

    if (skippedItems.length > 0) {
      logger.warn({ skippedCount: skippedItems.length, skippedItems }, 'Auto-repair completed with some items skipped — see individual log entries above for full detail on each');
    }
    logger.info({ accountsChecked, accountsRepaired, accountsUpdated, accountsSkipped, warningsFixed, executionTimeMs, issuesBefore: checkBefore.totalIssues, issuesAfter: checkAfter.totalIssues }, 'Auto-repair run complete');

    return {
      success: checkAfter.criticalCount === 0 && checkAfter.warningCount === 0,
      actionsTaken,
      accountsChecked,
      accountsRepaired,
      accountsUpdated,
      accountsSkipped,
      warningsFixed,
      executionTimeMs,
      repairedItems,
      skippedItems,
      checkBefore,
      checkAfter
    };
  }
}

