import { Router, Request, Response, NextFunction } from 'express';
import { RegisterSchema } from '@holon/shared';
import { validate } from '../middleware/validate';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  listAdminUsers,
  createAdminUser,
  deleteAdminUser,
} from '../services/adminService';

const router = Router();

router.get(
  '/',
  requireAuth(),
  requireAdmin(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await listAdminUsers();
      res.json(users);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  requireAuth(),
  requireAdmin(),
  validate(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await createAdminUser(req.body);
      res.status(201).json(user);
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
      await deleteAdminUser(req.params.id as string, req.user!.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
