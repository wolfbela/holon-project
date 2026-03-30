import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { fetchAllProducts, fetchProductById } from '../services/productService';
import { AppError } from '../utils/AppError';

const router = Router();

router.get(
  '/',
  requireAuth(),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await fetchAllProducts();
      res.json(products);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  requireAuth(),
  async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      next(new AppError('Invalid product ID', 400));
      return;
    }

    try {
      const product = await fetchProductById(id);
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
