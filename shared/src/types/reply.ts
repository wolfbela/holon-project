import { z } from 'zod';

export const AUTHOR_TYPES = ['customer', 'agent'] as const;
export const AuthorTypeSchema = z.enum(AUTHOR_TYPES);
export type AuthorType = z.infer<typeof AuthorTypeSchema>;

export const CreateReplySchema = z.object({
  message: z.string().min(1).max(5000),
});

export type CreateReplyInput = z.infer<typeof CreateReplySchema>;

export interface Reply {
  id: string;
  ticket_id: string;
  user_id: string;
  author_type: AuthorType;
  message: string;
  created_at: string;
}
