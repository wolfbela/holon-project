import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from '../services/notificationService';

const router = Router();

router.get(
  '/',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await listNotifications(req.user!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/read-all',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await markAllAsRead(req.user!);
      res.json({ message: 'All notifications marked as read' });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id/read',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notification = await markAsRead(req.params.id as string, req.user!);
      res.json(notification);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
