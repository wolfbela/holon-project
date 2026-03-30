'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Ticket, TicketStatus } from '@shared/types/ticket';
import type { PaginatedResponse, PaginationMeta } from '@shared/types/api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const fetchedRef = useRef(false);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sort', 'created_at');
    params.set('order', 'desc');
    return params.toString();
  }, [status, page, limit]);

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

  // Reset fetch guard when params change
  useEffect(() => {
    fetchedRef.current = false;
  }, [status, page, limit]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchTickets();
  }, [fetchTickets]);

  const retry = useCallback(() => {
    fetchedRef.current = false;
    fetchTickets();
  }, [fetchTickets]);

  return { tickets, pagination, isLoading, hasError, retry };
}
