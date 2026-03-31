'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Ticket, TicketStatus, TicketPriority } from '@shared/types/ticket';
import type { PaginatedResponse, PaginationMeta } from '@shared/types/api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

export type SortField = 'created_at' | 'updated_at' | 'priority' | 'status';
export type SortOrder = 'asc' | 'desc';

interface UseAdminTicketsParams {
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export function useAdminTickets({
  search,
  status,
  priority,
  sort = 'created_at',
  order = 'desc',
  page = 1,
  limit = 10,
}: UseAdminTicketsParams = {}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fetchedRef = useRef(false);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    params.set('sort', sort);
    params.set('order', order);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [search, status, priority, sort, order, page, limit]);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const result = await apiClient.get<PaginatedResponse<Ticket>>(
        `/tickets?${buildQuery()}`,
      );
      setTickets(result.data);
      setPagination(result.pagination);
    } catch (error) {
      setHasError(true);
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Failed to load tickets. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchedRef.current = false;
  }, [search, status, priority, sort, order, page, limit]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchTickets();
  }, [fetchTickets]);

  // Real-time: refetch when a new ticket is created
  useEffect(() => {
    const socket = getSocket();

    const handleTicketCreated = () => {
      fetchedRef.current = false;
      fetchTickets();
    };

    socket.on('ticket_created', handleTicketCreated);
    return () => {
      socket.off('ticket_created', handleTicketCreated);
    };
  }, [fetchTickets]);

  const deleteTicket = useCallback(
    async (ticketId: string) => {
      setIsDeleting(true);
      try {
        await apiClient.del(`/tickets/${ticketId}`);
        // If this was the last ticket on the page, refetch to handle pagination
        if (tickets.length <= 1 && page > 1) {
          fetchedRef.current = false;
          // The parent will update the page via URL state
        } else {
          setTickets((prev) => prev.filter((t) => t.id !== ticketId));
          if (pagination) {
            setPagination((prev) =>
              prev ? { ...prev, total: prev.total - 1 } : prev,
            );
          }
        }
        toast.success('Ticket deleted successfully.');
      } catch (error) {
        if (error instanceof ApiClientError) {
          toast.error(error.body.error);
        } else {
          toast.error('Failed to delete ticket.');
        }
      } finally {
        setIsDeleting(false);
      }
    },
    [tickets.length, page, pagination],
  );

  const retry = useCallback(() => {
    fetchedRef.current = false;
    fetchTickets();
  }, [fetchTickets]);

  return { tickets, pagination, isLoading, hasError, retry, deleteTicket, isDeleting };
}
