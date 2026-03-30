import { sql } from 'kysely';
import { db } from '../db';
import {
  CreateTicketInput,
  UpdateTicketInput,
  ListTicketsQueryInput,
  Ticket,
  PaginatedResponse,
  TicketStats,
} from '@holon/shared';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../middleware/auth';

function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

function toTicket(row: {
  id: string;
  display_id: string;
  user_id: string;
  email: string;
  name: string;
  product_id: number;
  product_name: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: Date;
  updated_at: Date;
}): Ticket {
  return {
    id: row.id,
    display_id: row.display_id,
    user_id: row.user_id,
    email: row.email,
    name: row.name,
    product_id: row.product_id,
    product_name: row.product_name,
    subject: row.subject,
    message: row.message,
    status: row.status as Ticket['status'],
    priority: row.priority as Ticket['priority'],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function createTicket(
  input: CreateTicketInput,
  user: JwtPayload,
): Promise<Ticket> {
  const userRow = await db
    .selectFrom('users')
    .select(['email', 'name'])
    .where('id', '=', user.userId)
    .executeTakeFirst();

  if (!userRow) {
    throw new AppError('User not found', 404);
  }

  const row = await db
    .insertInto('tickets')
    .values({
      user_id: user.userId,
      email: userRow.email,
      name: userRow.name,
      product_id: input.product_id,
      product_name: input.product_name,
      subject: input.subject,
      message: input.message,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toTicket(row);
}

export async function listTickets(
  query: ListTicketsQueryInput,
  user: JwtPayload,
): Promise<PaginatedResponse<Ticket>> {
  let baseQuery = db.selectFrom('tickets');

  if (user.role !== 'admin') {
    baseQuery = baseQuery.where('user_id', '=', user.userId);
  }

  if (query.status) {
    baseQuery = baseQuery.where('status', '=', query.status);
  }

  if (query.priority) {
    baseQuery = baseQuery.where('priority', '=', query.priority);
  }

  if (query.search) {
    const escaped = escapeIlike(query.search);
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('subject', 'ilike', `%${escaped}%`),
        eb('name', 'ilike', `%${escaped}%`),
      ]),
    );
  }

  const [countResult, rows] = await Promise.all([
    baseQuery
      .select(db.fn.countAll<string>().as('total'))
      .executeTakeFirstOrThrow(),
    baseQuery
      .selectAll()
      .orderBy(query.sort, query.order)
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .execute(),
  ]);

  const total = Number(countResult.total);

  return {
    data: rows.map(toTicket),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getTicket(
  ticketId: string,
  user: JwtPayload,
): Promise<Ticket> {
  const row = await db
    .selectFrom('tickets')
    .selectAll()
    .where('id', '=', ticketId)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('Ticket not found', 404);
  }

  if (user.role !== 'admin' && row.user_id !== user.userId) {
    throw new AppError('Forbidden', 403);
  }

  return toTicket(row);
}

export async function updateTicket(
  ticketId: string,
  input: UpdateTicketInput,
  user: JwtPayload,
): Promise<Ticket> {
  if (!input.status && !input.priority) {
    throw new AppError('No fields to update', 400);
  }

  const existing = await db
    .selectFrom('tickets')
    .selectAll()
    .where('id', '=', ticketId)
    .executeTakeFirst();

  if (!existing) {
    throw new AppError('Ticket not found', 404);
  }

  if (user.role !== 'admin' && existing.user_id !== user.userId) {
    throw new AppError('Forbidden', 403);
  }

  if (user.role !== 'admin' && (input.status || input.priority)) {
    throw new AppError('Only admins can change status or priority', 403);
  }

  const payload: Record<string, unknown> = { updated_at: new Date() };
  if (input.status) payload.status = input.status;
  if (input.priority) payload.priority = input.priority;

  const row = await db
    .updateTable('tickets')
    .set(payload)
    .where('id', '=', ticketId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return toTicket(row);
}

export async function deleteTicket(ticketId: string): Promise<void> {
  const result = await db
    .deleteFrom('tickets')
    .where('id', '=', ticketId)
    .returning('id')
    .executeTakeFirst();

  if (!result) {
    throw new AppError('Ticket not found', 404);
  }
}

export function formatResponseTime(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0m';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export async function getTicketStats(): Promise<TicketStats> {
  const [countsResult, avgResult] = await Promise.all([
    sql<{
      total: string;
      open: string;
      closed: string;
      low: string;
      medium: string;
      high: string;
    }>`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE status = 'open')::text AS open,
        COUNT(*) FILTER (WHERE status = 'closed')::text AS closed,
        COUNT(*) FILTER (WHERE priority = 'low')::text AS low,
        COUNT(*) FILTER (WHERE priority = 'medium')::text AS medium,
        COUNT(*) FILTER (WHERE priority = 'high')::text AS high
      FROM tickets
    `.execute(db),

    sql<{ avg_seconds: string | null }>`
      SELECT AVG(EXTRACT(EPOCH FROM (first_reply.min_created - t.created_at)))::text AS avg_seconds
      FROM tickets t
      INNER JOIN (
        SELECT ticket_id, MIN(created_at) AS min_created
        FROM replies
        WHERE author_type = 'agent'
        GROUP BY ticket_id
      ) first_reply ON first_reply.ticket_id = t.id
    `.execute(db),
  ]);

  const counts = countsResult.rows[0] ?? {
    total: '0',
    open: '0',
    closed: '0',
    low: '0',
    medium: '0',
    high: '0',
  };

  const avgSeconds = avgResult.rows[0]?.avg_seconds
    ? parseFloat(avgResult.rows[0].avg_seconds)
    : null;

  return {
    total: Number(counts.total),
    open: Number(counts.open),
    closed: Number(counts.closed),
    byPriority: {
      low: Number(counts.low),
      medium: Number(counts.medium),
      high: Number(counts.high),
    },
    avgResponseTime: formatResponseTime(avgSeconds),
  };
}
