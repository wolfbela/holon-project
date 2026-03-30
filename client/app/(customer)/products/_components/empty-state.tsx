'use client';

import { Package } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onReset?: () => void;
}

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <Package className="mb-4 size-12 text-muted-foreground/40" />
      <h3 className="text-lg font-medium text-foreground">
        No products found
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Try adjusting your filters to find what you&apos;re looking for.
      </p>
      {onReset && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-full"
          onClick={onReset}
        >
          Clear filters
        </Button>
      )}
    </motion.div>
  );
}
