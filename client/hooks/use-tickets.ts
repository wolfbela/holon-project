'use client';

import { useCallback } from 'react';
import type { Ticket, TicketStatus } from '@shared/types/ticket';
import type { PaginatedResponse, PaginationMeta } from '@shared/types/api';
import { apiClient } from '@/lib/api-client';
import { useFetch } from './use-fetch';

interface UseTicketsParams {
  status?: TicketStatus;
  page?: number;
  limit?: number;
}

export function useTickets({
  status,
  page = 1,
  limit = 10,
}: UseTicketsParams = {}) {
  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sort', 'created_at');
    params.set('order', 'desc');
    return apiClient.get<PaginatedResponse<Ticket>>(
      `/tickets?${params.toString()}`,
    );
  }, [status, page, limit]);

  const { data, isLoading, hasError, retry } = useFetch({
    fetcher,
    deps: [status, page, limit],
    errorMessage: 'Failed to load tickets. Please try again.',
  });

  const tickets: Ticket[] = data?.data ?? [];
  const pagination: PaginationMeta | null = data?.pagination ?? null;

  return { tickets, pagination, isLoading, hasError, retry };
}
