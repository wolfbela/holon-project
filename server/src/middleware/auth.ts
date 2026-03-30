import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@holon/shared';
import { AppError } from '../utils/AppError';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const requireAuth = () => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next(new AppError('No token provided', 401));
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      req.user = decoded;
      next();
    } catch {
      next(new AppError('Invalid or expired token', 401));
    }
  };
};

export const requireAdmin = () => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('No token provided', 401));
      return;
    }
    if (req.user.role !== 'admin') {
      next(new AppError('Admin access required', 403));
      return;
    }
    next();
  };
};
