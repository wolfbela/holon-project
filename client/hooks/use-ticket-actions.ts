'use client';

import { useState, useCallback } from 'react';
import type { Ticket, TicketStatus, TicketPriority } from '@shared/types/ticket';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';

export function useTicketActions(ticketId: string) {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = useCallback(
    async (status: TicketStatus): Promise<Ticket | undefined> => {
      setIsUpdating(true);
      try {
        const ticket = await apiClient.put<Ticket>(`/tickets/${ticketId}`, {
          status,
        });
        toast.success(
          status === 'closed' ? 'Ticket closed' : 'Ticket reopened',
        );
        return ticket;
      } catch (error) {
        if (error instanceof ApiClientError) {
          toast.error(error.body.error);
        } else {
          toast.error('Failed to update ticket status.');
        }
        return undefined;
      } finally {
        setIsUpdating(false);
      }
    },
    [ticketId],
  );

  const updatePriority = useCallback(
    async (priority: TicketPriority): Promise<Ticket | undefined> => {
      setIsUpdating(true);
      try {
        const ticket = await apiClient.put<Ticket>(`/tickets/${ticketId}`, {
          priority,
        });
        toast.success(`Priority updated to ${priority}`);
        return ticket;
      } catch (error) {
        if (error instanceof ApiClientError) {
          toast.error(error.body.error);
        } else {
          toast.error('Failed to update ticket priority.');
        }
        return undefined;
      } finally {
        setIsUpdating(false);
      }
    },
    [ticketId],
  );

  return { updateStatus, updatePriority, isUpdating };
}
