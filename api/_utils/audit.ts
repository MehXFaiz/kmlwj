import { prisma } from '../_prisma.js';

export interface AuditTrailOptions {
  userId?: string | null;
  userRole?: string | null;
  recordId?: string | null;
  modelName?: string | null;
  action: string;
  module: string;
  createdById?: string | null;
  createdAt?: Date | string | null;
  updatedById?: string | null;
  updatedAt?: Date | string | null;
  deletedById?: string | null;
  deletedAt?: Date | string | null;
  approvedById?: string | null;
  approvedAt?: Date | string | null;
  postedById?: string | null;
  postedAt?: Date | string | null;
  reversedById?: string | null;
  reversedAt?: Date | string | null;
  reason?: string | null;
  requestSource?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  oldValues?: any;
  newValues?: any;
}

export async function logAudit(
  userIdOrOptions: string | null | AuditTrailOptions,
  action?: string,
  module?: string,
  oldValues?: any,
  newValues?: any,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    let options: AuditTrailOptions;

    if (typeof userIdOrOptions === 'object' && userIdOrOptions !== null) {
      options = userIdOrOptions;
    } else {
      options = {
        userId: userIdOrOptions,
        action: action || 'UNKNOWN_ACTION',
        module: module || 'SYSTEM',
        oldValues,
        newValues,
        ipAddress,
        userAgent,
      };
    }

    const effectiveUserId =
      options.userId ||
      options.createdById ||
      options.updatedById ||
      options.deletedById ||
      options.approvedById ||
      options.postedById ||
      options.reversedById ||
      null;
    const validUserId =
      effectiveUserId && typeof effectiveUserId === 'string' && effectiveUserId.length === 36
        ? effectiveUserId
        : null;

    const inferredRecordId =
      options.recordId ||
      options.oldValues?.id ||
      options.newValues?.id ||
      null;

    const enrichedOldValues = {
      ...(options.oldValues && typeof options.oldValues === 'object'
        ? options.oldValues
        : { value: options.oldValues ?? null }),
      recordId: inferredRecordId,
      modelName: options.modelName || options.module || null,
      userRole: options.userRole || null,
      requestSource: options.requestSource || null,
      createdById: options.createdById || null,
      createdAt: options.createdAt || null,
      updatedById: options.updatedById || null,
      updatedAt: options.updatedAt || null,
      deletedById: options.deletedById || null,
      deletedAt: options.deletedAt || null,
      approvedById: options.approvedById || null,
      approvedAt: options.approvedAt || null,
      postedById: options.postedById || null,
      postedAt: options.postedAt || null,
      reversedById: options.reversedById || null,
      reversedAt: options.reversedAt || null,
      reason: options.reason || null,
    };

    const enrichedNewValues = {
      ...(options.newValues && typeof options.newValues === 'object'
        ? options.newValues
        : { value: options.newValues ?? null }),
      recordId: inferredRecordId,
      modelName: options.modelName || options.module || null,
      userRole: options.userRole || null,
      requestSource: options.requestSource || null,
      createdById: options.createdById || validUserId,
      createdAt: options.createdAt || new Date().toISOString(),
      updatedById: options.updatedById || null,
      updatedAt: options.updatedAt || null,
      deletedById: options.deletedById || null,
      deletedAt: options.deletedAt || null,
      approvedById: options.approvedById || null,
      approvedAt: options.approvedAt || null,
      postedById: options.postedById || null,
      postedAt: options.postedAt || null,
      reversedById: options.reversedById || null,
      reversedAt: options.reversedAt || null,
      reason: options.reason || null,
    };

    try {
      await prisma.auditLog.create({
        data: {
          userId: validUserId,
          action: options.action,
          module: options.module,
          oldValues: enrichedOldValues,
          newValues: enrichedNewValues,
          ipAddress: options.ipAddress || null,
          userAgent: options.userAgent || null,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2003' && validUserId) {
        await prisma.auditLog.create({
          data: {
            userId: null,
            action: options.action,
            module: options.module,
            oldValues: enrichedOldValues,
            newValues: enrichedNewValues,
            ipAddress: options.ipAddress || null,
            userAgent: options.userAgent || null,
          },
        });
      } else {
        console.error('Failed to log audit:', err);
      }
    }
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

export interface DeletionAuditParams {
  req?: any;
  userId?: string | null;
  userRole?: string | null;
  recordId: string | string[];
  modelName: string;
  module: string;
  actionType:
    | 'SOFT_DELETE'
    | 'RESTORE'
    | 'PERMANENT_DELETE'
    | 'DELETE_FAILED'
    | 'UNAUTHORIZED_DELETE_ATTEMPT';
  actionLabel?: string;
  previousState?: any;
  newState?: any;
  reason?: string | null;
  requestSource?: string | null;
}

/**
 * Centralized audit logger specifically for Soft Deletions, Restorations,
 * Permanent Deletions, Failed Deletion Attempts, and Unauthorized Deletion Attempts.
 */
export async function logDeletionAudit(params: DeletionAuditParams) {
  const req = params.req;
  const userId = params.userId ?? req?.user?.id ?? null;
  const userRole = params.userRole ?? req?.user?.role ?? null;
  const ipAddress =
    (req?.headers?.['x-forwarded-for'] as string) ||
    req?.socket?.remoteAddress ||
    null;
  const userAgent = (req?.headers?.['user-agent'] as string) || null;
  const requestSource =
    params.requestSource ||
    (req ? `${req.method || 'API'} ${req.url || ''}`.trim() : 'SYSTEM');
  const recordIdStr = Array.isArray(params.recordId)
    ? params.recordId.join(',')
    : String(params.recordId || '');
  const nowIso = new Date().toISOString();

  await logAudit({
    userId,
    userRole,
    recordId: recordIdStr,
    modelName: params.modelName,
    action: params.actionLabel || `${params.actionType}: ${params.modelName}`,
    module: params.module,
    deletedById:
      params.actionType === 'SOFT_DELETE' || params.actionType === 'PERMANENT_DELETE'
        ? userId
        : null,
    deletedAt:
      params.actionType === 'SOFT_DELETE' || params.actionType === 'PERMANENT_DELETE'
        ? nowIso
        : null,
    reason: params.reason || null,
    requestSource,
    ipAddress,
    userAgent,
    oldValues: {
      recordId: params.recordId,
      modelName: params.modelName,
      auditEventType: params.actionType,
      userRole,
      requestSource,
      reason: params.reason || null,
      ...(params.previousState && typeof params.previousState === 'object'
        ? params.previousState
        : { previousState: params.previousState ?? null }),
    },
    newValues: {
      recordId: params.recordId,
      modelName: params.modelName,
      auditEventType: params.actionType,
      userRole,
      requestSource,
      reason: params.reason || null,
      timestamp: nowIso,
      ...(params.newState && typeof params.newState === 'object'
        ? params.newState
        : { newState: params.newState ?? null }),
    },
  });
}
