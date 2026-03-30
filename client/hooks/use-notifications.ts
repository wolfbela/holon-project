'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification } from '@shared/types/notification';
import { apiClient } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';

interface NotificationsResponse {
  data: Notification[];
  unreadCount: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiClient.get<NotificationsResponse>('/notifications');
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = (data: { notification: Notification }) => {
      setNotifications((prev) => [data.notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    const handleReconnect = () => {
      fetchNotifications();
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('connect', handleReconnect);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiClient.put(`/notifications/${id}/read`, {});
    } catch {
      // Rollback on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
      );
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousCount = unreadCount;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await apiClient.put('/notifications/read-all', {});
    } catch {
      // Rollback on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    }
  }, [notifications, unreadCount]);

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}
