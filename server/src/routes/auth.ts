import { Router, Request, Response } from 'express';
import { RegisterSchema, LoginSchema } from '@holon/shared';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  registerUser,
  loginUser,
  getCurrentUser,
} from '../services/authService';

const router = Router();

router.post(
  '/register',
  validate(RegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  }),
);

router.post(
  '/login',
  validate(LoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await loginUser(req.body);
    res.json(result);
  }),
);

router.get(
  '/me',
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await getCurrentUser(req.user!.userId);
    res.json({ user });
  }),
);

export default router;
