'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
} from '@shared/types/ticket';
import type { PaginatedResponse, PaginationMeta } from '@shared/types/api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useFetch } from './use-fetch';

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
  const [isDeleting, setIsDeleting] = useState(false);

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    params.set('sort', sort);
    params.set('order', order);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return apiClient.get<PaginatedResponse<Ticket>>(
      `/tickets?${params.toString()}`,
    );
  }, [search, status, priority, sort, order, page, limit]);

  const { data, isLoading, hasError, retry, setData } = useFetch({
    fetcher,
    deps: [search, status, priority, sort, order, page, limit],
    errorMessage: 'Failed to load tickets. Please try again.',
  });

  const tickets: Ticket[] = data?.data ?? [];
  const pagination: PaginationMeta | null = data?.pagination ?? null;

  // Real-time: refetch when a new ticket is created
  useEffect(() => {
    const socket = getSocket();

    const handleTicketCreated = () => {
      retry();
    };

    socket.on('ticket_created', handleTicketCreated);
    return () => {
      socket.off('ticket_created', handleTicketCreated);
    };
  }, [retry]);

  const deleteTicket = useCallback(
    async (ticketId: string) => {
      setIsDeleting(true);
      try {
        await apiClient.del(`/tickets/${ticketId}`);
        if (tickets.length <= 1 && page > 1) {
          retry();
        } else {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              data: prev.data.filter((t) => t.id !== ticketId),
              pagination: {
                ...prev.pagination,
                total: prev.pagination.total - 1,
              },
            };
          });
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
    [tickets.length, page, retry, setData],
  );

  return {
    tickets,
    pagination,
    isLoading,
    hasError,
    retry,
    deleteTicket,
    isDeleting,
  };
}
