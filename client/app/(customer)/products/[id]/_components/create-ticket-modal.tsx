'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Ticket } from '@shared/types/ticket';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, LifeBuoy, CheckCircle2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Client-side schema with user-friendly error messages
const TicketFormSchema = z.object({
  product_id: z.number().positive(),
  product_name: z.string().min(1),
  subject: z
    .string()
    .min(1, 'Please enter a subject for your ticket.')
    .max(255, 'Subject must be 255 characters or fewer.'),
  message: z
    .string()
    .min(1, 'Please describe your issue.')
    .max(5000, 'Message must be 5,000 characters or fewer.'),
});

type TicketFormInput = z.infer<typeof TicketFormSchema>;

const MESSAGE_MAX = 5000;
const MESSAGE_WARN = 4800;

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
  const router = useRouter();
  const [successTicket, setSuccessTicket] = useState<Ticket | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<TicketFormInput>({
    resolver: zodResolver(TicketFormSchema),
    defaultValues: {
      product_id: productId,
      product_name: productName,
      subject: '',
      message: '',
    },
  });

  const messageValue = watch('message');
  const messageLength = messageValue?.length ?? 0;

  // Reset form and success state when modal closes
  useEffect(() => {
    if (!open) {
      setSuccessTicket(null);
      reset({
        product_id: productId,
        product_name: productName,
        subject: '',
        message: '',
      });
    }
  }, [open, productId, productName, reset]);

  // Prevent closing modal while submitting
  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
  }

  async function onSubmit(data: TicketFormInput) {
    try {
      const ticket = await apiClient.post<Ticket>('/tickets', data);
      setSuccessTicket(ticket);
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.body.error);
      } else {
        toast.error('Failed to create ticket. Please try again.');
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <AnimatePresence mode="wait">
          {successTicket ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col items-center gap-4 py-6 text-center"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="size-6 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">Ticket Created</p>
                <p className="text-sm text-muted-foreground">
                  Your ticket{' '}
                  <span className="font-medium text-foreground">
                    {successTicket.display_id}
                  </span>{' '}
                  has been submitted. Our team will get back to you shortly.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    router.push('/my-tickets');
                  }}
                >
                  View My Tickets
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={false}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <LifeBuoy className="size-4 text-primary" />
                  Create Support Ticket
                </DialogTitle>
                <DialogDescription>
                  Describe your issue and our support team will respond as soon
                  as possible.
                </DialogDescription>
              </DialogHeader>

              {/* Product context */}
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <Package className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  Product:{' '}
                  <span className="font-medium text-foreground">
                    {productName}
                  </span>
                </span>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-4 space-y-4"
              >
                <input
                  type="hidden"
                  {...register('product_id', { valueAsNumber: true })}
                />
                <input type="hidden" {...register('product_name')} />

                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="e.g. Product arrived damaged"
                    maxLength={255}
                    autoFocus
                    disabled={isSubmitting}
                    aria-invalid={!!errors.subject}
                    aria-describedby={
                      errors.subject ? 'subject-error' : undefined
                    }
                    {...register('subject')}
                  />
                  {errors.subject && (
                    <p
                      id="subject-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
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
                    maxLength={MESSAGE_MAX}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.message}
                    aria-describedby={
                      [
                        errors.message ? 'message-error' : '',
                        'message-counter',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    {...register('message')}
                  />
                  <div className="flex items-center justify-between">
                    {errors.message ? (
                      <p
                        id="message-error"
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {errors.message.message}
                      </p>
                    ) : (
                      <span />
                    )}
                    <p
                      id="message-counter"
                      className={cn(
                        'text-xs tabular-nums',
                        messageLength >= MESSAGE_MAX
                          ? 'text-destructive'
                          : messageLength >= MESSAGE_WARN
                            ? 'text-amber-500'
                            : 'text-muted-foreground',
                      )}
                    >
                      {messageLength.toLocaleString()} /{' '}
                      {MESSAGE_MAX.toLocaleString()}
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose
                    render={
                      <Button variant="outline" disabled={isSubmitting} />
                    }
                  >
                    Cancel
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
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
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
