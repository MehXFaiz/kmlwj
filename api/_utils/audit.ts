import { prisma } from '../_prisma.js';

export interface AuditTrailOptions {
  userId?: string | null;
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
        userAgent
      };
    }

    const effectiveUserId = options.userId || options.createdById || options.updatedById || options.deletedById || options.approvedById || options.postedById || options.reversedById || null;
    const validUserId = (effectiveUserId && typeof effectiveUserId === 'string' && effectiveUserId.length === 36) ? effectiveUserId : null;

    const enrichedOldValues = {
      ...(options.oldValues && typeof options.oldValues === 'object' ? options.oldValues : { value: options.oldValues ?? null }),
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
      reason: options.reason || null
    };

    const enrichedNewValues = {
      ...(options.newValues && typeof options.newValues === 'object' ? options.newValues : { value: options.newValues ?? null }),
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
      reason: options.reason || null
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
