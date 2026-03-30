import { getIO } from './index';
import type { Ticket, Reply, Notification } from '@holon/shared';

export function emitNewReply(ticketId: string, reply: Reply): void {
  getIO().to(`ticket:${ticketId}`).emit('new_reply', { reply, ticketId });
}

export function emitTicketUpdated(ticket: Ticket): void {
  getIO().to(`ticket:${ticket.id}`).emit('ticket_updated', { ticket });
}

export function emitTicketCreated(ticket: Ticket): void {
  getIO().to('dashboard').emit('ticket_created', { ticket });
}

export function emitNewNotification(
  userId: string,
  notification: Notification,
): void {
  getIO().to(`user:${userId}`).emit('new_notification', { notification });
}
