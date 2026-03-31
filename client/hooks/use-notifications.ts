'use client';

import { useEffect, useCallback } from 'react';
import type { Notification } from '@shared/types/notification';
import { apiClient } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { useFetch } from './use-fetch';

interface NotificationsResponse {
  data: Notification[];
  unreadCount: number;
}

export function useNotifications() {
  const fetcher = useCallback(
    () => apiClient.get<NotificationsResponse>('/notifications'),
    [],
  );

  const { data, isLoading, retry, setData } = useFetch({
    fetcher,
    errorMessage: null, // Silently fail — notifications are non-critical
  });

  const notifications: Notification[] = data?.data ?? [];
  const unreadCount: number = data?.unreadCount ?? 0;

  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = (socketData: {
      notification: Notification;
    }) => {
      setData((prev: NotificationsResponse | undefined) => ({
        data: [socketData.notification, ...(prev?.data ?? [])],
        unreadCount: (prev?.unreadCount ?? 0) + 1,
      }));
    };

    const handleReconnect = () => {
      retry();
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('connect', handleReconnect);
    };
  }, [retry, setData]);

  const markAsRead = useCallback(
    async (id: string) => {
      setData((prev: NotificationsResponse | undefined) => ({
        data: (prev?.data ?? []).map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, (prev?.unreadCount ?? 0) - 1),
      }));

      try {
        await apiClient.put(`/notifications/${id}/read`, {});
      } catch {
        // Rollback on failure
        setData((prev: NotificationsResponse | undefined) => ({
          data: (prev?.data ?? []).map((n) =>
            n.id === id ? { ...n, read: false } : n,
          ),
          unreadCount: (prev?.unreadCount ?? 0) + 1,
        }));
      }
    },
    [setData],
  );

  const markAllAsRead = useCallback(async () => {
    const previousData = data;

    setData((prev: NotificationsResponse | undefined) => ({
      data: (prev?.data ?? []).map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    try {
      await apiClient.put('/notifications/read-all', {});
    } catch {
      // Rollback on failure
      if (previousData) setData(previousData);
    }
  }, [data, setData]);

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}
