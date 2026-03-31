'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Reply } from '@shared/types/reply';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useFetch } from './use-fetch';

export function useTicketReplies(ticketId: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetcher = useCallback(
    () => apiClient.get<Reply[]>(`/tickets/${ticketId}/replies`),
    [ticketId],
  );

  const {
    data,
    isLoading,
    hasError,
    retry,
    setData: setReplies,
  } = useFetch({
    fetcher,
    deps: [ticketId],
    errorMessage: 'Failed to load replies. Please try again.',
  });

  const replies: Reply[] = data ?? [];

  useEffect(() => {
    const socket = getSocket();

    socket.emit('join_ticket', ticketId);

    const handleNewReply = (data: { reply: Reply; ticketId: string }) => {
      if (data.ticketId === ticketId) {
        setReplies((prev: Reply[]) => {
          const current = prev ?? [];
          if (current.some((r) => r.id === data.reply.id)) return current;
          return [...current, data.reply];
        });
      }
    };

    const handleReconnect = () => {
      socket.emit('join_ticket', ticketId);
      retry();
    };

    socket.on('new_reply', handleNewReply);
    socket.on('connect', handleReconnect);

    return () => {
      socket.emit('leave_ticket', ticketId);
      socket.off('new_reply', handleNewReply);
      socket.off('connect', handleReconnect);
    };
  }, [ticketId, retry, setReplies]);

  const submitReply = useCallback(
    async (message: string): Promise<Reply | undefined> => {
      setIsSubmitting(true);
      try {
        const reply = await apiClient.post<Reply>(
          `/tickets/${ticketId}/replies`,
          { message },
        );
        setReplies((prev: Reply[]) => {
          const current = prev ?? [];
          if (current.some((r) => r.id === reply.id)) return current;
          return [...current, reply];
        });
        return reply;
      } catch (error) {
        if (error instanceof ApiClientError) {
          toast.error(error.body.error);
        } else {
          toast.error('Failed to send reply. Please try again.');
        }
        return undefined;
      } finally {
        setIsSubmitting(false);
      }
    },
    [ticketId, setReplies],
  );

  return { replies, isLoading, hasError, retry, submitReply, isSubmitting };
}
