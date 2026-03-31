'use client';

import { motion } from 'motion/react';
import { useTicket } from '@/hooks/use-ticket';
import { useTicketReplies } from '@/hooks/use-ticket-replies';
import { useProduct } from '@/hooks/use-product';
import {
  TicketHeader,
  ConversationThread,
  ReplyInput,
  TicketDetailSkeleton,
  TicketDetailError,
} from '@/components/ticket-detail';
import { AdminTicketActions } from './admin-ticket-actions';

interface AdminTicketDetailContentProps {
  id: string;
}

export function AdminTicketDetailContent({
  id,
}: AdminTicketDetailContentProps) {
  const {
    ticket,
    isLoading: ticketLoading,
    hasError,
    errorStatus,
    retry,
  } = useTicket(id);
  const {
    replies,
    isLoading: repliesLoading,
    submitReply,
    isSubmitting,
  } = useTicketReplies(id);

  const productId = ticket?.product_id;
  const { product } = useProduct(String(productId ?? ''));

  if (ticketLoading) {
    return <TicketDetailSkeleton />;
  }

  if (hasError || !ticket) {
    return <TicketDetailError errorStatus={errorStatus} retry={retry} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <TicketHeader
          ticket={ticket}
          product={productId ? product : null}
          backHref="/tickets"
          backLabel="Back to Tickets"
          actions={<AdminTicketActions ticket={ticket} />}
          showCustomerInfo
        />

        <ConversationThread
          replies={replies}
          ticketAuthorName={ticket.name}
          isLoading={repliesLoading}
          viewerRole="agent"
        />

        <ReplyInput
          onSubmit={submitReply}
          isSubmitting={isSubmitting}
          isDisabled={ticket.status === 'closed'}
        />
      </motion.div>
    </div>
  );
}
