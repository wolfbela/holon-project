import { Router, Request, Response, NextFunction } from 'express';
import { RegisterSchema, LoginSchema } from '@holon/shared';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  registerUser,
  loginUser,
  getCurrentUser,
} from '../services/authService';

const router = Router();

router.post(
  '/register',
  validate(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await registerUser(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/login',
  validate(LoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await loginUser(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/me',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getCurrentUser(req.user!.userId);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
