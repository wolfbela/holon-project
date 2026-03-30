import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'new_ticket',
  'new_reply',
  'ticket_closed',
] as const;
export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  ticket_id: string;
  message: string;
  read: boolean;
  created_at: string;
}
