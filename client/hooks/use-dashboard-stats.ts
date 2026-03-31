'use client';

import { useEffect, useCallback } from 'react';
import type { TicketStats, PaginatedResponse } from '@shared/types/api';
import type { Ticket } from '@shared/types/ticket';
import { apiClient } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useFetch } from './use-fetch';

interface DashboardData {
  stats: TicketStats;
  recentTickets: Ticket[];
}

export function useDashboardStats() {
  const fetcher = useCallback(async (): Promise<DashboardData> => {
    const [stats, ticketsResult] = await Promise.all([
      apiClient.get<TicketStats>('/tickets/stats'),
      apiClient.get<PaginatedResponse<Ticket>>(
        '/tickets?page=1&limit=5&sort=created_at&order=desc',
      ),
    ]);
    return { stats, recentTickets: ticketsResult.data };
  }, []);

  const { data, isLoading, hasError, retry } = useFetch({
    fetcher,
    errorMessage: 'Failed to load dashboard data. Please try again.',
  });

  // Real-time: refetch when a new ticket is created or on reconnect
  useEffect(() => {
    const socket = getSocket();

    const handleTicketCreated = (socketData: { ticket: Ticket }) => {
      toast.info(`New ticket: ${socketData.ticket.subject}`, {
        duration: 3000,
      });
      retry();
    };

    const handleReconnect = () => {
      retry();
    };

    socket.on('ticket_created', handleTicketCreated);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('ticket_created', handleTicketCreated);
      socket.off('connect', handleReconnect);
    };
  }, [retry]);

  return {
    stats: data?.stats ?? null,
    recentTickets: data?.recentTickets ?? [],
    isLoading,
    hasError,
    retry,
  };
}
