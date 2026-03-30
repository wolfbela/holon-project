import Link from 'next/link';
import { MessageSquare, Ticket, CheckCircle } from 'lucide-react';
import type { Notification, NotificationType } from '@shared/types/notification';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  new_reply: MessageSquare,
  new_ticket: Ticket,
  ticket_closed: CheckCircle,
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  ticketBasePath?: string;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  ticketBasePath = '/my-tickets',
}: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type];

  return (
    <Link
      href={`${ticketBasePath}/${notification.ticket_id}`}
      onClick={() => {
        if (!notification.read) onMarkAsRead(notification.id);
      }}
      className={cn(
        'flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent',
        !notification.read && 'bg-accent/50',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'line-clamp-2 text-sm',
            !notification.read
              ? 'font-medium text-foreground'
              : 'text-muted-foreground',
          )}
        >
          {notification.message}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
      {!notification.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      )}
    </Link>
  );
}
