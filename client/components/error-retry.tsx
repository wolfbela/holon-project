'use client';

import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorRetryProps {
  title?: string;
  message?: string;
  onRetry: () => void;
}

export function ErrorRetry({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
}: ErrorRetryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <p className="text-lg font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 gap-2 rounded-full"
        onClick={onRetry}
      >
        <RefreshCw className="size-3.5" />
        Try again
      </Button>
    </motion.div>
  );
}
