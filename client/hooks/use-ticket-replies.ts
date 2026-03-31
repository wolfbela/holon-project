'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Reply } from '@shared/types/reply';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

export function useTicketReplies(ticketId: string) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fetchedRef = useRef(false);

  const fetchReplies = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const data = await apiClient.get<Reply[]>(
        `/tickets/${ticketId}/replies`,
      );
      setReplies(data);
    } catch (error) {
      setHasError(true);
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Failed to load replies. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchedRef.current = false;
  }, [ticketId]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchReplies();
  }, [fetchReplies]);

  useEffect(() => {
    const socket = getSocket();

    socket.emit('join_ticket', ticketId);

    const handleNewReply = (data: { reply: Reply; ticketId: string }) => {
      if (data.ticketId === ticketId) {
        setReplies((prev) => {
          if (prev.some((r) => r.id === data.reply.id)) return prev;
          return [...prev, data.reply];
        });
      }
    };

    const handleReconnect = () => {
      socket.emit('join_ticket', ticketId);
      fetchReplies();
    };

    socket.on('new_reply', handleNewReply);
    socket.on('connect', handleReconnect);

    return () => {
      socket.emit('leave_ticket', ticketId);
      socket.off('new_reply', handleNewReply);
      socket.off('connect', handleReconnect);
    };
  }, [ticketId, fetchReplies]);

  const submitReply = useCallback(
    async (message: string): Promise<Reply | undefined> => {
      setIsSubmitting(true);
      try {
        const reply = await apiClient.post<Reply>(
          `/tickets/${ticketId}/replies`,
          { message },
        );
        setReplies((prev) => {
          if (prev.some((r) => r.id === reply.id)) return prev;
          return [...prev, reply];
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
    [ticketId],
  );

  const retry = useCallback(() => {
    fetchedRef.current = false;
    fetchReplies();
  }, [fetchReplies]);

  return { replies, isLoading, hasError, retry, submitReply, isSubmitting };
}
