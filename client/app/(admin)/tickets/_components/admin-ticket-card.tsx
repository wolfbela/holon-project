'use client';

import Link from 'next/link';
import { ChevronRight, Trash2, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import type { Ticket } from '@shared/types/ticket';
import { StatusBadge, PriorityBadge } from '@/components/ticket-badges';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_ACCENT: Record<string, string> = {
  open: 'border-l-emerald-500',
  closed: 'border-l-muted-foreground/30',
};

interface AdminTicketCardProps {
  ticket: Ticket;
  delay?: number;
  onDelete: (ticket: Ticket) => void;
}

export function AdminTicketCard({
  ticket,
  delay = 0,
  onDelete,
}: AdminTicketCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      <Link href={`/tickets/${ticket.id}`} className="block">
        <div
          className={cn(
            'group flex items-center gap-4 rounded-xl border-l-[3px] p-4 ring-1 ring-foreground/10 transition-all duration-300 hover:shadow-md hover:ring-foreground/20',
            STATUS_ACCENT[ticket.status],
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                {ticket.display_id}
              </span>
              <time className="text-xs text-muted-foreground">
                {formatDate(ticket.created_at)}
              </time>
            </div>

            <h3 className="mt-1.5 line-clamp-1 font-medium text-foreground transition-colors group-hover:text-primary">
              {ticket.subject}
            </h3>

            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {ticket.product_name}
            </p>

            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {ticket.name}
              </span>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className="flex items-center gap-1">
                <Mail className="size-3" />
                {ticket.email}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete ticket"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(ticket);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </Link>
    </motion.div>
  );
}
