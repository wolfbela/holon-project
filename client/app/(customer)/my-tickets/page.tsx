'use client';

import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import type { TicketStatus } from '@shared/types/ticket';
import { Button } from '@/components/ui/button';
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

  const handleStatusChange = useCallback(
    (status: TicketStatus | undefined) => {
      setStatusFilter(status);
      setCurrentPage(1);
    },
    [],
  );

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <p className="text-lg font-medium text-foreground">
            Something went wrong
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We couldn&apos;t load your tickets. Please try again.
          </p>
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
