import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { fetchAllProducts, fetchProductById } from '../services/productService';
import { AppError } from '../utils/AppError';

const router = Router();

router.get(
  '/',
  requireAuth(),
  asyncHandler(async (_req: Request, res: Response) => {
    const products = await fetchAllProducts();
    res.json(products);
  }),
);

router.get(
  '/:id',
  requireAuth(),
  (req: Request, _res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      next(new AppError('Invalid product ID', 400));
      return;
    }
    next();
  },
  asyncHandler(async (req: Request, res: Response) => {
    const product = await fetchProductById(Number(req.params.id));
    res.json(product);
  }),
);

export default router;
