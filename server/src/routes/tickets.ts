import { Router, Request, Response } from 'express';
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  ListTicketsQuerySchema,
  ListTicketsQueryInput,
  CreateReplySchema,
} from '@holon/shared';
import { validate, validateQuery } from '../middleware/validate';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import {
  createTicket,
  listTickets,
  getTicket,
  updateTicket,
  deleteTicket,
  getTicketStats,
} from '../services/ticketService';
import { createReply, listReplies } from '../services/replyService';
import {
  createNotification,
  createNotificationsForAdmins,
} from '../services/notificationService';
import {
  emitTicketCreated,
  emitTicketUpdated,
  emitNewReply,
  emitNewNotification,
} from '../socket/emitters';

const router = Router();

router.post(
  '/',
  requireAuth(),
  validate(CreateTicketSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'customer') {
      throw new AppError('Only customers can create tickets', 403);
    }
    const ticket = await createTicket(req.body, req.user!);

    try {
      const notifications = await createNotificationsForAdmins({
        type: 'new_ticket',
        ticketId: ticket.id,
        message: `New ticket created: ${ticket.display_id} - ${ticket.subject}`,
      });
      emitTicketCreated(ticket);
      for (const n of notifications) {
        emitNewNotification(n.user_id, n);
      }
    } catch (err) {
      console.error('Error emitting ticket_created events:', err);
    }

    res.status(201).json(ticket);
  }),
);

router.get(
  '/',
  requireAuth(),
  validateQuery(ListTicketsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listTickets(
      req.query as unknown as ListTicketsQueryInput,
      req.user!,
    );
    res.json(result);
  }),
);

router.get(
  '/stats',
  requireAuth(),
  requireAdmin(),
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getTicketStats();
    res.json(stats);
  }),
);

router.get(
  '/:id',
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await getTicket(req.params.id as string, req.user!);
    res.json(ticket);
  }),
);

router.put(
  '/:id',
  requireAuth(),
  validate(UpdateTicketSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const ticket = await updateTicket(
      req.params.id as string,
      req.body,
      req.user!,
    );

    try {
      emitTicketUpdated(ticket);
      if (req.body.status === 'closed') {
        const notification = await createNotification({
          userId: ticket.user_id,
          type: 'ticket_closed',
          ticketId: ticket.id,
          message: `Your ticket ${ticket.display_id} has been closed`,
        });
        emitNewNotification(ticket.user_id, notification);
      }
    } catch (err) {
      console.error('Error emitting ticket_updated events:', err);
    }

    res.json(ticket);
  }),
);

router.delete(
  '/:id',
  requireAuth(),
  requireAdmin(),
  asyncHandler(async (req: Request, res: Response) => {
    await deleteTicket(req.params.id as string);
    res.status(204).send();
  }),
);

router.post(
  '/:id/replies',
  requireAuth(),
  validate(CreateReplySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const reply = await createReply(
      req.params.id as string,
      req.body,
      req.user!,
    );

    try {
      const ticketId = req.params.id as string;
      emitNewReply(ticketId, reply);

      if (req.user!.role === 'admin') {
        const ticket = await getTicket(ticketId, req.user!);
        const notification = await createNotification({
          userId: ticket.user_id,
          type: 'new_reply',
          ticketId: ticket.id,
          message: `New reply on ticket ${ticket.display_id}`,
        });
        emitNewNotification(ticket.user_id, notification);
      } else {
        const ticket = await getTicket(ticketId, req.user!);
        const notifications = await createNotificationsForAdmins({
          type: 'new_reply',
          ticketId: ticket.id,
          message: `New reply on ticket ${ticket.display_id} from ${ticket.name}`,
        });
        for (const n of notifications) {
          emitNewNotification(n.user_id, n);
        }
      }
    } catch (err) {
      console.error('Error emitting new_reply events:', err);
    }

    res.status(201).json(reply);
  }),
);

router.get(
  '/:id/replies',
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const replies = await listReplies(req.params.id as string, req.user!);
    res.json(replies);
  }),
);

export default router;
