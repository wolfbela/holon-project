'use client';

import { useState } from 'react';
import { Loader2, XCircle, RotateCcw } from 'lucide-react';
import type { Ticket, TicketPriority } from '@shared/types/ticket';
import { TICKET_PRIORITIES } from '@shared/types/ticket';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTicketActions } from '@/hooks/use-ticket-actions';

interface AdminTicketActionsProps {
  ticket: Ticket;
}

export function AdminTicketActions({ ticket }: AdminTicketActionsProps) {
  const { updateStatus, updatePriority, isUpdating } = useTicketActions(
    ticket.id,
  );
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const handlePriorityChange = (value: string | null) => {
    if (value && value !== ticket.priority) {
      updatePriority(value as TicketPriority);
    }
  };

  const handleClose = async () => {
    await updateStatus('closed');
    setCloseDialogOpen(false);
  };

  const handleReopen = () => {
    updateStatus('open');
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={ticket.priority}
          onValueChange={handlePriorityChange}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {TICKET_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {ticket.status === 'open' ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setCloseDialogOpen(true)}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" />
            )}
            Close Ticket
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleReopen}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Reopen Ticket
          </Button>
        )}
      </div>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close ticket?</DialogTitle>
            <DialogDescription>
              This will close ticket{' '}
              <span className="font-semibold text-foreground">
                {ticket.display_id}
              </span>{' '}
              &mdash; &ldquo;{ticket.subject}&rdquo;. The customer will no
              longer be able to reply. You can reopen it later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              disabled={isUpdating}
            >
              {isUpdating && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Close Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
