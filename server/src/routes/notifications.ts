import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from '../services/notificationService';

const router = Router();

router.get(
  '/',
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listNotifications(req.user!);
    res.json(result);
  }),
);

router.put(
  '/read-all',
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    await markAllAsRead(req.user!);
    res.json({ message: 'All notifications marked as read' });
  }),
);

router.put(
  '/:id/read',
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const notification = await markAsRead(req.params.id as string, req.user!);
    res.json(notification);
  }),
);

export default router;
