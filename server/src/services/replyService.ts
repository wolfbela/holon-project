import { db } from '../db';
import { CreateReplyInput, Reply, AuthorType } from '@holon/shared';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../middleware/auth';

function toReply(row: {
  id: string;
  ticket_id: string;
  user_id: string;
  author_type: string;
  message: string;
  created_at: Date;
}): Reply {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    user_id: row.user_id,
    author_type: row.author_type as AuthorType,
    message: row.message,
    created_at: row.created_at.toISOString(),
  };
}

export async function createReply(
  ticketId: string,
  input: CreateReplyInput,
  user: JwtPayload,
): Promise<Reply> {
  const ticket = await db
    .selectFrom('tickets')
    .select(['id', 'user_id', 'status'])
    .where('id', '=', ticketId)
    .executeTakeFirst();

  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  if (user.role !== 'admin' && ticket.user_id !== user.userId) {
    throw new AppError('Forbidden', 403);
  }

  if (ticket.status === 'closed') {
    throw new AppError('Cannot reply to a closed ticket', 400);
  }

  const authorType: AuthorType = user.role === 'admin' ? 'agent' : 'customer';

  const row = await db
    .insertInto('replies')
    .values({
      ticket_id: ticketId,
      user_id: user.userId,
      author_type: authorType,
      message: input.message,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toReply(row);
}

export async function listReplies(
  ticketId: string,
  user: JwtPayload,
): Promise<Reply[]> {
  const ticket = await db
    .selectFrom('tickets')
    .select(['id', 'user_id'])
    .where('id', '=', ticketId)
    .executeTakeFirst();

  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  if (user.role !== 'admin' && ticket.user_id !== user.userId) {
    throw new AppError('Forbidden', 403);
  }

  const rows = await db
    .selectFrom('replies')
    .selectAll()
    .where('ticket_id', '=', ticketId)
    .orderBy('created_at', 'asc')
    .execute();

  return rows.map(toReply);
}
