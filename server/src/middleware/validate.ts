import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

function createValidator(target: 'body' | 'query') {
  return (schema: ZodSchema) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      try {
        if (target === 'body') {
          req.body = schema.parse(req.body);
        } else {
          req.query = schema.parse(req.query) as typeof req.query;
        }
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
}

export const validate = createValidator('body');
export const validateQuery = createValidator('query');
