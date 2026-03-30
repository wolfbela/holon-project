import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new AppError(
            err.issues.map((issue) => issue.message).join(', '),
            400,
          ),
        );
        return;
      }
      next(err);
    }
  };
};

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new AppError(
            err.issues.map((issue) => issue.message).join(', '),
            400,
          ),
        );
        return;
      }
      next(err);
    }
  };
};
