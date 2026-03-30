import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  ListTicketsQuerySchema,
  ListTicketsQueryInput,
} from '@holon/shared';
import { validate, validateQuery } from '../middleware/validate';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { AppError } from '../utils/AppError';
import {
  createTicket,
  listTickets,
  getTicket,
  updateTicket,
  deleteTicket,
} from '../services/ticketService';

const router = Router();

router.post(
  '/',
  requireAuth(),
  validate(CreateTicketSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'customer') {
        throw new AppError('Only customers can create tickets', 403);
      }
      const ticket = await createTicket(req.body, req.user!);
      res.status(201).json(ticket);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/',
  requireAuth(),
  validateQuery(ListTicketsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listTickets(
        req.query as unknown as ListTicketsQueryInput,
        req.user!,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await getTicket(req.params.id as string, req.user!);
      res.json(ticket);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id',
  requireAuth(),
  validate(UpdateTicketSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await updateTicket(
        req.params.id as string,
        req.body,
        req.user!,
      );
      res.json(ticket);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  requireAuth(),
  requireAdmin(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteTicket(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
