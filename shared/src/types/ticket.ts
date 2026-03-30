import { z } from 'zod';

export const TICKET_STATUSES = ['open', 'closed'] as const;
export const TicketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const;
export const TicketPrioritySchema = z.enum(TICKET_PRIORITIES);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export const CreateTicketSchema = z.object({
  product_id: z.number().positive(),
  product_name: z.string().min(1),
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(5000),
});

export const UpdateTicketSchema = z.object({
  status: TicketStatusSchema.optional(),
  priority: TicketPrioritySchema.optional(),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;

export interface Ticket {
  id: string;
  display_id: string;
  user_id: string;
  email: string;
  name: string;
  product_id: number;
  product_name: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
}
