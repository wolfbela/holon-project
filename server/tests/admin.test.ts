process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '7d';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { db } from '../src/db';
import bcrypt from 'bcrypt';

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

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// --- Typed references ---

const mockedDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  deleteFrom: jest.Mock;
};
const mockHash = bcrypt.hash as jest.Mock;

// --- DB chain helpers ---

let mockSelectExecuteTakeFirst: jest.Mock;
let mockSelectExecute: jest.Mock;
let mockInsertExecuteTakeFirstOrThrow: jest.Mock;
let mockDeleteExecuteTakeFirst: jest.Mock;

// --- Test data ---

const mockAdminRow = {
  id: '660e8400-e29b-41d4-a716-446655440000',
  email: 'admin@holon.com',
  name: 'Admin User',
  password: '$2b$10$hashedpassword',
  role: 'admin',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

const mockAdmin2Row = {
  id: '770e8400-e29b-41d4-a716-446655440000',
  email: 'admin2@holon.com',
  name: 'Second Admin',
  password: '$2b$10$hashedpassword2',
  role: 'admin',
  created_at: new Date('2026-02-01T00:00:00Z'),
  updated_at: new Date('2026-02-01T00:00:00Z'),
};

const mockCustomerRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'customer@example.com',
  name: 'Test Customer',
  password: '$2b$10$hashedpassword',
  role: 'customer',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

function generateToken(payload: object, options?: jwt.SignOptions): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, options);
}

const adminToken = generateToken(
  { userId: mockAdminRow.id, email: mockAdminRow.email, role: 'admin' },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

const admin2Token = generateToken(
  { userId: mockAdmin2Row.id, email: mockAdmin2Row.email, role: 'admin' },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

const customerToken = generateToken(
  {
    userId: mockCustomerRow.id,
    email: mockCustomerRow.email,
    role: 'customer',
  },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

const expiredToken = generateToken(
  { userId: mockAdminRow.id, email: mockAdminRow.email, role: 'admin' },
  { expiresIn: '0s' as jwt.SignOptions['expiresIn'] },
);

const validCreateBody = {
  email: 'newadmin@holon.com',
  name: 'New Admin',
  password: 'securepassword',
};

// ===================================================================
// Helper to set up DB mocks
// ===================================================================

function setupDbMocks() {
  mockSelectExecuteTakeFirst = jest.fn();
  mockSelectExecute = jest.fn();
  mockInsertExecuteTakeFirstOrThrow = jest.fn();
  mockDeleteExecuteTakeFirst = jest.fn();

  const selectChain: Record<string, jest.Mock> = {
    select: jest.fn(),
    selectAll: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    executeTakeFirst: mockSelectExecuteTakeFirst,
    execute: mockSelectExecute,
  };
  for (const key of Object.keys(selectChain)) {
    if (key !== 'executeTakeFirst' && key !== 'execute') {
      selectChain[key].mockReturnValue(selectChain);
    }
  }
  mockedDb.selectFrom.mockReturnValue(selectChain);

  const insertChain: Record<string, jest.Mock> = {
    values: jest.fn(),
    returningAll: jest.fn(),
    executeTakeFirstOrThrow: mockInsertExecuteTakeFirstOrThrow,
  };
  for (const key of Object.keys(insertChain)) {
    if (key !== 'executeTakeFirstOrThrow') {
      insertChain[key].mockReturnValue(insertChain);
    }
  }
  mockedDb.insertInto.mockReturnValue(insertChain);

  const deleteChain: Record<string, jest.Mock> = {
    where: jest.fn(),
    returning: jest.fn(),
    executeTakeFirst: mockDeleteExecuteTakeFirst,
  };
  for (const key of Object.keys(deleteChain)) {
    if (key !== 'executeTakeFirst') {
      deleteChain[key].mockReturnValue(deleteChain);
    }
  }
  mockedDb.deleteFrom.mockReturnValue(deleteChain);
}

// ===================================================================
// GET /api/admin/users
// ===================================================================

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // -----------------------------------------------------------------
  // A. Happy path
  // -----------------------------------------------------------------

  describe('Happy path', () => {
    it('should return a list of admin users (200)', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockAdminRow, mockAdmin2Row]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it('should return admin users without password field', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockAdminRow]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).not.toHaveProperty('password');
    });

    it('should return users with all expected fields', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockAdminRow]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({
        id: mockAdminRow.id,
        email: mockAdminRow.email,
        name: mockAdminRow.name,
        role: 'admin',
      });
      expect(res.body[0]).toHaveProperty('created_at');
      expect(res.body[0]).toHaveProperty('updated_at');
    });

    it('should return ISO-8601 timestamps', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockAdminRow]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].created_at).toBe('2026-01-01T00:00:00.000Z');
      expect(res.body[0].updated_at).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should return empty array when no admin users exist', async () => {
      mockSelectExecute.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should only return users with admin role', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockAdminRow, mockAdmin2Row]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const user of res.body) {
        expect(user.role).toBe('admin');
      }
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/admin/users');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when token is expired', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when token has wrong secret', async () => {
      const badToken = jwt.sign(
        { userId: mockAdminRow.id, email: mockAdminRow.email, role: 'admin' },
        'wrong-secret',
      );

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'InvalidFormat token123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when Authorization header has no Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', adminToken);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 403 when customer tries to access admin users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });
  });
});

// ===================================================================
// POST /api/admin/users
// ===================================================================

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // -----------------------------------------------------------------
  // A. Happy path
  // -----------------------------------------------------------------

  describe('Happy path', () => {
    it('should create a new admin user (201)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      const newAdminRow = {
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: validCreateBody.email,
        name: validCreateBody.name,
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      };
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce(newAdminRow);

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCreateBody);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: newAdminRow.id,
        email: validCreateBody.email,
        name: validCreateBody.name,
        role: 'admin',
      });
    });

    it('should not include password in the response', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: validCreateBody.email,
        name: validCreateBody.name,
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCreateBody);

      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('password');
    });

    it('should hash the password with bcrypt before saving', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: validCreateBody.email,
        name: validCreateBody.name,
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCreateBody);

      expect(res.status).toBe(201);
      expect(mockHash).toHaveBeenCalledWith(validCreateBody.password, 10);
    });

    it('should set role to admin automatically', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: validCreateBody.email,
        name: validCreateBody.name,
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCreateBody);

      expect(res.status).toBe(201);
      expect(res.body.role).toBe('admin');
    });

    it('should return ISO-8601 timestamps', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: validCreateBody.email,
        name: validCreateBody.name,
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCreateBody);

      expect(res.status).toBe(201);
      expect(res.body.created_at).toBe('2026-03-01T00:00:00.000Z');
      expect(res.body.updated_at).toBe('2026-03-01T00:00:00.000Z');
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .send(validCreateBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when token is expired', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(validCreateBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when token has wrong secret', async () => {
      const badToken = jwt.sign(
        { userId: mockAdminRow.id, email: mockAdminRow.email, role: 'admin' },
        'wrong-secret',
      );

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${badToken}`)
        .send(validCreateBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', 'InvalidFormat token123')
        .send(validCreateBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 403 when customer tries to create admin user', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validCreateBody);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });
  });

  // -----------------------------------------------------------------
  // C. Validation — missing required fields
  // -----------------------------------------------------------------

  describe('Missing required fields', () => {
    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Admin', password: 'securepassword' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'new@holon.com', password: 'securepassword' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'new@holon.com', name: 'New Admin' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when body is empty', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------
  // D. Validation — wrong types
  // -----------------------------------------------------------------

  describe('Wrong types', () => {
    it('should return 400 when email is a number', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 12345, name: 'New Admin', password: 'securepassword' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when name is a number', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new@holon.com',
          name: 12345,
          password: 'securepassword',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is a number', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'new@holon.com', name: 'New Admin', password: 123456 });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------
  // E. Validation — boundary values
  // -----------------------------------------------------------------

  describe('Boundary values', () => {
    it('should return 400 when email is invalid format', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'not-an-email',
          name: 'New Admin',
          password: 'securepassword',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when email is empty string', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: '', name: 'New Admin', password: 'securepassword' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when name is empty string', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'new@holon.com', name: '', password: 'securepassword' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when name exceeds 255 characters', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new@holon.com',
          name: 'A'.repeat(256),
          password: 'securepassword',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'new@holon.com', name: 'New Admin', password: '12345' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password exceeds 100 characters', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new@holon.com',
          name: 'New Admin',
          password: 'A'.repeat(101),
        });

      expect(res.status).toBe(400);
    });

    it('should accept password at exactly 6 characters (minimum)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: 'new@holon.com',
        name: 'New Admin',
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new@holon.com',
          name: 'New Admin',
          password: '123456',
        });

      expect(res.status).toBe(201);
    });

    it('should accept name at exactly 255 characters (maximum)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: 'new@holon.com',
        name: 'A'.repeat(255),
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new@holon.com',
          name: 'A'.repeat(255),
          password: 'securepassword',
        });

      expect(res.status).toBe(201);
    });
  });

  // -----------------------------------------------------------------
  // F. Extra/unknown fields
  // -----------------------------------------------------------------

  describe('Extra/unknown fields', () => {
    it('should ignore extra unknown fields and still create user', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: validCreateBody.email,
        name: validCreateBody.name,
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validCreateBody,
          unknownField: 'should be ignored',
          role: 'customer',
        });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe('admin');
    });
  });

  // -----------------------------------------------------------------
  // I. Business logic edge cases
  // -----------------------------------------------------------------

  describe('Business logic edge cases', () => {
    it('should return 409 when email already exists', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockAdminRow.id,
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: mockAdminRow.email,
          name: 'Duplicate Admin',
          password: 'securepassword',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already in use');
    });

    it('should return 409 when customer email already exists', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockCustomerRow.id,
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: mockCustomerRow.email,
          name: 'Should Conflict',
          password: 'securepassword',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already in use');
    });
  });

  // -----------------------------------------------------------------
  // J. SQL injection / XSS payloads
  // -----------------------------------------------------------------

  describe('SQL injection / XSS payloads', () => {
    it('should not crash with SQL injection in email field', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: "' OR 1=1 --",
          name: 'Hacker',
          password: 'securepassword',
        });

      expect(res.status).not.toBe(500);
    });

    it('should not crash with XSS payload in name field', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: 'xss@holon.com',
        name: '<script>alert(1)</script>',
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'xss@holon.com',
          name: '<script>alert(1)</script>',
          password: 'securepassword',
        });

      expect(res.status).not.toBe(500);
    });

    it('should not crash with SQL injection in name field', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);
      mockHash.mockResolvedValueOnce('$2b$10$newhash');
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        id: '880e8400-e29b-41d4-a716-446655440000',
        email: 'sqli@holon.com',
        name: "'; DROP TABLE users; --",
        password: '$2b$10$newhash',
        role: 'admin',
        created_at: new Date('2026-03-01T00:00:00Z'),
        updated_at: new Date('2026-03-01T00:00:00Z'),
      });

      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'sqli@holon.com',
          name: "'; DROP TABLE users; --",
          password: 'securepassword',
        });

      expect(res.status).not.toBe(500);
    });
  });
});

// ===================================================================
// DELETE /api/admin/users/:id
// ===================================================================

describe('DELETE /api/admin/users/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // -----------------------------------------------------------------
  // A. Happy path
  // -----------------------------------------------------------------

  describe('Happy path', () => {
    it('should delete an admin user (204)', async () => {
      mockDeleteExecuteTakeFirst.mockResolvedValueOnce({
        id: mockAdmin2Row.id,
      });

      const res = await request(app)
        .delete(`/api/admin/users/${mockAdmin2Row.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
    });

    it('should allow admin2 to delete admin1', async () => {
      mockDeleteExecuteTakeFirst.mockResolvedValueOnce({
        id: mockAdminRow.id,
      });

      const res = await request(app)
        .delete(`/api/admin/users/${mockAdminRow.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(204);
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).delete(
        `/api/admin/users/${mockAdmin2Row.id}`,
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when token is expired', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${mockAdmin2Row.id}`)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when token has wrong secret', async () => {
      const badToken = jwt.sign(
        { userId: mockAdminRow.id, email: mockAdminRow.email, role: 'admin' },
        'wrong-secret',
      );

      const res = await request(app)
        .delete(`/api/admin/users/${mockAdmin2Row.id}`)
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${mockAdmin2Row.id}`)
        .set('Authorization', 'Basic token123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 403 when customer tries to delete admin user', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${mockAdmin2Row.id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });
  });

  // -----------------------------------------------------------------
  // G. Path parameters
  // -----------------------------------------------------------------

  describe('Path parameters', () => {
    it('should return 404 when admin user ID does not exist', async () => {
      mockDeleteExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete('/api/admin/users/999e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Admin user not found');
    });

    it('should handle non-UUID string as ID gracefully', async () => {
      mockDeleteExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete('/api/admin/users/not-a-valid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).not.toBe(500);
    });
  });

  // -----------------------------------------------------------------
  // I. Business logic edge cases
  // -----------------------------------------------------------------

  describe('Business logic edge cases', () => {
    it('should return 400 when admin tries to delete themselves', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${mockAdminRow.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot delete your own account');
    });

    it('should return 404 when trying to delete a customer user (not admin)', async () => {
      mockDeleteExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete(`/api/admin/users/${mockCustomerRow.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Admin user not found');
    });
  });

  // -----------------------------------------------------------------
  // J. SQL injection / XSS payloads
  // -----------------------------------------------------------------

  describe('SQL injection / XSS payloads', () => {
    it('should not crash with SQL injection in ID parameter', async () => {
      mockDeleteExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete("/api/admin/users/' OR 1=1 --")
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).not.toBe(500);
    });

    it('should not crash with XSS payload in ID parameter', async () => {
      mockDeleteExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete('/api/admin/users/<script>alert(1)</script>')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).not.toBe(500);
    });
  });
});
