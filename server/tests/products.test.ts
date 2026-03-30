process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '7d';
process.env.FAKE_STORE_API_URL = 'https://api.escuelajs.co/api/v1';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';

// --- Mocks ---

jest.mock('../src/db', () => ({
  db: {
    selectFrom: jest.fn(),
    insertInto: jest.fn(),
    updateTable: jest.fn(),
    deleteFrom: jest.fn(),
    fn: { countAll: jest.fn() },
  },
}));

// --- Test data ---

const customerPayload = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'customer@example.com',
  role: 'customer' as const,
};

const adminPayload = {
  userId: '660e8400-e29b-41d4-a716-446655440000',
  email: 'admin@holon.com',
  role: 'admin' as const,
};

const customerToken = jwt.sign(customerPayload, 'test-jwt-secret', {
  expiresIn: '7d',
});

const adminToken = jwt.sign(adminPayload, 'test-jwt-secret', {
  expiresIn: '7d',
});

const expiredToken = jwt.sign(customerPayload, 'test-jwt-secret', {
  expiresIn: '-1s',
});

const wrongSecretToken = jwt.sign(customerPayload, 'wrong-secret', {
  expiresIn: '7d',
});

const mockCategory = {
  id: 1,
  name: 'Clothes',
  image: 'https://i.imgur.com/category.jpg',
};

const mockProduct = {
  id: 1,
  title: 'Classic T-Shirt',
  price: 29.99,
  description: 'A comfortable cotton t-shirt',
  category: mockCategory,
  images: ['https://i.imgur.com/shirt1.jpg', 'https://i.imgur.com/shirt2.jpg'],
};

const mockProduct2 = {
  id: 2,
  title: 'Leather Jacket',
  price: 199.99,
  description: 'A stylish leather jacket',
  category: { id: 2, name: 'Outerwear', image: 'https://i.imgur.com/cat2.jpg' },
  images: ['https://i.imgur.com/jacket1.jpg'],
};

const mockProducts = [mockProduct, mockProduct2];

// --- Helpers ---

function mockFetchSuccess(data: unknown, status = 200) {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response);
}

function mockFetchError(status: number) {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ message: 'Error' }),
  } as Response);
}

function mockFetchNetworkError() {
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
}

// --- Setup ---

beforeEach(() => {
  jest.restoreAllMocks();
});

// ============================================================
// GET /api/products
// ============================================================

describe('GET /api/products', () => {
  // --- Authentication ---

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 when token is expired', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('should return 401 when token has wrong secret', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${wrongSecretToken}`);
    expect(res.status).toBe(401);
  });

  it('should return 401 when Authorization header is malformed', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', 'InvalidHeader');
    expect(res.status).toBe(401);
  });

  // --- Happy path ---

  it('should return all products for an authenticated customer', async () => {
    mockFetchSuccess(mockProducts);

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      id: 1,
      title: 'Classic T-Shirt',
      price: 29.99,
    });
    expect(res.body[1]).toMatchObject({
      id: 2,
      title: 'Leather Jacket',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.escuelajs.co/api/v1/products',
    );
  });

  it('should return all products for an authenticated admin', async () => {
    mockFetchSuccess(mockProducts);

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('should return an empty array when external API returns empty list', async () => {
    mockFetchSuccess([]);

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // --- External API errors ---

  it('should return 502 when external API returns 500', async () => {
    mockFetchError(500);

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 502 when external API is unreachable (network error)', async () => {
    mockFetchNetworkError();

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 502 when external API returns malformed data', async () => {
    mockFetchSuccess([{ invalid: 'shape', missing: 'fields' }]);

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 502 when external API returns non-array data', async () => {
    mockFetchSuccess({ not: 'an array' });

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });
});

// ============================================================
// GET /api/products/:id
// ============================================================

describe('GET /api/products/:id', () => {
  // --- Authentication ---

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/products/1');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 when token is expired', async () => {
    const res = await request(app)
      .get('/api/products/1')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('should return 401 when token has wrong secret', async () => {
    const res = await request(app)
      .get('/api/products/1')
      .set('Authorization', `Bearer ${wrongSecretToken}`);
    expect(res.status).toBe(401);
  });

  // --- Happy path ---

  it('should return a single product for an authenticated customer', async () => {
    mockFetchSuccess(mockProduct);

    const res = await request(app)
      .get('/api/products/1')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      title: 'Classic T-Shirt',
      price: 29.99,
      description: 'A comfortable cotton t-shirt',
    });
    expect(res.body.category).toMatchObject({ id: 1, name: 'Clothes' });
    expect(res.body.images).toHaveLength(2);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.escuelajs.co/api/v1/products/1',
    );
  });

  it('should return a single product for an authenticated admin', async () => {
    mockFetchSuccess(mockProduct);

    const res = await request(app)
      .get('/api/products/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  // --- Invalid ID parameter ---

  it('should return 400 for non-numeric product ID', async () => {
    const res = await request(app)
      .get('/api/products/abc')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 for negative product ID', async () => {
    const res = await request(app)
      .get('/api/products/-1')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 for zero product ID', async () => {
    const res = await request(app)
      .get('/api/products/0')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 for float product ID', async () => {
    const res = await request(app)
      .get('/api/products/1.5')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // --- External API errors ---

  it('should return 404 when external API returns 404', async () => {
    mockFetchError(404);

    const res = await request(app)
      .get('/api/products/999')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 502 when external API returns 500', async () => {
    mockFetchError(500);

    const res = await request(app)
      .get('/api/products/1')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 502 when external API is unreachable (network error)', async () => {
    mockFetchNetworkError();

    const res = await request(app)
      .get('/api/products/1')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 502 when external API returns malformed product data', async () => {
    mockFetchSuccess({ id: 'not-a-number', invalid: true });

    const res = await request(app)
      .get('/api/products/1')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });
});
