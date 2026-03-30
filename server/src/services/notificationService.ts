import { db } from '../db';
import { Notification, NotificationType } from '@holon/shared';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../middleware/auth';

function toNotification(row: {
  id: string;
  user_id: string;
  type: string;
  ticket_id: string;
  message: string;
  read: boolean;
  created_at: Date;
}): Notification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type as NotificationType,
    ticket_id: row.ticket_id,
    message: row.message,
    read: row.read,
    created_at: row.created_at.toISOString(),
  };
}

export async function listNotifications(
  user: JwtPayload,
): Promise<{ data: Notification[]; unreadCount: number }> {
  const rows = await db
    .selectFrom('notifications')
    .selectAll()
    .where('user_id', '=', user.userId)
    .orderBy('created_at', 'desc')
    .execute();

  const unreadCount = rows.filter((r) => !r.read).length;

  return {
    data: rows.map(toNotification),
    unreadCount,
  };
}

export async function markAsRead(
  notificationId: string,
  user: JwtPayload,
): Promise<Notification> {
  const notification = await db
    .selectFrom('notifications')
    .selectAll()
    .where('id', '=', notificationId)
    .executeTakeFirst();

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  if (notification.user_id !== user.userId) {
    throw new AppError('Forbidden', 403);
  }

  const updated = await db
    .updateTable('notifications')
    .set({ read: true })
    .where('id', '=', notificationId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return toNotification(updated);
}

export async function markAllAsRead(user: JwtPayload): Promise<void> {
  await db
    .updateTable('notifications')
    .set({ read: true })
    .where('user_id', '=', user.userId)
    .where('read', '=', false)
    .execute();
}
