'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateTicketSchema,
  type CreateTicketInput,
  type Ticket,
} from '@shared/types/ticket';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, LifeBuoy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  productName: string;
}

export function CreateTicketModal({
  open,
  onOpenChange,
  productId,
  productName,
}: CreateTicketModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(CreateTicketSchema),
    defaultValues: {
      product_id: productId,
      product_name: productName,
      subject: '',
      message: '',
    },
  });

  const messageValue = watch('message');

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset({
        product_id: productId,
        product_name: productName,
        subject: '',
        message: '',
      });
    }
  }, [open, productId, productName, reset]);

  async function onSubmit(data: CreateTicketInput) {
    try {
      const ticket = await apiClient.post<Ticket>('/tickets', data);
      toast.success(`Ticket ${ticket.display_id} created successfully!`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Failed to create ticket. Please try again.');
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="size-4 text-primary" />
            Create Support Ticket
          </DialogTitle>
          <DialogDescription>
            For <strong>{productName}</strong>. Describe your issue and our
            support team will respond as soon as possible.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('product_id', { valueAsNumber: true })} />
          <input type="hidden" {...register('product_name')} />

          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="e.g. Product arrived damaged"
              autoFocus
              disabled={isSubmitting}
              aria-invalid={!!errors.subject}
              {...register('subject')}
            />
            {errors.subject && (
              <p className="text-sm text-destructive" role="alert">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Describe your issue in detail..."
              className="min-h-28"
              disabled={isSubmitting}
              aria-invalid={!!errors.message}
              {...register('message')}
            />
            <div className="flex items-center justify-between">
              {errors.message ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.message.message}
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground tabular-nums">
                {messageValue?.length ?? 0} / 5,000
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isSubmitting} />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Submit Ticket'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
