import { prisma } from '../_prisma.js';

interface NotificationInput {
  title: string;
  message: string;
  module: string;
  recordId?: string | number | null;
  actionType: string;
  userName: string;
  userRole: string;
  userId?: string | null;
  visibility?: 'ALL' | 'ADMIN_ONLY' | 'SUPER_ADMIN_ONLY';
}

/**
 * Fire-and-forget notification creation. Never throws — a failed notification
 * must never break the business transaction that triggered it.
 */
export async function createNotification({
  title,
  message,
  module,
  recordId,
  actionType,
  userName,
  userRole,
  userId,
  visibility = 'ALL',
}: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        title,
        message,
        module,
        recordId: recordId ? String(recordId) : null,
        actionType,
        userName,
        userRole,
        userId: userId || null,
        visibility,
      },
    });
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}
