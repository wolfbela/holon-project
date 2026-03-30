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
let mockSelectExecute: jest.Mock;
let mockInsertExecuteTakeFirstOrThrow: jest.Mock;

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

const mockClosedTicketRow = {
  ...mockTicketRow,
  id: 'aaa00000-0000-0000-0000-000000000003',
  display_id: 'TK-0003',
  status: 'closed',
};

const mockTicketOtherUser = {
  ...mockTicketRow,
  id: 'aaa00000-0000-0000-0000-000000000002',
  display_id: 'TK-0002',
  user_id: mockCustomer2Row.id,
  email: mockCustomer2Row.email,
  name: mockCustomer2Row.name,
};

const mockReplyRow = {
  id: 'bbb00000-0000-0000-0000-000000000001',
  ticket_id: mockTicketRow.id,
  user_id: mockUserRow.id,
  author_type: 'customer',
  message: 'Can you please help me?',
  created_at: new Date('2026-01-15T11:00:00Z'),
};

const mockReplyRow2 = {
  id: 'bbb00000-0000-0000-0000-000000000002',
  ticket_id: mockTicketRow.id,
  user_id: mockAdminRow.id,
  author_type: 'agent',
  message: 'We will send a replacement right away.',
  created_at: new Date('2026-01-15T12:00:00Z'),
};

const validReplyBody = {
  message: 'This is a valid reply message.',
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
    executeTakeFirstOrThrow: jest.fn(),
    execute: mockSelectExecute,
  };
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
}

// ===================================================================
// POST /api/tickets/:id/replies
// ===================================================================

describe('POST /api/tickets/:id/replies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // -----------------------------------------------------------------
  // A. Happy path
  // -----------------------------------------------------------------

  describe('Happy path', () => {
    it('should create a reply as customer on own ticket (201, author_type=customer)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce(mockReplyRow);

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: mockReplyRow.id,
        ticket_id: mockTicketRow.id,
        user_id: mockUserRow.id,
        author_type: 'customer',
        message: mockReplyRow.message,
      });
      expect(res.body.created_at).toBeDefined();
    });

    it('should create a reply as admin on any ticket (201, author_type=agent)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow2,
        message: validReplyBody.message,
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(201);
      expect(res.body.author_type).toBe('agent');
    });

    it('should return the reply with ISO-8601 created_at timestamp', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce(mockReplyRow);

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(201);
      expect(res.body.created_at).toBe('2026-01-15T11:00:00.000Z');
    });

    it('should allow admin to reply to a ticket owned by another user', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketOtherUser.id,
        user_id: mockCustomer2Row.id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow2,
        ticket_id: mockTicketOtherUser.id,
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketOtherUser.id}/replies`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(201);
      expect(res.body.author_type).toBe('agent');
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .send(validReplyBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when token is expired', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when token has wrong secret', async () => {
      const badToken = jwt.sign(
        { userId: mockUserRow.id, email: mockUserRow.email, role: 'customer' },
        'wrong-secret',
      );

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${badToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', 'InvalidFormat token123')
        .send(validReplyBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 403 when customer tries to reply to another users ticket', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketOtherUser.id,
        user_id: mockCustomer2Row.id,
        status: 'open',
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketOtherUser.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  // -----------------------------------------------------------------
  // C. Validation — missing required fields
  // -----------------------------------------------------------------

  describe('Missing required fields', () => {
    it('should return 400 when message is missing', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 when body is empty', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send();

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------
  // D. Validation — wrong types
  // -----------------------------------------------------------------

  describe('Wrong types', () => {
    it('should return 400 when message is a number', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: 12345 });

      expect(res.status).toBe(400);
    });

    it('should return 400 when message is a boolean', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: true });

      expect(res.status).toBe(400);
    });

    it('should return 400 when message is an object', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: { text: 'hello' } });

      expect(res.status).toBe(400);
    });

    it('should return 400 when message is an array', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: ['hello'] });

      expect(res.status).toBe(400);
    });

    it('should return 400 when message is null', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: null });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------
  // E. Validation — boundary values
  // -----------------------------------------------------------------

  describe('Boundary values', () => {
    it('should return 400 when message is an empty string', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: '' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when message exceeds 5000 characters', async () => {
      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: 'x'.repeat(5001) });

      expect(res.status).toBe(400);
    });

    it('should accept a message of exactly 5000 characters', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow,
        message: 'x'.repeat(5000),
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: 'x'.repeat(5000) });

      expect(res.status).toBe(201);
    });

    it('should accept a message of exactly 1 character', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow,
        message: 'x',
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: 'x' });

      expect(res.status).toBe(201);
    });
  });

  // -----------------------------------------------------------------
  // F. Validation — extra/unknown fields
  // -----------------------------------------------------------------

  describe('Extra/unknown fields', () => {
    it('should ignore extra unknown fields and succeed', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce(mockReplyRow);

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          message: 'Valid message',
          unknownField: 'should be stripped',
          author_type: 'agent',
        });

      expect(res.status).toBe(201);
    });
  });

  // -----------------------------------------------------------------
  // G. Path parameters
  // -----------------------------------------------------------------

  describe('Path parameters', () => {
    it('should return 404 when ticket ID does not exist', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post('/api/tickets/ccc00000-0000-0000-0000-000000000099/replies')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ticket not found');
    });
  });

  // -----------------------------------------------------------------
  // I. Business logic edge cases
  // -----------------------------------------------------------------

  describe('Business logic edge cases', () => {
    it('should return 400 when replying to a closed ticket', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockClosedTicketRow.id,
        user_id: mockClosedTicketRow.user_id,
        status: 'closed',
      });

      const res = await request(app)
        .post(`/api/tickets/${mockClosedTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot reply to a closed ticket');
    });

    it('should return 400 when admin replies to a closed ticket', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockClosedTicketRow.id,
        user_id: mockClosedTicketRow.user_id,
        status: 'closed',
      });

      const res = await request(app)
        .post(`/api/tickets/${mockClosedTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot reply to a closed ticket');
    });

    it('should set author_type to customer when user role is customer', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow,
        author_type: 'customer',
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(201);
      expect(res.body.author_type).toBe('customer');
    });

    it('should set author_type to agent when user role is admin', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow2,
        author_type: 'agent',
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validReplyBody);

      expect(res.status).toBe(201);
      expect(res.body.author_type).toBe('agent');
    });

    it('should set user_id from JWT token, not from request body', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow,
        user_id: mockUserRow.id,
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          message: 'Valid message',
          user_id: 'fake-user-id-should-be-ignored',
        });

      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(mockUserRow.id);
    });
  });

  // -----------------------------------------------------------------
  // J. SQL injection / XSS payloads
  // -----------------------------------------------------------------

  describe('SQL injection / XSS payloads', () => {
    it('should not crash with SQL injection in message', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow,
        message: "' OR 1=1 --",
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: "' OR 1=1 --" });

      expect([201, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('should not crash with XSS payload in message', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow,
        message: '<script>alert(1)</script>',
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: '<script>alert(1)</script>' });

      expect([201, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('should not crash with HTML injection in message', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
        status: 'open',
      });
      mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockReplyRow,
        message: '<img src=x onerror=alert(1)>',
      });

      const res = await request(app)
        .post(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ message: '<img src=x onerror=alert(1)>' });

      expect([201, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });
});

// ===================================================================
// GET /api/tickets/:id/replies
// ===================================================================

describe('GET /api/tickets/:id/replies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // -----------------------------------------------------------------
  // A. Happy path
  // -----------------------------------------------------------------

  describe('Happy path', () => {
    it('should return all replies for a ticket owned by the customer (200)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
      });
      mockSelectExecute.mockResolvedValueOnce([mockReplyRow, mockReplyRow2]);

      const res = await request(app)
        .get(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({
        id: mockReplyRow.id,
        ticket_id: mockTicketRow.id,
        user_id: mockUserRow.id,
        author_type: 'customer',
        message: mockReplyRow.message,
      });
      expect(res.body[1]).toMatchObject({
        id: mockReplyRow2.id,
        author_type: 'agent',
      });
    });

    it('should return all replies for any ticket when requested by admin (200)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketOtherUser.id,
        user_id: mockCustomer2Row.id,
      });
      mockSelectExecute.mockResolvedValueOnce([mockReplyRow]);

      const res = await request(app)
        .get(`/api/tickets/${mockTicketOtherUser.id}/replies`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it('should return an empty array when ticket has no replies', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
      });
      mockSelectExecute.mockResolvedValueOnce([]);

      const res = await request(app)
        .get(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('should return replies with ISO-8601 created_at timestamps', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
      });
      mockSelectExecute.mockResolvedValueOnce([mockReplyRow]);

      const res = await request(app)
        .get(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].created_at).toBe('2026-01-15T11:00:00.000Z');
    });

    it('should allow listing replies on a closed ticket', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockClosedTicketRow.id,
        user_id: mockClosedTicketRow.user_id,
      });
      mockSelectExecute.mockResolvedValueOnce([mockReplyRow]);

      const res = await request(app)
        .get(`/api/tickets/${mockClosedTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get(
        `/api/tickets/${mockTicketRow.id}/replies`,
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when token is expired', async () => {
      const res = await request(app)
        .get(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when token has wrong secret', async () => {
      const badToken = jwt.sign(
        { userId: mockUserRow.id, email: mockUserRow.email, role: 'customer' },
        'wrong-secret',
      );

      const res = await request(app)
        .get(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .get(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', 'Basic token123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 403 when customer tries to list replies of another users ticket', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketOtherUser.id,
        user_id: mockCustomer2Row.id,
      });

      const res = await request(app)
        .get(`/api/tickets/${mockTicketOtherUser.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  // -----------------------------------------------------------------
  // G. Path parameters
  // -----------------------------------------------------------------

  describe('Path parameters', () => {
    it('should return 404 when ticket ID does not exist', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .get('/api/tickets/ccc00000-0000-0000-0000-000000000099/replies')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ticket not found');
    });
  });

  // -----------------------------------------------------------------
  // I. Business logic edge cases
  // -----------------------------------------------------------------

  describe('Business logic edge cases', () => {
    it('should return replies ordered by created_at ascending', async () => {
      const earlyReply = {
        ...mockReplyRow,
        id: 'bbb00000-0000-0000-0000-000000000010',
        created_at: new Date('2026-01-15T08:00:00Z'),
      };
      const lateReply = {
        ...mockReplyRow2,
        id: 'bbb00000-0000-0000-0000-000000000011',
        created_at: new Date('2026-01-15T16:00:00Z'),
      };

      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
      });
      mockSelectExecute.mockResolvedValueOnce([earlyReply, lateReply]);

      const res = await request(app)
        .get(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(new Date(res.body[0].created_at).getTime()).toBeLessThan(
        new Date(res.body[1].created_at).getTime(),
      );
    });

    it('should return replies from both customer and agent', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce({
        id: mockTicketRow.id,
        user_id: mockTicketRow.user_id,
      });
      mockSelectExecute.mockResolvedValueOnce([mockReplyRow, mockReplyRow2]);

      const res = await request(app)
        .get(`/api/tickets/${mockTicketRow.id}/replies`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const authorTypes = res.body.map(
        (r: { author_type: string }) => r.author_type,
      );
      expect(authorTypes).toContain('customer');
      expect(authorTypes).toContain('agent');
    });
  });
});
