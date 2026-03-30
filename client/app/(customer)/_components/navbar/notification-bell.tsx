'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationItem } from './notification-item';

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-primary-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            <span className="sr-only">
              Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between px-1.5 py-1">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.preventDefault();
                  markAllAsRead();
                }}
                className="h-auto gap-1 px-2 py-1 text-xs text-muted-foreground"
              >
                <CheckCheck className="size-3" />
                Mark all as read
              </Button>
            )}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="size-4 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
              />
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
