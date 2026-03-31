import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async Express route handler so thrown errors are
 * automatically forwarded to `next()`.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
