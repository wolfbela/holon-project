import type { TicketStatus, TicketPriority } from '@shared/types/ticket';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  closed: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  closed: 'Closed',
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  low: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  high: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge className={cn(STATUS_STYLES[status])}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge className={cn(PRIORITY_STYLES[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
