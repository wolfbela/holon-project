'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@shared/types/api';
import { Button } from '@/components/ui/button';

interface PaginationControlsProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  pagination,
  onPageChange,
}: PaginationControlsProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>
      <span className="text-sm tabular-nums text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pagination.page >= pagination.totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
