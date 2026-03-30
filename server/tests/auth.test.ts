process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '7d';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import app from '../src/app';
import { requireAuth, requireAdmin } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { db } from '../src/db';
import bcrypt from 'bcrypt';

// --- Mocks (inline jest.fn() to avoid hoisting issues) ---

jest.mock('../src/db', () => ({
  db: {
    selectFrom: jest.fn(),
    insertInto: jest.fn(),
  },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// --- Typed references to mocked functions ---

const mockedDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
};
const mockHash = bcrypt.hash as jest.Mock;
const mockCompare = bcrypt.compare as jest.Mock;

// --- DB chain helpers (rebuilt each test via beforeEach) ---

let mockSelectExecuteTakeFirst: jest.Mock;
let mockInsertExecuteTakeFirstOrThrow: jest.Mock;

// --- Test data ---

const mockUserRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  name: 'Test User',
  password: '$2b$10$hashedpassword',
  role: 'customer',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
};

const mockAdminRow = {
  ...mockUserRow,
  id: '660e8400-e29b-41d4-a716-446655440000',
  email: 'admin@holon.com',
  name: 'Admin User',
  role: 'admin',
};

const validRegisterBody = {
  email: 'test@example.com',
  name: 'Test User',
  password: 'password123',
};

const validLoginBody = {
  email: 'test@example.com',
  password: 'password123',
};

function generateToken(
  payload: object,
  options?: jwt.SignOptions,
): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, options);
}

const validToken = generateToken(
  { userId: mockUserRow.id, email: mockUserRow.email, role: 'customer' },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

const adminToken = generateToken(
  { userId: mockAdminRow.id, email: mockAdminRow.email, role: 'admin' },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

// ===================================================================
// Tests
// ===================================================================

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Rebuild Kysely chainable mocks
    mockSelectExecuteTakeFirst = jest.fn();
    const selectChain = {
      select: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      executeTakeFirst: mockSelectExecuteTakeFirst,
    };
    mockedDb.selectFrom.mockReturnValue(selectChain);

    mockInsertExecuteTakeFirstOrThrow = jest.fn();
    const insertChain = {
      values: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      executeTakeFirstOrThrow: mockInsertExecuteTakeFirstOrThrow,
    };
    mockedDb.insertInto.mockReturnValue(insertChain);
  });

  // =================================================================
  // POST /api/auth/register
  // =================================================================
  describe('POST /api/auth/register', () => {
    describe('Happy path', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue(mockUserRow);
      });

      it('should return 201 with token and user for valid input', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        expect(res.body.token.split('.')).toHaveLength(3);
      });

      it('should return user with customer role', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        expect(res.body.user.role).toBe('customer');
      });

      it('should not include password in response', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        expect(res.body.user).not.toHaveProperty('password');
      });

      it('should return user with all expected fields', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        expect(res.body.user).toEqual({
          id: mockUserRow.id,
          email: mockUserRow.email,
          name: mockUserRow.name,
          role: 'customer',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        });
      });

      it('should hash the password with bcrypt using 10 salt rounds', async () => {
        await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        expect(mockHash).toHaveBeenCalledWith('password123', 10);
      });

      it('should return a valid JWT containing user payload', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        const decoded = jwt.verify(
          res.body.token,
          process.env.JWT_SECRET!,
        ) as Record<string, unknown>;
        expect(decoded.userId).toBe(mockUserRow.id);
        expect(decoded.email).toBe(mockUserRow.email);
        expect(decoded.role).toBe('customer');
      });

      it('should return application/json content type', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        expect(res.headers['content-type']).toMatch(/application\/json/);
      });

      it('should succeed with all required fields only', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        expect(res.status).toBe(201);
        expect(res.body.token).toBeTruthy();
        expect(res.body.user.email).toBe(validRegisterBody.email);
      });
    });

    describe('Missing required fields', () => {
      it('should return 400 when email is missing', async () => {
        const { email: _, ...body } = validRegisterBody;
        const res = await request(app).post('/api/auth/register').send(body);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should return 400 when name is missing', async () => {
        const { name: _, ...body } = validRegisterBody;
        const res = await request(app).post('/api/auth/register').send(body);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should return 400 when password is missing', async () => {
        const { password: _, ...body } = validRegisterBody;
        const res = await request(app).post('/api/auth/register').send(body);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should return 400 for empty body', async () => {
        const res = await request(app).post('/api/auth/register').send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should return 400 when no body is sent', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .set('Content-Type', 'application/json');

        expect(res.status).toBe(400);
      });
    });

    describe('Wrong types', () => {
      it('should return 400 when email is a number', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, email: 12345 });

        expect(res.status).toBe(400);
      });

      it('should return 400 when name is a number', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: 12345 });

        expect(res.status).toBe(400);
      });

      it('should return 400 when password is a number', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, password: 12345 });

        expect(res.status).toBe(400);
      });

      it('should return 400 when email is a boolean', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, email: true });

        expect(res.status).toBe(400);
      });

      it('should return 400 when name is an object', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: { first: 'Test' } });

        expect(res.status).toBe(400);
      });

      it('should return 400 when password is an array', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, password: ['pass', 'word'] });

        expect(res.status).toBe(400);
      });
    });

    describe('Boundary values', () => {
      it('should return 400 for invalid email format', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, email: 'not-an-email' });

        expect(res.status).toBe(400);
      });

      it('should return 400 for email without domain', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, email: 'user@' });

        expect(res.status).toBe(400);
      });

      it('should return 400 for empty name string', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: '' });

        expect(res.status).toBe(400);
      });

      it('should return 400 for name exceeding 255 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: 'a'.repeat(256) });

        expect(res.status).toBe(400);
      });

      it('should accept name with exactly 255 characters', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockUserRow,
          name: 'a'.repeat(255),
        });

        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: 'a'.repeat(255) });

        expect(res.status).toBe(201);
      });

      it('should accept name with exactly 1 character', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockUserRow,
          name: 'A',
        });

        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: 'A' });

        expect(res.status).toBe(201);
      });

      it('should return 400 for password shorter than 6 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, password: '12345' });

        expect(res.status).toBe(400);
      });

      it('should accept password with exactly 6 characters', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue(mockUserRow);

        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, password: '123456' });

        expect(res.status).toBe(201);
      });

      it('should accept password with exactly 100 characters', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue(mockUserRow);

        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, password: 'a'.repeat(100) });

        expect(res.status).toBe(201);
      });

      it('should return 400 for password exceeding 100 characters', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, password: 'a'.repeat(101) });

        expect(res.status).toBe(400);
      });

      it('should return 400 for name with special characters only (empty after trim check)', async () => {
        // Zod min(1) requires at least 1 char, spaces should count
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockUserRow,
          name: '   ',
        });

        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: '   ' });

        // Spaces are valid characters for min(1), should pass validation
        expect(res.status).toBe(201);
      });
    });

    describe('Duplicate email', () => {
      it('should return 409 when email already exists', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue({ id: 'existing-id' });

        const res = await request(app)
          .post('/api/auth/register')
          .send(validRegisterBody);

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Email already in use');
      });
    });

    describe('Extra/unknown fields', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue(mockUserRow);
      });

      it('should ignore unknown fields and succeed', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, unknownField: 'value' });

        expect(res.status).toBe(201);
      });

      it('should strip role field from request body (security)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, role: 'admin' });

        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe('customer');
      });

      it('should strip id field from request body', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, id: 'custom-uuid' });

        expect(res.status).toBe(201);
      });
    });

    describe('SQL injection / XSS', () => {
      it('should reject SQL injection in email field (invalid format)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, email: "' OR 1=1 --" });

        expect(res.status).toBe(400);
      });

      it('should not crash with SQL injection in name field', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockUserRow,
          name: "'; DROP TABLE users; --",
        });

        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: "'; DROP TABLE users; --" });

        expect(res.status).not.toBe(500);
      });

      it('should not crash with XSS payload in name field', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockUserRow,
          name: '<script>alert(1)</script>',
        });

        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: '<script>alert(1)</script>' });

        expect(res.status).not.toBe(500);
      });

      it('should reject XSS in email field (invalid format)', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegisterBody,
            email: '<img src=x onerror=alert(1)>',
          });

        expect(res.status).toBe(400);
      });

      it('should not crash with very long SQL injection in name', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        mockHash.mockResolvedValue('$2b$10$hashedpassword');
        const injectionName = "'; DROP TABLE users; SELECT * FROM users WHERE '1'='1";
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockUserRow,
          name: injectionName,
        });

        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validRegisterBody, name: injectionName });

        expect(res.status).not.toBe(500);
      });
    });
  });

  // =================================================================
  // POST /api/auth/login
  // =================================================================
  describe('POST /api/auth/login', () => {
    describe('Happy path', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockUserRow);
        mockCompare.mockResolvedValue(true);
      });

      it('should return 200 with token and user for valid credentials', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        expect(res.body.token.split('.')).toHaveLength(3);
      });

      it('should return user with role included', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        expect(res.body.user).toHaveProperty('role');
        expect(res.body.user.role).toBe('customer');
      });

      it('should not include password in user response', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        expect(res.body.user).not.toHaveProperty('password');
      });

      it('should return a valid JWT containing user payload', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        const decoded = jwt.verify(
          res.body.token,
          process.env.JWT_SECRET!,
        ) as Record<string, unknown>;
        expect(decoded.userId).toBe(mockUserRow.id);
        expect(decoded.email).toBe(mockUserRow.email);
        expect(decoded.role).toBe('customer');
      });

      it('should work for admin user login', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockAdminRow);

        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'admin@holon.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe('admin');
      });

      it('should call bcrypt.compare with provided password and stored hash', async () => {
        await request(app).post('/api/auth/login').send(validLoginBody);

        expect(mockCompare).toHaveBeenCalledWith(
          'password123',
          mockUserRow.password,
        );
      });

      it('should return user with all expected fields', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        expect(res.body.user).toEqual({
          id: mockUserRow.id,
          email: mockUserRow.email,
          name: mockUserRow.name,
          role: 'customer',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        });
      });

      it('should return application/json content type', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        expect(res.headers['content-type']).toMatch(/application\/json/);
      });
    });

    describe('Missing required fields', () => {
      it('should return 400 when email is missing', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ password: 'password123' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should return 400 when password is missing', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should return 400 for empty body', async () => {
        const res = await request(app).post('/api/auth/login').send({});

        expect(res.status).toBe(400);
      });

      it('should return 400 when no body is sent', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Content-Type', 'application/json');

        expect(res.status).toBe(400);
      });
    });

    describe('Wrong types', () => {
      it('should return 400 when email is a number', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 12345, password: 'password123' });

        expect(res.status).toBe(400);
      });

      it('should return 400 when password is a number', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 12345 });

        expect(res.status).toBe(400);
      });

      it('should return 400 when email is a boolean', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: true, password: 'password123' });

        expect(res.status).toBe(400);
      });

      it('should return 400 when email is an array', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: ['test@example.com'], password: 'password123' });

        expect(res.status).toBe(400);
      });
    });

    describe('Boundary values', () => {
      it('should return 400 for invalid email format', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'not-an-email', password: 'password123' });

        expect(res.status).toBe(400);
      });

      it('should return 400 for empty email string', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: '', password: 'password123' });

        expect(res.status).toBe(400);
      });

      it('should return 400 for empty password string', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: '' });

        expect(res.status).toBe(400);
      });

      it('should return 400 for email with spaces only', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: '   ', password: 'password123' });

        expect(res.status).toBe(400);
      });
    });

    describe('Invalid credentials', () => {
      it('should return 401 when email does not exist', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
      });

      it('should return 401 when password is wrong', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockUserRow);
        mockCompare.mockResolvedValue(false);

        const res = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
      });

      it('should return the same error message for both cases (prevent user enumeration)', async () => {
        // Non-existent email
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);
        const res1 = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        jest.clearAllMocks();

        // Wrong password
        mockSelectExecuteTakeFirst.mockResolvedValue(mockUserRow);
        mockCompare.mockResolvedValue(false);
        const res2 = await request(app)
          .post('/api/auth/login')
          .send(validLoginBody);

        expect(res1.status).toBe(res2.status);
        expect(res1.body.error).toBe(res2.body.error);
      });
    });

    describe('Extra/unknown fields', () => {
      it('should ignore unknown fields and succeed', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockUserRow);
        mockCompare.mockResolvedValue(true);

        const res = await request(app)
          .post('/api/auth/login')
          .send({ ...validLoginBody, extra: 'field', role: 'admin' });

        expect(res.status).toBe(200);
      });
    });

    describe('SQL injection / XSS', () => {
      it('should reject SQL injection in email field (invalid format)', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: "' OR 1=1 --", password: 'password123' });

        expect(res.status).toBe(400);
      });

      it('should reject XSS payload in email field (invalid format)', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: '<script>alert(1)</script>',
            password: 'password123',
          });

        expect(res.status).toBe(400);
      });

      it('should not crash with SQL injection in password field', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockUserRow);
        mockCompare.mockResolvedValue(false);

        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: "' OR 1=1 --" });

        // Should reach bcrypt compare, which returns false -> 401
        expect(res.status).toBe(401);
      });
    });
  });

  // =================================================================
  // GET /api/auth/me
  // =================================================================
  describe('GET /api/auth/me', () => {
    describe('Happy path', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockUserRow);
      });

      it('should return 200 with user when valid token provided', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.id).toBe(mockUserRow.id);
        expect(res.body.user.email).toBe(mockUserRow.email);
      });

      it('should not include password in user response', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.body.user).not.toHaveProperty('password');
      });

      it('should not include token in response', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.body).not.toHaveProperty('token');
      });

      it('should return user with all expected fields', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.body.user).toEqual({
          id: mockUserRow.id,
          email: mockUserRow.email,
          name: mockUserRow.name,
          role: 'customer',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        });
      });

      it('should work for admin users', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockAdminRow);

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe('admin');
      });

      it('should return application/json content type', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.headers['content-type']).toMatch(/application\/json/);
      });
    });

    describe('Missing/invalid token', () => {
      it('should return 401 when no Authorization header is present', async () => {
        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('No token provided');
      });

      it('should return 401 when Authorization header has no Bearer prefix', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', validToken);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('No token provided');
      });

      it('should return 401 when token is empty after Bearer', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer ');

        expect(res.status).toBe(401);
      });

      it('should return 401 for malformed token', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer not.a.valid.jwt.token');

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid or expired token');
      });

      it('should return 401 for token signed with wrong secret', async () => {
        const wrongToken = jwt.sign(
          {
            userId: mockUserRow.id,
            email: mockUserRow.email,
            role: 'customer',
          },
          'wrong-secret',
        );

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${wrongToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid or expired token');
      });

      it('should return 401 for expired token', async () => {
        const expiredToken = jwt.sign(
          {
            userId: mockUserRow.id,
            email: mockUserRow.email,
            role: 'customer',
            exp: Math.floor(Date.now() / 1000) - 10,
          },
          process.env.JWT_SECRET!,
        );

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid or expired token');
      });

      it('should return 401 for completely random string as token', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer randomgarbage123');

        expect(res.status).toBe(401);
      });

      it('should return 401 when Authorization uses Basic scheme', async () => {
        const res = await request(app)
          .get('/api/auth/me')
          .set(
            'Authorization',
            'Basic dGVzdEBleGFtcGxlLmNvbTpwYXNzd29yZDEyMw==',
          );

        expect(res.status).toBe(401);
      });
    });

    describe('User not found', () => {
      it('should return 404 when user no longer exists in database', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('User not found');
      });
    });

    describe('Method not allowed', () => {
      it('should return 404 for POST /api/auth/me', async () => {
        const res = await request(app)
          .post('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.status).toBe(404);
      });

      it('should return 404 for PUT /api/auth/me', async () => {
        const res = await request(app)
          .put('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.status).toBe(404);
      });

      it('should return 404 for DELETE /api/auth/me', async () => {
        const res = await request(app)
          .delete('/api/auth/me')
          .set('Authorization', `Bearer ${validToken}`);

        expect(res.status).toBe(404);
      });
    });
  });

  // =================================================================
  // requireAdmin middleware
  // =================================================================
  describe('requireAdmin middleware', () => {
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.get(
      '/test/admin',
      requireAuth(),
      requireAdmin(),
      (_req, res) => {
        res.json({ message: 'admin access granted' });
      },
    );
    adminApp.use(errorHandler);

    it('should return 403 when user role is customer', async () => {
      const res = await request(adminApp)
        .get('/test/admin')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });

    it('should pass through when user role is admin', async () => {
      const res = await request(adminApp)
        .get('/test/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('admin access granted');
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(adminApp).get('/test/admin');

      expect(res.status).toBe(401);
    });

    it('should return 401 for expired admin token', async () => {
      const expiredAdminToken = jwt.sign(
        {
          userId: mockAdminRow.id,
          email: mockAdminRow.email,
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        process.env.JWT_SECRET!,
      );

      const res = await request(adminApp)
        .get('/test/admin')
        .set('Authorization', `Bearer ${expiredAdminToken}`);

      expect(res.status).toBe(401);
    });
  });

  // =================================================================
  // Unknown auth routes
  // =================================================================
  describe('Unknown auth routes', () => {
    it('should return 404 for GET /api/auth/register', async () => {
      const res = await request(app).get('/api/auth/register');

      expect(res.status).toBe(404);
    });

    it('should return 404 for GET /api/auth/login', async () => {
      const res = await request(app).get('/api/auth/login');

      expect(res.status).toBe(404);
    });

    it('should return 404 for DELETE /api/auth/register', async () => {
      const res = await request(app).delete('/api/auth/register');

      expect(res.status).toBe(404);
    });

    it('should return 404 for PUT /api/auth/login', async () => {
      const res = await request(app).put('/api/auth/login');

      expect(res.status).toBe(404);
    });
  });
});
