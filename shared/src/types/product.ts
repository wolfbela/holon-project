import { z } from 'zod';

export const ProductCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  image: z.string(),
});

export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const ProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  price: z.number(),
  description: z.string(),
  category: ProductCategorySchema,
  images: z.array(z.string()),
});

export type Product = z.infer<typeof ProductSchema>;
