'use client';

import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTicket } from '@/hooks/use-ticket';
import { useTicketReplies } from '@/hooks/use-ticket-replies';
import { useProduct } from '@/hooks/use-product';
import { TicketDetailSkeleton } from './ticket-detail-skeleton';
import { TicketHeader } from './ticket-header';
import { ConversationThread } from './conversation-thread';
import { ReplyInput } from './reply-input';

interface TicketDetailContentProps {
  id: string;
}

export function TicketDetailContent({ id }: TicketDetailContentProps) {
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
    const errorTitle =
      errorStatus === 404
        ? 'Ticket not found'
        : errorStatus === 403
          ? 'Access denied'
          : 'Something went wrong';

    const errorMessage =
      errorStatus === 404
        ? 'This ticket doesn\u2019t exist or may have been deleted.'
        : errorStatus === 403
          ? 'You don\u2019t have permission to view this ticket.'
          : 'We couldn\u2019t load this ticket. Please try again.';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <p className="text-lg font-medium text-foreground">{errorTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2 rounded-full"
          onClick={retry}
        >
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <TicketHeader ticket={ticket} product={productId ? product : null} />

        <ConversationThread
          replies={replies}
          ticketAuthorName={ticket.name}
          isLoading={repliesLoading}
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
