import { Prisma } from '@prisma/client';
import { prisma } from '../_prisma.js';
import { logger } from '../_utils/logger.js';
import { logAudit } from '../_utils/audit.js';
import { AccountingSyncService } from './accounting-sync.service.js';
import { AccountingBalanceRebuildService } from './accounting-balance-rebuild.service.js';
import { POSTED_JOURNAL_FILTER, errDetails } from './accounting.service.js';
import { getRepairOperation, type RepairOperation } from './repair-operations.registry.js';

const TX_OPTIONS = { timeout: 120000, maxWait: 30000 };
const EPSILON = 0.01;

export class RepairInProgressError extends Error {
  status = 409;
  constructor() {
    super('Another repair is already in progress. Please try again shortly.');
  }
}

export class RepairNotActionableError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
  }
}

export class RepairValidationFailedError extends Error {
  details: Record<string, any>;
  constructor(message: string, details: Record<string, any>) {
    super(message);
    this.details = details;
  }
}

export interface ApplyRepairResult {
  success: boolean;
  issueId: string;
  repairType: string;
  logId?: string;
  errorMessage?: string;
}

/**
 * Executes one repair operation for one AiRepairIssue, entirely inside a
 * single Postgres transaction: re-confirms the issue, runs the fixed
 * operation, re-validates the two hard invariants (debits=credits,
 * Assets=Liabilities+Equity), and only commits if both hold — otherwise
 * throws, which Prisma turns into a full rollback (the only correct
 * "undo" for an already-attempted write). On success the AiRepairLog row
 * is written inside the same transaction so it commits atomically with
 * the repair; on failure a new log row is written afterward, separately,
 * documenting the rollback.
 */
export async function applyRepair(
  issueId: string,
  opts: { approvedById?: string | null; mode: 'auto' | 'manual' }
): Promise<ApplyRepairResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const issue = await tx.aiRepairIssue.findUnique({ where: { id: issueId } });
      if (!issue) throw new RepairNotActionableError('Issue not found.');
      if (!['OPEN', 'ANALYZED', 'PENDING_APPROVAL'].includes(issue.status)) {
        throw new RepairNotActionableError(`Issue is already ${issue.status.toLowerCase()} — nothing to repair.`);
      }

      const op: RepairOperation | null = getRepairOperation(issue.aiProposedRepairType);
      if (!op || !op.execute) {
        throw new RepairNotActionableError('No safe automated repair is registered for this issue type. Admin review required.');
      }
      if (opts.mode === 'auto' && !(op.autoExecutable && op.maxRiskLevel === 'LOW')) {
        throw new RepairNotActionableError(`${op.key} is not eligible for automatic repair (risk ceiling: ${op.maxRiskLevel}).`);
      }
      if (opts.mode === 'manual' && !opts.approvedById) {
        throw new RepairNotActionableError('Manual repair requires an approving Admin.');
      }

      const params = op.resolveParams(issue as any);
      if (!params) {
        throw new RepairNotActionableError('Could not resolve the record(s) this repair needs to act on — the issue may be stale. Re-run Full Audit and try again.');
      }

      const beforeCheck = await checkCoreInvariants(tx);

      await op.execute(tx, params, opts.approvedById ?? undefined);

      const afterCheck = await checkCoreInvariants(tx);
      if (!afterCheck.debitsEqualCredits || !afterCheck.equationBalanced) {
        throw new RepairValidationFailedError('Post-repair validation failed — debits/credits or the accounting equation no longer balance.', {
          before: beforeCheck,
          after: afterCheck,
        });
      }

      const logRow = await tx.aiRepairLog.create({
        data: {
          issueId: issue.id,
          userId: opts.approvedById ?? null,
          action: opts.mode === 'auto' ? 'AUTO_REPAIR_APPLIED' : 'MANUAL_REPAIR_APPLIED',
          issueType: issue.type,
          repairType: op.key,
          rootCause: issue.aiRootCause,
          aiRecommendation: issue.aiProposedChange ?? Prisma.JsonNull,
          oldValue: { currentValue: issue.currentValue, description: issue.description },
          newValue: { expectedValue: issue.expectedValue, appliedOperation: op.label },
          affectedRecords: issue.affectedRecords ?? Prisma.JsonNull,
          riskLevel: op.maxRiskLevel,
          approvalStatus: opts.mode === 'auto' ? 'AUTO_APPROVED_LOW_RISK' : 'ADMIN_APPROVED',
          approvedById: opts.approvedById ?? null,
          beforeCheckResult: beforeCheck,
          afterCheckResult: afterCheck,
          rollbackStatus: 'NOT_NEEDED',
          success: true,
        },
      });

      await tx.aiRepairIssue.update({
        where: { id: issue.id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });

      return { issue, op, logId: logRow.id };
    }, TX_OPTIONS);

    try {
      await logAudit({
        userId: opts.approvedById ?? null,
        action: `AI Repair Applied: ${result.op.label} (${result.issue.type})`,
        module: 'AI Accounting Health',
        approvedById: opts.approvedById ?? null,
        approvedAt: new Date().toISOString(),
        oldValues: { issueId: result.issue.id, type: result.issue.type },
        newValues: { repairType: result.op.key, mode: opts.mode },
      });
      AccountingSyncService.emitSyncEvent({ action: 'UPDATE', module: 'AI Accounting Health', recordId: result.issue.id, userId: opts.approvedById ?? null });
    } catch {
      // logAudit/emitSyncEvent are already best-effort by design — never let
      // this secondary bookkeeping affect a repair that already succeeded.
    }

    return { success: true, issueId, repairType: result.op.key, logId: result.logId };
  } catch (err: any) {
    if (err instanceof RepairInProgressError) throw err;
    if (err instanceof RepairNotActionableError) throw err;

    logger.error({ err: errDetails(err) }, `applyRepair failed for issue ${issueId}`);

    const details = err instanceof RepairValidationFailedError ? err.details : { error: errDetails(err) };
    let repairType = 'UNKNOWN';
    try {
      const issue = await prisma.aiRepairIssue.findUnique({ where: { id: issueId } });
      repairType = issue?.aiProposedRepairType || 'UNKNOWN';
      await prisma.aiRepairLog.create({
        data: {
          issueId,
          userId: opts.approvedById ?? null,
          action: 'REPAIR_ROLLED_BACK',
          issueType: issue?.type || 'UNKNOWN',
          repairType,
          rootCause: issue?.aiRootCause ?? null,
          riskLevel: issue ? (getRepairOperation(issue.aiProposedRepairType)?.maxRiskLevel ?? 'CRITICAL') : 'CRITICAL',
          approvalStatus: opts.mode === 'auto' ? 'AUTO_APPROVED_LOW_RISK' : 'ADMIN_APPROVED',
          approvedById: opts.approvedById ?? null,
          beforeCheckResult: details.before ?? undefined,
          afterCheckResult: details.after ?? undefined,
          rollbackStatus: 'ROLLED_BACK',
          success: false,
          errorMessage: err?.message || 'Unknown error',
        },
      });
    } catch (logErr) {
      logger.error({ err: errDetails(logErr) }, `applyRepair: failed to write failure log for issue ${issueId}`);
    }

    return { success: false, issueId, repairType, errorMessage: err?.message || 'Repair failed and was rolled back.' };
  }
}

async function checkCoreInvariants(tx: any): Promise<{ debitsEqualCredits: boolean; totalDebit: number; totalCredit: number; equationBalanced: boolean; totalAssets: number; totalLiabilitiesAndEquity: number }> {
  const agg = await tx.journalEntryLine.aggregate({
    where: { journalEntry: POSTED_JOURNAL_FILTER },
    _sum: { debit: true, credit: true },
  });
  const totalDebit = new Prisma.Decimal(agg._sum.debit ?? 0);
  const totalCredit = new Prisma.Decimal(agg._sum.credit ?? 0);
  const debitsEqualCredits = totalDebit.minus(totalCredit).abs().lessThanOrEqualTo(EPSILON);

  const summary = await AccountingBalanceRebuildService.rebuildAllSummaries(tx);
  const totalLiabilitiesAndEquity = summary.totalLiabilities + summary.totalEquity;

  return {
    debitsEqualCredits,
    totalDebit: totalDebit.toNumber(),
    totalCredit: totalCredit.toNumber(),
    equationBalanced: summary.isEquationBalanced,
    totalAssets: summary.totalAssets,
    totalLiabilitiesAndEquity,
  };
}
