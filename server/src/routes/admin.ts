import { Router, Request, Response } from 'express';
import { RegisterSchema } from '@holon/shared';
import { validate } from '../middleware/validate';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
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
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await listAdminUsers();
    res.json(users);
  }),
);

router.post(
  '/',
  requireAuth(),
  requireAdmin(),
  validate(RegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await createAdminUser(req.body);
    res.status(201).json(user);
  }),
);

router.delete(
  '/:id',
  requireAuth(),
  requireAdmin(),
  asyncHandler(async (req: Request, res: Response) => {
    await deleteAdminUser(req.params.id as string, req.user!.userId);
    res.status(204).send();
  }),
);

export default router;
