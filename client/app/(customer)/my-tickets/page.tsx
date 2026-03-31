'use client';

import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import type { TicketStatus } from '@shared/types/ticket';
import { Button } from '@/components/ui/button';
import { ErrorRetry } from '@/components/error-retry';
import { useTickets } from '@/hooks/use-tickets';
import { StatusFilter } from './_components/status-filter';
import { TicketList } from './_components/ticket-list';

export default function MyTicketsPage() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | undefined>();
  const [currentPage, setCurrentPage] = useState(1);

  const { tickets, pagination, isLoading, hasError, retry } = useTickets({
    status: statusFilter,
    page: currentPage,
  });

  const handleStatusChange = useCallback((status: TicketStatus | undefined) => {
    setStatusFilter(status);
    setCurrentPage(1);
  }, []);

  const handleClearFilter = useCallback(() => {
    setStatusFilter(undefined);
    setCurrentPage(1);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="text-2xl font-bold tracking-tight">My Tickets</h1>
        <p className="mt-1 text-muted-foreground">
          Track and manage your support requests.
        </p>
      </motion.div>

      {!hasError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mt-6"
        >
          <StatusFilter selected={statusFilter} onChange={handleStatusChange} />
        </motion.div>
      )}

      {hasError && !isLoading ? (
        <ErrorRetry
          message="We couldn't load your tickets. Please try again."
          onRetry={retry}
        />
      ) : (
        <div className="mt-6">
          <TicketList
            tickets={tickets}
            isLoading={isLoading}
            pagination={pagination}
            statusFilter={statusFilter}
            onPageChange={setCurrentPage}
            onClearFilter={handleClearFilter}
          />
        </div>
      )}
    </div>
  );
}
