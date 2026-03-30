process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '7d';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { db } from '../src/db';

// --- Mocks ---

jest.mock('../src/db', () => ({
  db: {
    selectFrom: jest.fn(),
    insertInto: jest.fn(),
    updateTable: jest.fn(),
    deleteFrom: jest.fn(),
    fn: {
      countAll: jest.fn(),
    },
  },
}));

jest.mock('../src/socket/emitters', () => ({
  emitNewReply: jest.fn(),
  emitTicketUpdated: jest.fn(),
  emitTicketCreated: jest.fn(),
  emitNewNotification: jest.fn(),
}));

jest.mock('../src/services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue({
    id: 'mock-notif-id',
    user_id: 'mock-user-id',
    type: 'new_reply',
    ticket_id: 'mock-ticket-id',
    message: 'mock notification',
    read: false,
    created_at: '2026-01-01T00:00:00.000Z',
  }),
  createNotificationsForAdmins: jest.fn().mockResolvedValue([]),
  listNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
}));

// --- Typed references ---

const mockedDb = db as unknown as {
  selectFrom: jest.Mock;
  insertInto: jest.Mock;
  updateTable: jest.Mock;
  deleteFrom: jest.Mock;
  fn: { countAll: jest.Mock };
};

// --- DB chain helpers ---

let mockSelectExecuteTakeFirst: jest.Mock;
let mockSelectExecuteTakeFirstOrThrow: jest.Mock;
let mockSelectExecute: jest.Mock;
let mockInsertExecuteTakeFirstOrThrow: jest.Mock;
let mockUpdateExecuteTakeFirstOrThrow: jest.Mock;
let mockDeleteExecuteTakeFirst: jest.Mock;

// --- Test data ---

const mockUserRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'customer@example.com',
  name: 'Test Customer',
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

const mockCustomer2Row = {
  ...mockUserRow,
  id: '770e8400-e29b-41d4-a716-446655440000',
  email: 'customer2@example.com',
  name: 'Second Customer',
};

const mockTicketRow = {
  id: 'aaa00000-0000-0000-0000-000000000001',
  display_id: 'TK-0001',
  user_id: mockUserRow.id,
  email: mockUserRow.email,
  name: mockUserRow.name,
  product_id: 1,
  product_name: 'Fjallraven Backpack',
  subject: 'Product arrived damaged',
  message: 'The zipper on my backpack was broken when it arrived.',
  status: 'open',
  priority: 'medium',
  created_at: new Date('2026-01-15T10:00:00Z'),
  updated_at: new Date('2026-01-15T10:00:00Z'),
};

const mockTicketRow2 = {
  ...mockTicketRow,
  id: 'aaa00000-0000-0000-0000-000000000002',
  display_id: 'TK-0002',
  user_id: mockCustomer2Row.id,
  email: mockCustomer2Row.email,
  name: mockCustomer2Row.name,
  subject: 'Wrong color received',
  message: 'I ordered blue but received red.',
  status: 'closed',
  priority: 'high',
};

const validCreateBody = {
  product_id: 1,
  product_name: 'Fjallraven Backpack',
  subject: 'Product arrived damaged',
  message: 'The zipper on my backpack was broken when it arrived.',
};

function generateToken(payload: object, options?: jwt.SignOptions): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, options);
}

const customerToken = generateToken(
  { userId: mockUserRow.id, email: mockUserRow.email, role: 'customer' },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

const adminToken = generateToken(
  { userId: mockAdminRow.id, email: mockAdminRow.email, role: 'admin' },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

const expiredToken = generateToken(
  { userId: mockUserRow.id, email: mockUserRow.email, role: 'customer' },
  { expiresIn: '0s' as jwt.SignOptions['expiresIn'] },
);

// ===================================================================
// Helper to set up DB mocks
// ===================================================================

function setupDbMocks() {
  mockSelectExecuteTakeFirst = jest.fn();
  mockSelectExecuteTakeFirstOrThrow = jest.fn();
  mockSelectExecute = jest.fn();

  const mockCountAllAs = jest.fn().mockReturnValue('count_expression');
  mockedDb.fn.countAll.mockReturnValue({ as: mockCountAllAs });

  const selectChain: Record<string, jest.Mock> = {
    select: jest.fn(),
    selectAll: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    executeTakeFirst: mockSelectExecuteTakeFirst,
    executeTakeFirstOrThrow: mockSelectExecuteTakeFirstOrThrow,
    execute: mockSelectExecute,
  };
  // Make all chain methods return the chain itself
  for (const key of Object.keys(selectChain)) {
    if (
      key !== 'executeTakeFirst' &&
      key !== 'executeTakeFirstOrThrow' &&
      key !== 'execute'
    ) {
      selectChain[key].mockReturnValue(selectChain);
    }
  }
  mockedDb.selectFrom.mockReturnValue(selectChain);

  mockInsertExecuteTakeFirstOrThrow = jest.fn();
  const insertChain: Record<string, jest.Mock> = {
    values: jest.fn(),
    returningAll: jest.fn(),
    executeTakeFirstOrThrow: mockInsertExecuteTakeFirstOrThrow,
  };
  insertChain.values.mockReturnValue(insertChain);
  insertChain.returningAll.mockReturnValue(insertChain);
  mockedDb.insertInto.mockReturnValue(insertChain);

  mockUpdateExecuteTakeFirstOrThrow = jest.fn();
  const updateChain: Record<string, jest.Mock> = {
    set: jest.fn(),
    where: jest.fn(),
    returningAll: jest.fn(),
    executeTakeFirstOrThrow: mockUpdateExecuteTakeFirstOrThrow,
  };
  updateChain.set.mockReturnValue(updateChain);
  updateChain.where.mockReturnValue(updateChain);
  updateChain.returningAll.mockReturnValue(updateChain);
  mockedDb.updateTable.mockReturnValue(updateChain);

  mockDeleteExecuteTakeFirst = jest.fn();
  const deleteChain: Record<string, jest.Mock> = {
    where: jest.fn(),
    returning: jest.fn(),
    executeTakeFirst: mockDeleteExecuteTakeFirst,
  };
  deleteChain.where.mockReturnValue(deleteChain);
  deleteChain.returning.mockReturnValue(deleteChain);
  mockedDb.deleteFrom.mockReturnValue(deleteChain);
}

// ===================================================================
// Tests
// ===================================================================

describe('Tickets API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // =================================================================
  // POST /api/tickets
  // =================================================================
  describe('POST /api/tickets', () => {
    describe('Happy path', () => {
      beforeEach(() => {
        // selectFrom('users') → user lookup
        mockSelectExecuteTakeFirst.mockResolvedValue({
          email: mockUserRow.email,
          name: mockUserRow.name,
        });
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue(mockTicketRow);
      });

      it('should return 201 with created ticket for valid input', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(validCreateBody);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('display_id');
        expect(res.body.status).toBe('open');
        expect(res.body.priority).toBe('medium');
      });

      it('should return ticket with all expected fields', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(validCreateBody);

        expect(res.body).toEqual({
          id: mockTicketRow.id,
          display_id: 'TK-0001',
          user_id: mockUserRow.id,
          email: mockUserRow.email,
          name: mockUserRow.name,
          product_id: 1,
          product_name: 'Fjallraven Backpack',
          subject: 'Product arrived damaged',
          message: 'The zipper on my backpack was broken when it arrived.',
          status: 'open',
          priority: 'medium',
          created_at: '2026-01-15T10:00:00.000Z',
          updated_at: '2026-01-15T10:00:00.000Z',
        });
      });

      it('should return application/json content type', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(validCreateBody);

        expect(res.headers['content-type']).toMatch(/application\/json/);
      });

      it('should look up user from database to get email and name', async () => {
        await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(validCreateBody);

        expect(mockedDb.selectFrom).toHaveBeenCalledWith('users');
        expect(mockedDb.insertInto).toHaveBeenCalledWith('tickets');
      });
    });

    describe('Authentication & authorization', () => {
      it('should return 401 when no token is provided', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .send(validCreateBody);

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
      });

      it('should return 401 when token is invalid', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', 'Bearer invalid-token-123')
          .send(validCreateBody);

        expect(res.status).toBe(401);
      });

      it('should return 401 when token is expired', async () => {
        // Wait a tick to ensure token is expired
        await new Promise((r) => setTimeout(r, 10));
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${expiredToken}`)
          .send(validCreateBody);

        expect(res.status).toBe(401);
      });

      it('should return 401 when Authorization header has wrong format', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', customerToken)
          .send(validCreateBody);

        expect(res.status).toBe(401);
      });

      it('should return 403 when admin tries to create a ticket', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(validCreateBody);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/only customers/i);
      });
    });

    describe('Missing required fields', () => {
      it('should return 400 when product_id is missing', async () => {
        const { product_id: _product_id, ...body } = validCreateBody;
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(body);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      it('should return 400 when product_name is missing', async () => {
        const { product_name: _product_name, ...body } = validCreateBody;
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(body);

        expect(res.status).toBe(400);
      });

      it('should return 400 when subject is missing', async () => {
        const { subject: _subject, ...body } = validCreateBody;
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(body);

        expect(res.status).toBe(400);
      });

      it('should return 400 when message is missing', async () => {
        const { message: _message, ...body } = validCreateBody;
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(body);

        expect(res.status).toBe(400);
      });

      it('should return 400 for empty body', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({});

        expect(res.status).toBe(400);
      });

      it('should return 400 when no body is sent', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .set('Content-Type', 'application/json');

        expect(res.status).toBe(400);
      });
    });

    describe('Wrong types', () => {
      it('should return 400 when product_id is a string', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, product_id: 'abc' });

        expect(res.status).toBe(400);
      });

      it('should return 400 when product_name is a number', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, product_name: 12345 });

        expect(res.status).toBe(400);
      });

      it('should return 400 when subject is a boolean', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, subject: true });

        expect(res.status).toBe(400);
      });

      it('should return 400 when message is an array', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, message: ['msg1', 'msg2'] });

        expect(res.status).toBe(400);
      });

      it('should return 400 when product_id is an object', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, product_id: { id: 1 } });

        expect(res.status).toBe(400);
      });
    });

    describe('Boundary values', () => {
      it('should return 400 when product_id is 0', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, product_id: 0 });

        expect(res.status).toBe(400);
      });

      it('should return 400 when product_id is negative', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, product_id: -1 });

        expect(res.status).toBe(400);
      });

      it('should return 400 when product_name is empty string', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, product_name: '' });

        expect(res.status).toBe(400);
      });

      it('should return 400 when subject is empty string', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, subject: '' });

        expect(res.status).toBe(400);
      });

      it('should return 400 when subject exceeds 255 characters', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, subject: 'a'.repeat(256) });

        expect(res.status).toBe(400);
      });

      it('should accept subject with exactly 255 characters', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue({
          email: mockUserRow.email,
          name: mockUserRow.name,
        });
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockTicketRow,
          subject: 'a'.repeat(255),
        });

        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, subject: 'a'.repeat(255) });

        expect(res.status).toBe(201);
      });

      it('should return 400 when message is empty string', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, message: '' });

        expect(res.status).toBe(400);
      });

      it('should return 400 when message exceeds 5000 characters', async () => {
        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, message: 'a'.repeat(5001) });

        expect(res.status).toBe(400);
      });

      it('should accept message with exactly 5000 characters', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue({
          email: mockUserRow.email,
          name: mockUserRow.name,
        });
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockTicketRow,
          message: 'a'.repeat(5000),
        });

        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, message: 'a'.repeat(5000) });

        expect(res.status).toBe(201);
      });

      it('should accept product_id as a float (Zod number().positive() allows it)', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue({
          email: mockUserRow.email,
          name: mockUserRow.name,
        });
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockTicketRow,
          product_id: 1.5,
        });

        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, product_id: 1.5 });

        // Zod number().positive() accepts floats; DB will handle integer conversion
        expect(res.status).toBe(201);
      });
    });

    describe('Extra/unknown fields', () => {
      it('should ignore extra unknown fields', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue({
          email: mockUserRow.email,
          name: mockUserRow.name,
        });
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue(mockTicketRow);

        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            ...validCreateBody,
            unknown_field: 'hack',
            status: 'closed',
          });

        expect(res.status).toBe(201);
      });
    });

    describe('Business logic edge cases', () => {
      it('should return 404 when user is not found in database', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(validCreateBody);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/user not found/i);
      });
    });

    describe('SQL injection / XSS payloads', () => {
      it('should not crash with SQL injection in subject', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue({
          email: mockUserRow.email,
          name: mockUserRow.name,
        });
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockTicketRow,
          subject: "' OR 1=1 --",
        });

        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ ...validCreateBody, subject: "' OR 1=1 --" });

        expect(res.status).not.toBe(500);
      });

      it('should not crash with XSS payload in message', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue({
          email: mockUserRow.email,
          name: mockUserRow.name,
        });
        mockInsertExecuteTakeFirstOrThrow.mockResolvedValue({
          ...mockTicketRow,
          message: '<img src=x onerror=alert(1)>',
        });

        const res = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            ...validCreateBody,
            message: '<img src=x onerror=alert(1)>',
          });

        expect(res.status).not.toBe(500);
      });
    });
  });

  // =================================================================
  // GET /api/tickets
  // =================================================================
  describe('GET /api/tickets', () => {
    describe('Happy path', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirstOrThrow.mockResolvedValue({ total: '2' });
        mockSelectExecute.mockResolvedValue([mockTicketRow, mockTicketRow2]);
      });

      it('should return 200 with paginated list for admin', async () => {
        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should return pagination metadata', async () => {
        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.body.pagination).toEqual({
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        });
      });

      it('should return 200 with paginated list for customer', async () => {
        mockSelectExecuteTakeFirstOrThrow.mockResolvedValue({ total: '1' });
        mockSelectExecute.mockResolvedValue([mockTicketRow]);

        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
      });

      it('should return tickets with all expected fields', async () => {
        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${adminToken}`);

        const ticket = res.body.data[0];
        expect(ticket).toHaveProperty('id');
        expect(ticket).toHaveProperty('display_id');
        expect(ticket).toHaveProperty('user_id');
        expect(ticket).toHaveProperty('email');
        expect(ticket).toHaveProperty('name');
        expect(ticket).toHaveProperty('product_id');
        expect(ticket).toHaveProperty('product_name');
        expect(ticket).toHaveProperty('subject');
        expect(ticket).toHaveProperty('message');
        expect(ticket).toHaveProperty('status');
        expect(ticket).toHaveProperty('priority');
        expect(ticket).toHaveProperty('created_at');
        expect(ticket).toHaveProperty('updated_at');
      });

      it('should return empty data array when no tickets exist', async () => {
        mockSelectExecuteTakeFirstOrThrow.mockResolvedValue({ total: '0' });
        mockSelectExecute.mockResolvedValue([]);

        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.pagination.total).toBe(0);
        expect(res.body.pagination.totalPages).toBe(0);
      });
    });

    describe('Authentication', () => {
      it('should return 401 when no token is provided', async () => {
        const res = await request(app).get('/api/tickets');

        expect(res.status).toBe(401);
      });

      it('should return 401 when token is invalid', async () => {
        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
      });

      it('should return 401 when token is expired', async () => {
        await new Promise((r) => setTimeout(r, 10));
        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
      });
    });

    describe('Query parameters — filtering', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirstOrThrow.mockResolvedValue({ total: '1' });
        mockSelectExecute.mockResolvedValue([mockTicketRow]);
      });

      it('should accept status=open filter', async () => {
        const res = await request(app)
          .get('/api/tickets?status=open')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept status=closed filter', async () => {
        const res = await request(app)
          .get('/api/tickets?status=closed')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should return 400 for invalid status value', async () => {
        const res = await request(app)
          .get('/api/tickets?status=pending')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should accept priority=low filter', async () => {
        const res = await request(app)
          .get('/api/tickets?priority=low')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept priority=medium filter', async () => {
        const res = await request(app)
          .get('/api/tickets?priority=medium')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept priority=high filter', async () => {
        const res = await request(app)
          .get('/api/tickets?priority=high')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should return 400 for invalid priority value', async () => {
        const res = await request(app)
          .get('/api/tickets?priority=critical')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should accept search parameter', async () => {
        const res = await request(app)
          .get('/api/tickets?search=damaged')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept combined filters', async () => {
        const res = await request(app)
          .get('/api/tickets?status=open&priority=high&search=test')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });
    });

    describe('Query parameters — sorting', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirstOrThrow.mockResolvedValue({ total: '1' });
        mockSelectExecute.mockResolvedValue([mockTicketRow]);
      });

      it('should accept sort=created_at', async () => {
        const res = await request(app)
          .get('/api/tickets?sort=created_at')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept sort=updated_at', async () => {
        const res = await request(app)
          .get('/api/tickets?sort=updated_at')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept sort=priority', async () => {
        const res = await request(app)
          .get('/api/tickets?sort=priority')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept sort=status', async () => {
        const res = await request(app)
          .get('/api/tickets?sort=status')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should return 400 for invalid sort column', async () => {
        const res = await request(app)
          .get('/api/tickets?sort=email')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should return 400 for SQL injection in sort', async () => {
        const res = await request(app)
          .get('/api/tickets?sort=created_at;DROP TABLE tickets')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should accept order=asc', async () => {
        const res = await request(app)
          .get('/api/tickets?order=asc')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept order=desc', async () => {
        const res = await request(app)
          .get('/api/tickets?order=desc')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should return 400 for invalid order value', async () => {
        const res = await request(app)
          .get('/api/tickets?order=ascending')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });
    });

    describe('Query parameters — pagination', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirstOrThrow.mockResolvedValue({ total: '50' });
        mockSelectExecute.mockResolvedValue([mockTicketRow]);
      });

      it('should accept page=2', async () => {
        const res = await request(app)
          .get('/api/tickets?page=2')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(2);
      });

      it('should accept limit=5', async () => {
        const res = await request(app)
          .get('/api/tickets?limit=5')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBe(5);
      });

      it('should return 400 for page=0', async () => {
        const res = await request(app)
          .get('/api/tickets?page=0')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should return 400 for page=-1', async () => {
        const res = await request(app)
          .get('/api/tickets?page=-1')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should return 400 for limit=0', async () => {
        const res = await request(app)
          .get('/api/tickets?limit=0')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should return 400 for limit=-1', async () => {
        const res = await request(app)
          .get('/api/tickets?limit=-1')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should return 400 for limit=101 (exceeds max)', async () => {
        const res = await request(app)
          .get('/api/tickets?limit=101')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should accept limit=100 (max allowed)', async () => {
        const res = await request(app)
          .get('/api/tickets?limit=100')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should accept limit=1 (min allowed)', async () => {
        const res = await request(app)
          .get('/api/tickets?limit=1')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should return 400 for non-numeric page', async () => {
        const res = await request(app)
          .get('/api/tickets?page=abc')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should return 400 for non-numeric limit', async () => {
        const res = await request(app)
          .get('/api/tickets?limit=abc')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
      });

      it('should use default pagination when no params provided', async () => {
        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(10);
      });

      it('should calculate totalPages correctly', async () => {
        mockSelectExecuteTakeFirstOrThrow.mockResolvedValue({ total: '25' });

        const res = await request(app)
          .get('/api/tickets?limit=10')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.body.pagination.totalPages).toBe(3);
      });
    });

    describe('Role-based filtering', () => {
      beforeEach(() => {
        mockSelectExecuteTakeFirstOrThrow.mockResolvedValue({ total: '1' });
        mockSelectExecute.mockResolvedValue([mockTicketRow]);
      });

      it('should filter by user_id for customer role', async () => {
        await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${customerToken}`);

        // The selectFrom chain should have where called with user_id
        const selectChain = mockedDb.selectFrom.mock.results[0]?.value;
        expect(selectChain.where).toHaveBeenCalled();
      });

      it('should not filter by user_id for admin role', async () => {
        const res = await request(app)
          .get('/api/tickets')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });
    });
  });

  // =================================================================
  // GET /api/tickets/:id
  // =================================================================
  describe('GET /api/tickets/:id', () => {
    describe('Happy path', () => {
      it('should return 200 with ticket for owner customer', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);

        const res = await request(app)
          .get(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(mockTicketRow.id);
        expect(res.body.display_id).toBe('TK-0001');
      });

      it('should return 200 with ticket for admin', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);

        const res = await request(app)
          .get(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(mockTicketRow.id);
      });

      it('should return ticket with all expected fields', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);

        const res = await request(app)
          .get(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.body).toEqual({
          id: mockTicketRow.id,
          display_id: 'TK-0001',
          user_id: mockUserRow.id,
          email: mockUserRow.email,
          name: mockUserRow.name,
          product_id: 1,
          product_name: 'Fjallraven Backpack',
          subject: 'Product arrived damaged',
          message: 'The zipper on my backpack was broken when it arrived.',
          status: 'open',
          priority: 'medium',
          created_at: '2026-01-15T10:00:00.000Z',
          updated_at: '2026-01-15T10:00:00.000Z',
        });
      });
    });

    describe('Authentication & authorization', () => {
      it('should return 401 when no token is provided', async () => {
        const res = await request(app).get(`/api/tickets/${mockTicketRow.id}`);

        expect(res.status).toBe(401);
      });

      it('should return 401 when token is invalid', async () => {
        const res = await request(app)
          .get(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
      });

      it('should return 403 when customer tries to access another customers ticket', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow2);

        const res = await request(app)
          .get(`/api/tickets/${mockTicketRow2.id}`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/forbidden/i);
      });

      it('should allow admin to access any ticket', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);

        const res = await request(app)
          .get(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });
    });

    describe('Path parameters', () => {
      it('should return 404 for non-existent ticket ID', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .get('/api/tickets/00000000-0000-0000-0000-000000000099')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/ticket not found/i);
      });

      it('should handle non-UUID string as ID', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .get('/api/tickets/not-a-uuid')
          .set('Authorization', `Bearer ${adminToken}`);

        // The DB will just not find it — returns 404 or 500 depending on driver
        expect([404, 500]).toContain(res.status);
      });
    });
  });

  // =================================================================
  // PUT /api/tickets/:id
  // =================================================================
  describe('PUT /api/tickets/:id', () => {
    const updatedTicketRow = {
      ...mockTicketRow,
      status: 'closed',
      updated_at: new Date('2026-01-16T10:00:00Z'),
    };

    describe('Happy path', () => {
      it('should return 200 with updated ticket when admin updates status', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);
        mockUpdateExecuteTakeFirstOrThrow.mockResolvedValue(updatedTicketRow);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'closed' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('closed');
      });

      it('should return 200 with updated ticket when admin updates priority', async () => {
        const priorityUpdated = {
          ...mockTicketRow,
          priority: 'high',
          updated_at: new Date('2026-01-16T10:00:00Z'),
        };
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);
        mockUpdateExecuteTakeFirstOrThrow.mockResolvedValue(priorityUpdated);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ priority: 'high' });

        expect(res.status).toBe(200);
        expect(res.body.priority).toBe('high');
      });

      it('should return 200 when admin updates both status and priority', async () => {
        const bothUpdated = {
          ...mockTicketRow,
          status: 'closed',
          priority: 'low',
          updated_at: new Date('2026-01-16T10:00:00Z'),
        };
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);
        mockUpdateExecuteTakeFirstOrThrow.mockResolvedValue(bothUpdated);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'closed', priority: 'low' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('closed');
        expect(res.body.priority).toBe('low');
      });
    });

    describe('Authentication & authorization', () => {
      it('should return 401 when no token is provided', async () => {
        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .send({ status: 'closed' });

        expect(res.status).toBe(401);
      });

      it('should return 401 when token is invalid', async () => {
        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', 'Bearer invalid-token')
          .send({ status: 'closed' });

        expect(res.status).toBe(401);
      });

      it('should return 403 when customer tries to update status', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ status: 'closed' });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/only admins/i);
      });

      it('should return 403 when customer tries to update priority', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ priority: 'high' });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/only admins/i);
      });

      it('should return 403 when customer tries to update another customers ticket', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow2);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow2.id}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ status: 'closed' });

        expect(res.status).toBe(403);
      });
    });

    describe('Validation', () => {
      it('should return 400 for invalid status value', async () => {
        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'pending' });

        expect(res.status).toBe(400);
      });

      it('should return 400 for invalid priority value', async () => {
        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ priority: 'critical' });

        expect(res.status).toBe(400);
      });

      it('should return 400 when status is a number', async () => {
        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 123 });

        expect(res.status).toBe(400);
      });

      it('should return 400 when priority is a boolean', async () => {
        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ priority: true });

        expect(res.status).toBe(400);
      });
    });

    describe('Business logic edge cases', () => {
      it('should return 400 when no fields to update (empty body)', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/no fields to update/i);
      });

      it('should return 404 when ticket does not exist', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .put('/api/tickets/00000000-0000-0000-0000-000000000099')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'closed' });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/ticket not found/i);
      });

      it('should accept status=open (reopen a closed ticket)', async () => {
        const closedTicket = { ...mockTicketRow, status: 'closed' };
        const reopenedTicket = {
          ...closedTicket,
          status: 'open',
          updated_at: new Date('2026-01-16T10:00:00Z'),
        };
        mockSelectExecuteTakeFirst.mockResolvedValue(closedTicket);
        mockUpdateExecuteTakeFirstOrThrow.mockResolvedValue(reopenedTicket);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'open' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('open');
      });
    });

    describe('Path parameters', () => {
      it('should return 404 for non-existent ticket ID', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .put('/api/tickets/00000000-0000-0000-0000-000000000099')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'closed' });

        expect(res.status).toBe(404);
      });
    });

    describe('Extra/unknown fields', () => {
      it('should ignore extra unknown fields', async () => {
        mockSelectExecuteTakeFirst.mockResolvedValue(mockTicketRow);
        mockUpdateExecuteTakeFirstOrThrow.mockResolvedValue(updatedTicketRow);

        const res = await request(app)
          .put(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'closed', unknown_field: 'hack' });

        expect(res.status).toBe(200);
      });
    });
  });

  // =================================================================
  // DELETE /api/tickets/:id
  // =================================================================
  describe('DELETE /api/tickets/:id', () => {
    describe('Happy path', () => {
      it('should return 204 when admin deletes a ticket', async () => {
        mockDeleteExecuteTakeFirst.mockResolvedValue({ id: mockTicketRow.id });

        const res = await request(app)
          .delete(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(204);
        expect(res.body).toEqual({});
      });

      it('should call deleteFrom on tickets table', async () => {
        mockDeleteExecuteTakeFirst.mockResolvedValue({ id: mockTicketRow.id });

        await request(app)
          .delete(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(mockedDb.deleteFrom).toHaveBeenCalledWith('tickets');
      });
    });

    describe('Authentication & authorization', () => {
      it('should return 401 when no token is provided', async () => {
        const res = await request(app).delete(
          `/api/tickets/${mockTicketRow.id}`,
        );

        expect(res.status).toBe(401);
      });

      it('should return 401 when token is invalid', async () => {
        const res = await request(app)
          .delete(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
      });

      it('should return 403 when customer tries to delete a ticket', async () => {
        const res = await request(app)
          .delete(`/api/tickets/${mockTicketRow.id}`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/admin access required/i);
      });
    });

    describe('Business logic edge cases', () => {
      it('should return 404 when ticket does not exist', async () => {
        mockDeleteExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .delete('/api/tickets/00000000-0000-0000-0000-000000000099')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/ticket not found/i);
      });
    });

    describe('Path parameters', () => {
      it('should handle non-UUID string as ID', async () => {
        mockDeleteExecuteTakeFirst.mockResolvedValue(undefined);

        const res = await request(app)
          .delete('/api/tickets/not-a-uuid')
          .set('Authorization', `Bearer ${adminToken}`);

        expect([404, 500]).toContain(res.status);
      });
    });
  });
});
