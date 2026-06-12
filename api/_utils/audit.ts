import { prisma } from '../_prisma.js';

export async function logAudit(
  userId: string | null,
  action: string,
  module: string,
  oldValues?: any,
  newValues?: any,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        oldValues: oldValues || null,
        newValues: newValues || null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
