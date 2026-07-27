
import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { AccountingService } from './accounting.service.js';

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

    for (const account of accounts) {
      const aggregations = await prisma.journalEntryLine.aggregate({
        where: { accountId: account.id, journalEntry: { status: 'Posted' } },
        _sum: { debit: true, credit: true },
      });

      const totalDebit = new Prisma.Decimal(aggregations._sum.debit ?? 0);
      const totalCredit = new Prisma.Decimal(aggregations._sum.credit ?? 0);
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
}
