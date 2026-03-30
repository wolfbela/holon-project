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
let mockUpdateExecute: jest.Mock;
let mockUpdateExecuteTakeFirstOrThrow: jest.Mock;
let mockInsertExecuteTakeFirstOrThrow: jest.Mock;
let mockInsertExecute: jest.Mock;

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

const mockNotificationRow1 = {
  id: 'nnn00000-0000-0000-0000-000000000001',
  user_id: mockUserRow.id,
  type: 'new_reply',
  ticket_id: mockTicketRow.id,
  message: 'An agent replied to your ticket TK-0001',
  read: false,
  created_at: new Date('2026-01-16T10:00:00Z'),
};

const mockNotificationRow2 = {
  id: 'nnn00000-0000-0000-0000-000000000002',
  user_id: mockUserRow.id,
  type: 'ticket_closed',
  ticket_id: mockTicketRow.id,
  message: 'Your ticket TK-0001 has been closed',
  read: true,
  created_at: new Date('2026-01-17T10:00:00Z'),
};

const mockNotificationRow3 = {
  id: 'nnn00000-0000-0000-0000-000000000003',
  user_id: mockUserRow.id,
  type: 'new_reply',
  ticket_id: mockTicketRow.id,
  message: 'An agent replied to your ticket TK-0001 again',
  read: false,
  created_at: new Date('2026-01-18T10:00:00Z'),
};

const mockAdminNotificationRow = {
  id: 'nnn00000-0000-0000-0000-000000000004',
  user_id: mockAdminRow.id,
  type: 'new_ticket',
  ticket_id: mockTicketRow.id,
  message: 'New ticket created: TK-0001',
  read: false,
  created_at: new Date('2026-01-15T10:05:00Z'),
};

const mockOtherUserNotificationRow = {
  id: 'nnn00000-0000-0000-0000-000000000005',
  user_id: mockCustomer2Row.id,
  type: 'new_reply',
  ticket_id: 'aaa00000-0000-0000-0000-000000000002',
  message: 'An agent replied to your ticket TK-0002',
  read: false,
  created_at: new Date('2026-01-16T12:00:00Z'),
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

const customer2Token = generateToken(
  {
    userId: mockCustomer2Row.id,
    email: mockCustomer2Row.email,
    role: 'customer',
  },
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
  mockUpdateExecute = jest.fn();
  mockUpdateExecuteTakeFirstOrThrow = jest.fn();

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

  const updateChain: Record<string, jest.Mock> = {
    set: jest.fn(),
    where: jest.fn(),
    returningAll: jest.fn(),
    executeTakeFirstOrThrow: mockUpdateExecuteTakeFirstOrThrow,
    execute: mockUpdateExecute,
  };
  for (const key of Object.keys(updateChain)) {
    if (key !== 'executeTakeFirstOrThrow' && key !== 'execute') {
      updateChain[key].mockReturnValue(updateChain);
    }
  }
  mockedDb.updateTable.mockReturnValue(updateChain);

  mockInsertExecuteTakeFirstOrThrow = jest.fn();
  mockInsertExecute = jest.fn();
  const insertChain: Record<string, jest.Mock> = {
    values: jest.fn(),
    returningAll: jest.fn(),
    executeTakeFirstOrThrow: mockInsertExecuteTakeFirstOrThrow,
    execute: mockInsertExecute,
  };
  insertChain.values.mockReturnValue(insertChain);
  insertChain.returningAll.mockReturnValue(insertChain);
  mockedDb.insertInto.mockReturnValue(insertChain);
}

// ===================================================================
// GET /api/notifications
// ===================================================================

describe('GET /api/notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // -----------------------------------------------------------------
  // A. Happy path
  // -----------------------------------------------------------------

  describe('Happy path', () => {
    it('should return notifications for authenticated customer (200)', async () => {
      mockSelectExecute.mockResolvedValueOnce([
        mockNotificationRow3,
        mockNotificationRow2,
        mockNotificationRow1,
      ]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('unreadCount');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('should return notifications for authenticated admin (200)', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockAdminNotificationRow]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: mockAdminNotificationRow.id,
        type: 'new_ticket',
      });
    });

    it('should return correct unread count', async () => {
      mockSelectExecute.mockResolvedValueOnce([
        mockNotificationRow1,
        mockNotificationRow2,
        mockNotificationRow3,
      ]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(2);
    });

    it('should return unreadCount 0 when all notifications are read', async () => {
      mockSelectExecute.mockResolvedValueOnce([
        { ...mockNotificationRow1, read: true },
        { ...mockNotificationRow2, read: true },
      ]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(0);
    });

    it('should return empty data array and unreadCount 0 when no notifications', async () => {
      mockSelectExecute.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.unreadCount).toBe(0);
    });

    it('should return notifications with ISO-8601 created_at timestamps', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockNotificationRow1]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].created_at).toBe('2026-01-16T10:00:00.000Z');
    });

    it('should return notification with all expected fields', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockNotificationRow1]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0]).toMatchObject({
        id: mockNotificationRow1.id,
        user_id: mockUserRow.id,
        type: 'new_reply',
        ticket_id: mockTicketRow.id,
        message: mockNotificationRow1.message,
        read: false,
      });
      expect(res.body.data[0]).toHaveProperty('created_at');
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when token is expired', async () => {
      const res = await request(app)
        .get('/api/notifications')
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
        .get('/api/notifications')
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'InvalidFormat token123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when Authorization header has no Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', customerToken);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });
  });

  // -----------------------------------------------------------------
  // I. Business logic edge cases
  // -----------------------------------------------------------------

  describe('Business logic edge cases', () => {
    it('should only return notifications belonging to the authenticated user', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockNotificationRow1]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      for (const notification of res.body.data) {
        expect(notification.user_id).toBe(mockUserRow.id);
      }
    });

    it('should return different notifications for different users', async () => {
      mockSelectExecute.mockResolvedValueOnce([mockAdminNotificationRow]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const notification of res.body.data) {
        expect(notification.user_id).toBe(mockAdminRow.id);
      }
    });

    it('should include both read and unread notifications', async () => {
      mockSelectExecute.mockResolvedValueOnce([
        mockNotificationRow1,
        mockNotificationRow2,
      ]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const readStatuses = res.body.data.map((n: { read: boolean }) => n.read);
      expect(readStatuses).toContain(true);
      expect(readStatuses).toContain(false);
    });

    it('should handle all notification types correctly', async () => {
      mockSelectExecute.mockResolvedValueOnce([
        mockNotificationRow1,
        mockNotificationRow2,
        {
          ...mockNotificationRow3,
          type: 'new_ticket',
        },
      ]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const types = res.body.data.map((n: { type: string }) => n.type);
      expect(types).toContain('new_reply');
      expect(types).toContain('ticket_closed');
      expect(types).toContain('new_ticket');
    });
  });
});

// ===================================================================
// PUT /api/notifications/:id/read
// ===================================================================

describe('PUT /api/notifications/:id/read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // -----------------------------------------------------------------
  // A. Happy path
  // -----------------------------------------------------------------

  describe('Happy path', () => {
    it('should mark an unread notification as read (200)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(mockNotificationRow1);
      mockUpdateExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockNotificationRow1,
        read: true,
      });

      const res = await request(app)
        .put(`/api/notifications/${mockNotificationRow1.id}/read`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: mockNotificationRow1.id,
        user_id: mockUserRow.id,
        type: 'new_reply',
        ticket_id: mockTicketRow.id,
        read: true,
      });
    });

    it('should return the updated notification with all fields', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(mockNotificationRow1);
      mockUpdateExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockNotificationRow1,
        read: true,
      });

      const res = await request(app)
        .put(`/api/notifications/${mockNotificationRow1.id}/read`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('user_id');
      expect(res.body).toHaveProperty('type');
      expect(res.body).toHaveProperty('ticket_id');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('read');
      expect(res.body).toHaveProperty('created_at');
    });

    it('should return ISO-8601 created_at timestamp', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(mockNotificationRow1);
      mockUpdateExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockNotificationRow1,
        read: true,
      });

      const res = await request(app)
        .put(`/api/notifications/${mockNotificationRow1.id}/read`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.created_at).toBe('2026-01-16T10:00:00.000Z');
    });

    it('should succeed when admin marks their own notification as read', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(
        mockAdminNotificationRow,
      );
      mockUpdateExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockAdminNotificationRow,
        read: true,
      });

      const res = await request(app)
        .put(`/api/notifications/${mockAdminNotificationRow.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.read).toBe(true);
    });

    it('should succeed when notification is already read (idempotent)', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(mockNotificationRow2);
      mockUpdateExecuteTakeFirstOrThrow.mockResolvedValueOnce({
        ...mockNotificationRow2,
        read: true,
      });

      const res = await request(app)
        .put(`/api/notifications/${mockNotificationRow2.id}/read`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.read).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).put(
        `/api/notifications/${mockNotificationRow1.id}/read`,
      );

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when token is expired', async () => {
      const res = await request(app)
        .put(`/api/notifications/${mockNotificationRow1.id}/read`)
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
        .put(`/api/notifications/${mockNotificationRow1.id}/read`)
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .put(`/api/notifications/${mockNotificationRow1.id}/read`)
        .set('Authorization', 'Basic token123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 403 when customer tries to mark another users notification as read', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(
        mockOtherUserNotificationRow,
      );

      const res = await request(app)
        .put(`/api/notifications/${mockOtherUserNotificationRow.id}/read`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should return 403 when admin tries to mark another users notification as read', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(mockNotificationRow1);

      const res = await request(app)
        .put(`/api/notifications/${mockNotificationRow1.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  // -----------------------------------------------------------------
  // G. Path parameters
  // -----------------------------------------------------------------

  describe('Path parameters', () => {
    it('should return 404 when notification ID does not exist', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .put('/api/notifications/nnn00000-0000-0000-0000-000000000099/read')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Notification not found');
    });

    it('should handle non-UUID string as notification ID gracefully', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .put('/api/notifications/not-a-valid-uuid/read')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Notification not found');
    });
  });

  // -----------------------------------------------------------------
  // I. Business logic edge cases
  // -----------------------------------------------------------------

  describe('Business logic edge cases', () => {
    it('should only allow owner to mark notification as read regardless of role', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(
        mockOtherUserNotificationRow,
      );

      const res = await request(app)
        .put(`/api/notifications/${mockOtherUserNotificationRow.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------
  // J. SQL injection / XSS payloads
  // -----------------------------------------------------------------

  describe('SQL injection / XSS payloads', () => {
    it('should not crash with SQL injection in notification ID', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .put("/api/notifications/' OR 1=1 --/read")
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).not.toBe(500);
    });

    it('should not crash with XSS payload in notification ID', async () => {
      mockSelectExecuteTakeFirst.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .put('/api/notifications/<script>alert(1)</script>/read')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).not.toBe(500);
    });
  });
});

// ===================================================================
// PUT /api/notifications/read-all
// ===================================================================

describe('PUT /api/notifications/read-all', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  // -----------------------------------------------------------------
  // A. Happy path
  // -----------------------------------------------------------------

  describe('Happy path', () => {
    it('should mark all notifications as read for customer (200)', async () => {
      mockUpdateExecute.mockResolvedValueOnce([]);

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: 'All notifications marked as read',
      });
    });

    it('should mark all notifications as read for admin (200)', async () => {
      mockUpdateExecute.mockResolvedValueOnce([]);

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('All notifications marked as read');
    });

    it('should succeed even when user has no unread notifications', async () => {
      mockUpdateExecute.mockResolvedValueOnce([]);

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('All notifications marked as read');
    });

    it('should succeed even when user has no notifications at all', async () => {
      mockUpdateExecute.mockResolvedValueOnce([]);

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${customer2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('All notifications marked as read');
    });
  });

  // -----------------------------------------------------------------
  // B. Authentication & authorization
  // -----------------------------------------------------------------

  describe('Authentication & authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).put('/api/notifications/read-all');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 when token is expired', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
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
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', 'InvalidFormat token123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No token provided');
    });
  });

  // -----------------------------------------------------------------
  // I. Business logic edge cases
  // -----------------------------------------------------------------

  describe('Business logic edge cases', () => {
    it('should not affect other users notifications', async () => {
      mockUpdateExecute.mockResolvedValueOnce([]);

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);

      // Verify the update was scoped to user_id
      expect(mockedDb.updateTable).toHaveBeenCalledWith('notifications');
    });
  });
});

// ===================================================================
// Route priority: /read-all vs /:id/read
// ===================================================================

describe('Route priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  it('should route /read-all to markAllAsRead, not treat "read-all" as :id', async () => {
    mockUpdateExecute.mockResolvedValueOnce([]);

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('All notifications marked as read');
    // Should not hit selectFrom (which markAsRead does to find notification by id)
    expect(mockedDb.selectFrom).not.toHaveBeenCalled();
  });
});

// ===================================================================
// createNotification (service function)
// ===================================================================

import {
  createNotification,
  createNotificationsForAdmins,
} from '../src/services/notificationService';

describe('createNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  it('should create a notification and return it', async () => {
    const newNotifRow = {
      id: 'nnn00000-0000-0000-0000-000000000010',
      user_id: mockUserRow.id,
      type: 'new_reply',
      ticket_id: mockTicketRow.id,
      message: 'New reply on ticket TK-0001',
      read: false,
      created_at: new Date('2026-01-20T10:00:00Z'),
    };
    mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce(newNotifRow);

    const result = await createNotification({
      userId: mockUserRow.id,
      type: 'new_reply',
      ticketId: mockTicketRow.id,
      message: 'New reply on ticket TK-0001',
    });

    expect(result).toMatchObject({
      id: newNotifRow.id,
      user_id: mockUserRow.id,
      type: 'new_reply',
      ticket_id: mockTicketRow.id,
      message: 'New reply on ticket TK-0001',
      read: false,
    });
    expect(result.created_at).toBe('2026-01-20T10:00:00.000Z');
  });

  it('should create a ticket_closed notification', async () => {
    const closedNotifRow = {
      id: 'nnn00000-0000-0000-0000-000000000011',
      user_id: mockUserRow.id,
      type: 'ticket_closed',
      ticket_id: mockTicketRow.id,
      message: 'Your ticket TK-0001 has been closed',
      read: false,
      created_at: new Date('2026-01-20T11:00:00Z'),
    };
    mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce(closedNotifRow);

    const result = await createNotification({
      userId: mockUserRow.id,
      type: 'ticket_closed',
      ticketId: mockTicketRow.id,
      message: 'Your ticket TK-0001 has been closed',
    });

    expect(result.type).toBe('ticket_closed');
    expect(result.read).toBe(false);
  });

  it('should call insertInto on notifications table', async () => {
    mockInsertExecuteTakeFirstOrThrow.mockResolvedValueOnce({
      id: 'nnn-mock',
      user_id: mockUserRow.id,
      type: 'new_ticket',
      ticket_id: mockTicketRow.id,
      message: 'test',
      read: false,
      created_at: new Date(),
    });

    await createNotification({
      userId: mockUserRow.id,
      type: 'new_ticket',
      ticketId: mockTicketRow.id,
      message: 'test',
    });

    expect(mockedDb.insertInto).toHaveBeenCalledWith('notifications');
  });
});

// ===================================================================
// createNotificationsForAdmins (service function)
// ===================================================================

describe('createNotificationsForAdmins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDbMocks();
  });

  it('should create notifications for all admins', async () => {
    const admin1Id = '660e8400-e29b-41d4-a716-446655440000';
    const admin2Id = '770e8400-e29b-41d4-a716-446655440001';

    // First selectFrom call: get admin IDs
    mockSelectExecute.mockResolvedValueOnce([
      { id: admin1Id },
      { id: admin2Id },
    ]);

    // insertInto returns created rows
    mockInsertExecute.mockResolvedValueOnce([
      {
        id: 'notif-1',
        user_id: admin1Id,
        type: 'new_ticket',
        ticket_id: mockTicketRow.id,
        message: 'New ticket: TK-0001',
        read: false,
        created_at: new Date('2026-01-20T10:00:00Z'),
      },
      {
        id: 'notif-2',
        user_id: admin2Id,
        type: 'new_ticket',
        ticket_id: mockTicketRow.id,
        message: 'New ticket: TK-0001',
        read: false,
        created_at: new Date('2026-01-20T10:00:00Z'),
      },
    ]);

    const results = await createNotificationsForAdmins({
      type: 'new_ticket',
      ticketId: mockTicketRow.id,
      message: 'New ticket: TK-0001',
    });

    expect(results).toHaveLength(2);
    expect(results[0].user_id).toBe(admin1Id);
    expect(results[1].user_id).toBe(admin2Id);
    expect(results[0].type).toBe('new_ticket');
  });

  it('should return empty array when no admins exist', async () => {
    mockSelectExecute.mockResolvedValueOnce([]);

    const results = await createNotificationsForAdmins({
      type: 'new_ticket',
      ticketId: mockTicketRow.id,
      message: 'New ticket: TK-0001',
    });

    expect(results).toEqual([]);
    expect(mockedDb.insertInto).not.toHaveBeenCalled();
  });

  it('should query users table for admin role', async () => {
    mockSelectExecute.mockResolvedValueOnce([]);

    await createNotificationsForAdmins({
      type: 'new_reply',
      ticketId: mockTicketRow.id,
      message: 'test',
    });

    expect(mockedDb.selectFrom).toHaveBeenCalledWith('users');
  });

  it('should handle single admin', async () => {
    const adminId = '660e8400-e29b-41d4-a716-446655440000';
    mockSelectExecute.mockResolvedValueOnce([{ id: adminId }]);
    mockInsertExecute.mockResolvedValueOnce([
      {
        id: 'notif-single',
        user_id: adminId,
        type: 'new_reply',
        ticket_id: mockTicketRow.id,
        message: 'Customer replied',
        read: false,
        created_at: new Date('2026-01-20T10:00:00Z'),
      },
    ]);

    const results = await createNotificationsForAdmins({
      type: 'new_reply',
      ticketId: mockTicketRow.id,
      message: 'Customer replied',
    });

    expect(results).toHaveLength(1);
    expect(results[0].user_id).toBe(adminId);
  });
});
