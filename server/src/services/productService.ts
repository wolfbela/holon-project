import { z } from 'zod';
import { Product, ProductSchema } from '@holon/shared';
import { AppError } from '../utils/AppError';

const FAKE_STORE_API_URL =
  process.env.FAKE_STORE_API_URL || 'https://api.escuelajs.co/api/v1';

async function fetchExternal(url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new AppError('External API unavailable', 502);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new AppError('Product not found', 404);
    }
    throw new AppError('External API error', 502);
  }

  return response;
}

export async function fetchAllProducts(): Promise<Product[]> {
  const response = await fetchExternal(`${FAKE_STORE_API_URL}/products`);
  const data = await response.json();

  const parsed = z.array(ProductSchema).safeParse(data);
  if (!parsed.success) {
    throw new AppError('Invalid data from external API', 502);
  }

  return parsed.data;
}

export async function fetchProductById(id: number): Promise<Product> {
  const response = await fetchExternal(`${FAKE_STORE_API_URL}/products/${id}`);
  const data = await response.json();

  const parsed = ProductSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError('Invalid data from external API', 502);
  }

  return parsed.data;
}
