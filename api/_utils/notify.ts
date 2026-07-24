import { prisma } from '../_prisma.js';

export type NotificationVisibility = 'ALL' | 'ADMIN_ONLY' | 'SUPER_ADMIN_ONLY';

export interface NotificationInput {
  title: string;
  message: string;
  module: string;
  recordId?: string | number | null;
  actionType: string;
  userName: string;
  userRole: string;
  userId?: string | null;
  visibility?: NotificationVisibility;
}

export interface QuickNotifyInput {
  title: string;
  message: string;
  module: string;
  recordId?: string | number | null;
  actionType: string;
  visibility?: NotificationVisibility;
}

interface RequestLike {
  user?: { id?: string; email?: string; role?: string } | null;
}

const DEDUPE_WINDOW_MS = 2500;

/**
 * Fire-and-forget notification creation. Never throws — a failed notification
 * must never break the business transaction that triggered it. De-duplicates
 * identical (userId + actionType + recordId + title) events within 2.5s to
 * absorb accidental double-submits.
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
    const normalizedRecordId = recordId ? String(recordId) : null;
    const normalizedUserId = userId || null;

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const duplicate = await prisma.notification.findFirst({
      where: {
        title,
        actionType,
        module,
        recordId: normalizedRecordId,
        userId: normalizedUserId,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (duplicate) return;

    await prisma.notification.create({
      data: {
        title,
        message,
        module,
        recordId: normalizedRecordId,
        actionType,
        userName,
        userRole,
        userId: normalizedUserId,
        visibility,
      },
    });
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}

/**
 * Request-aware wrapper — auto-fills userName / userRole / userId from
 * req.user (set by verifyAuth). Use this from route handlers.
 */
export async function notify(
  req: RequestLike | null | undefined,
  input: QuickNotifyInput
): Promise<void> {
  const user = req?.user;
  return createNotification({
    ...input,
    userName: user?.email || 'System',
    userRole: user?.role || 'System',
    userId: user?.id || null,
  });
}
