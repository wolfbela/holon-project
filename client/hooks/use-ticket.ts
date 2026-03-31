'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Ticket } from '@shared/types/ticket';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

export function useTicket(id: string) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const fetchedRef = useRef(false);

  const fetchTicket = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    setErrorStatus(null);
    try {
      const data = await apiClient.get<Ticket>(`/tickets/${id}`);
      setTicket(data);
    } catch (error) {
      setHasError(true);
      if (error instanceof ApiClientError) {
        setErrorStatus(error.status);
        toast.error(error.body.error);
      } else {
        toast.error('Failed to load ticket. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchTicket();
  }, [fetchTicket]);

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
  }, [id]);

  const retry = useCallback(() => {
    fetchedRef.current = false;
    fetchTicket();
  }, [fetchTicket]);

  return { ticket, isLoading, hasError, errorStatus, retry };
}
