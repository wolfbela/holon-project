import Link from 'next/link';
import { MessageSquare, Ticket, CheckCircle } from 'lucide-react';
import type { Notification, NotificationType } from '@shared/types/notification';
import { cn } from '@/lib/utils';

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  new_reply: MessageSquare,
  new_ticket: Ticket,
  ticket_closed: CheckCircle,
};

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

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
