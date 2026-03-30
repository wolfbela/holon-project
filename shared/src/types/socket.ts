import { Ticket } from './ticket';
import { Reply } from './reply';
import { Notification } from './notification';
import { UserRole } from './user';

/** Server → Client events */
export interface ServerToClientEvents {
  new_reply: (data: { reply: Reply; ticketId: string }) => void;
  ticket_updated: (data: { ticket: Ticket }) => void;
  ticket_created: (data: { ticket: Ticket }) => void;
  new_notification: (data: { notification: Notification }) => void;
}

/** Client → Server events */
export interface ClientToServerEvents {
  join_ticket: (ticketId: string) => void;
  leave_ticket: (ticketId: string) => void;
}

/** Data attached to each authenticated socket */
export interface SocketData {
  userId: string;
  email: string;
  role: UserRole;
}
