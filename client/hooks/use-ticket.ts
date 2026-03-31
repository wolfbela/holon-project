'use client';

import { useCallback, useEffect } from 'react';
import type { Ticket } from '@shared/types/ticket';
import { apiClient } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { useFetch } from './use-fetch';

export function useTicket(id: string) {
  const fetcher = useCallback(
    () => apiClient.get<Ticket>(`/tickets/${id}`),
    [id],
  );

  const {
    data: ticket,
    isLoading,
    hasError,
    errorStatus,
    retry,
    setData: setTicket,
  } = useFetch({
    fetcher,
    deps: [id],
    errorMessage: 'Failed to load ticket. Please try again.',
    trackErrorStatus: true,
  });

  useEffect(() => {
    const socket = getSocket();

    const handleTicketUpdated = (data: { ticket: Ticket }) => {
      if (data.ticket.id === id) {
        setTicket(data.ticket);
      }
    };

    socket.on('ticket_updated', handleTicketUpdated);

    return () => {
      socket.off('ticket_updated', handleTicketUpdated);
    };
  }, [id, setTicket]);

  return { ticket: ticket ?? null, isLoading, hasError, errorStatus, retry };
}
