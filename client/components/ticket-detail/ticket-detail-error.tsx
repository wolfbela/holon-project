'use client';

import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TicketDetailErrorProps {
  errorStatus: number | null;
  retry: () => void;
}

export function TicketDetailError({
  errorStatus,
  retry,
}: TicketDetailErrorProps) {
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
