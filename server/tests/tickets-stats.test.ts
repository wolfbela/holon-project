process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '7d';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { formatResponseTime } from '../src/services/ticketService';

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

jest.mock('kysely', () => {
  const actual = jest.requireActual('kysely');
  return {
    ...actual,
    sql: jest.fn().mockReturnValue({
      execute: jest.fn().mockResolvedValue({ rows: [] }),
    }),
  };
});

import { sql } from 'kysely';

const mockedSql = sql as unknown as jest.Mock;

// --- Token helpers ---

function generateToken(payload: object, options?: jwt.SignOptions): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, options);
}

const adminToken = generateToken(
  {
    userId: '660e8400-e29b-41d4-a716-446655440000',
    email: 'admin@holon.com',
    role: 'admin',
  },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

const customerToken = generateToken(
  {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    email: 'customer@example.com',
    role: 'customer',
  },
  { expiresIn: '1h' as jwt.SignOptions['expiresIn'] },
);

const expiredToken = generateToken(
  {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    email: 'customer@example.com',
    role: 'customer',
  },
  { expiresIn: '0s' as jwt.SignOptions['expiresIn'] },
);

// --- Mock helpers ---

function setupStatsMock(
  countsRow: Record<string, string>,
  avgRow: { avg_seconds: string | null },
) {
  const mockExecute = jest
    .fn()
    .mockResolvedValueOnce({ rows: [countsRow] })
    .mockResolvedValueOnce({ rows: [avgRow] });
  mockedSql.mockReturnValue({ execute: mockExecute });
}

const defaultCounts = {
  total: '42',
  open: '28',
  closed: '14',
  low: '10',
  medium: '22',
  high: '10',
};

// ===================================================================
// Tests
// ===================================================================

describe('Ticket Stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =================================================================
  // Unit tests: formatResponseTime
  // =================================================================
  describe('formatResponseTime', () => {
    it('should return "0m" for null', () => {
      expect(formatResponseTime(null)).toBe('0m');
    });

    it('should return "0m" for 0 seconds', () => {
      expect(formatResponseTime(0)).toBe('0m');
    });

    it('should return "0m" for negative values', () => {
      expect(formatResponseTime(-500)).toBe('0m');
    });

    it('should return "0m" for less than 60 seconds', () => {
      expect(formatResponseTime(30)).toBe('0m');
    });

    it('should return minutes only for < 1 hour', () => {
      expect(formatResponseTime(2700)).toBe('45m');
    });

    it('should return "1m" for exactly 60 seconds', () => {
      expect(formatResponseTime(60)).toBe('1m');
    });

    it('should return hours and minutes for >= 1 hour', () => {
      expect(formatResponseTime(9000)).toBe('2h 30m');
    });

    it('should return hours and 0m for exact hours', () => {
      expect(formatResponseTime(7200)).toBe('2h 0m');
    });

    it('should return "1h 0m" for exactly 3600 seconds', () => {
      expect(formatResponseTime(3600)).toBe('1h 0m');
    });

    it('should return days and hours for >= 24 hours', () => {
      expect(formatResponseTime(90000)).toBe('1d 1h');
    });

    it('should return days and 0h for exact days', () => {
      expect(formatResponseTime(86400)).toBe('1d 0h');
    });

    it('should handle multi-day values', () => {
      expect(formatResponseTime(604800)).toBe('7d 0h');
    });

    it('should handle fractional seconds by flooring', () => {
      expect(formatResponseTime(5999.9)).toBe('1h 39m');
    });
  });

  // =================================================================
  // GET /api/tickets/stats
  // =================================================================
  describe('GET /api/tickets/stats', () => {
    // ---------------------------------------------------------------
    // A. Happy path
    // ---------------------------------------------------------------
    describe('Happy path', () => {
      it('should return 200 with correct stats shape', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '9000' });

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          total: 42,
          open: 28,
          closed: 14,
          byPriority: { low: 10, medium: 22, high: 10 },
          avgResponseTime: '2h 30m',
        });
      });

      it('should return avgResponseTime in days format for large values', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '100000' });

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.avgResponseTime).toBe('1d 3h');
      });

      it('should return avgResponseTime in minutes format for small values', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '2700' });

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.avgResponseTime).toBe('45m');
      });

      it('should call sql twice (counts + avg response time)', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '9000' });

        await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(mockedSql).toHaveBeenCalledTimes(2);
      });
    });

    // ---------------------------------------------------------------
    // B. Authentication & authorization
    // ---------------------------------------------------------------
    describe('Authentication & authorization', () => {
      it('should return 401 when no token is provided', async () => {
        const res = await request(app).get('/api/tickets/stats');

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/no token/i);
      });

      it('should return 401 when Authorization header has no Bearer prefix', async () => {
        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', adminToken);

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/no token/i);
      });

      it('should return 401 when token is expired', async () => {
        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/invalid|expired/i);
      });

      it('should return 401 when token is malformed', async () => {
        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', 'Bearer not-a-valid-jwt-token');

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/invalid|expired/i);
      });

      it('should return 401 when token is signed with wrong secret', async () => {
        const wrongSecretToken = jwt.sign(
          {
            userId: '660e8400-e29b-41d4-a716-446655440000',
            email: 'admin@holon.com',
            role: 'admin',
          },
          'wrong-secret',
          { expiresIn: '1h' },
        );

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${wrongSecretToken}`);

        expect(res.status).toBe(401);
      });

      it('should return 403 when customer tries to access stats', async () => {
        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/admin/i);
      });
    });

    // ---------------------------------------------------------------
    // I. Business logic edge cases
    // ---------------------------------------------------------------
    describe('Business logic edge cases', () => {
      it('should return all zeros when no tickets exist', async () => {
        setupStatsMock(
          {
            total: '0',
            open: '0',
            closed: '0',
            low: '0',
            medium: '0',
            high: '0',
          },
          { avg_seconds: null },
        );

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          total: 0,
          open: 0,
          closed: 0,
          byPriority: { low: 0, medium: 0, high: 0 },
          avgResponseTime: '0m',
        });
      });

      it('should return "0m" avgResponseTime when tickets exist but no agent replies', async () => {
        setupStatsMock(
          {
            total: '5',
            open: '3',
            closed: '2',
            low: '1',
            medium: '3',
            high: '1',
          },
          { avg_seconds: null },
        );

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(5);
        expect(res.body.avgResponseTime).toBe('0m');
      });

      it('should handle empty rows from counts query gracefully', async () => {
        const mockExecute = jest
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });
        mockedSql.mockReturnValue({ execute: mockExecute });

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          total: 0,
          open: 0,
          closed: 0,
          byPriority: { low: 0, medium: 0, high: 0 },
          avgResponseTime: '0m',
        });
      });

      it('should handle very large ticket counts', async () => {
        setupStatsMock(
          {
            total: '1000000',
            open: '600000',
            closed: '400000',
            low: '200000',
            medium: '500000',
            high: '300000',
          },
          { avg_seconds: '172800' },
        );

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1000000);
        expect(res.body.open).toBe(600000);
        expect(res.body.avgResponseTime).toBe('2d 0h');
      });

      it('should handle fractional avg_seconds from database', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '5432.789' });

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.avgResponseTime).toBe('1h 30m');
      });

      it('should handle avg_seconds of "0" from database', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '0' });

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.avgResponseTime).toBe('0m');
      });

      it('should return 500 when database query fails', async () => {
        const mockExecute = jest
          .fn()
          .mockRejectedValue(new Error('Connection refused'));
        mockedSql.mockReturnValue({ execute: mockExecute });

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(500);
      });

      it('should handle only open tickets (no closed)', async () => {
        setupStatsMock(
          {
            total: '3',
            open: '3',
            closed: '0',
            low: '1',
            medium: '1',
            high: '1',
          },
          { avg_seconds: '600' },
        );

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.open).toBe(3);
        expect(res.body.closed).toBe(0);
        expect(res.body.avgResponseTime).toBe('10m');
      });

      it('should handle single ticket with single agent reply', async () => {
        setupStatsMock(
          {
            total: '1',
            open: '1',
            closed: '0',
            low: '0',
            medium: '1',
            high: '0',
          },
          { avg_seconds: '120' },
        );

        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.avgResponseTime).toBe('2m');
      });
    });

    // ---------------------------------------------------------------
    // F. Extra/unknown query parameters
    // ---------------------------------------------------------------
    describe('Query parameters', () => {
      it('should ignore unknown query parameters', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '9000' });

        const res = await request(app)
          .get('/api/tickets/stats?foo=bar&baz=123')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('byPriority');
      });
    });

    // ---------------------------------------------------------------
    // J. SQL injection / XSS payloads
    // ---------------------------------------------------------------
    describe('SQL injection / XSS', () => {
      it('should not be vulnerable via Authorization header', async () => {
        const res = await request(app)
          .get('/api/tickets/stats')
          .set('Authorization', "Bearer ' OR 1=1 --");

        expect(res.status).toBe(401);
      });

      it('should not be vulnerable via query parameters', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '9000' });

        const res = await request(app)
          .get("/api/tickets/stats?inject=' OR 1=1 --")
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
      });

      it('should not be vulnerable to XSS via query parameters', async () => {
        setupStatsMock(defaultCounts, { avg_seconds: '9000' });

        const res = await request(app)
          .get('/api/tickets/stats?xss=<script>alert(1)</script>')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toContain('<script>');
      });
    });
  });
});
