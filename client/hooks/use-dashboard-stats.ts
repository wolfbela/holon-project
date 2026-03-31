'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TicketStats, PaginatedResponse } from '@shared/types/api';
import type { Ticket } from '@shared/types/ticket';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

export function useDashboardStats() {
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const fetchedRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [statsResult, ticketsResult] = await Promise.all([
        apiClient.get<TicketStats>('/tickets/stats'),
        apiClient.get<PaginatedResponse<Ticket>>(
          '/tickets?page=1&limit=5&sort=created_at&order=desc',
        ),
      ]);
      setStats(statsResult);
      setRecentTickets(ticketsResult.data);
    } catch (error) {
      setHasError(true);
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Failed to load dashboard data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time: refetch when a new ticket is created or on reconnect
  useEffect(() => {
    const socket = getSocket();

    const handleTicketCreated = (data: { ticket: Ticket }) => {
      toast.info(`New ticket: ${data.ticket.subject}`, { duration: 3000 });
      fetchDashboard();
    };

    const handleReconnect = () => {
      fetchDashboard();
    };

    socket.on('ticket_created', handleTicketCreated);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('ticket_created', handleTicketCreated);
      socket.off('connect', handleReconnect);
    };
  }, [fetchDashboard]);

  const retry = useCallback(() => {
    fetchedRef.current = false;
    fetchDashboard();
  }, [fetchDashboard]);

  return { stats, recentTickets, isLoading, hasError, retry };
}
