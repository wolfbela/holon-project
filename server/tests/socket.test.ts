process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '7d';

import http from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { createSocketServer, getIO } from '../src/socket';
import app from '../src/app';
import { db } from '../src/db';

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

const mockedDb = db as unknown as {
  selectFrom: jest.Mock;
};

// --- Test data ---

const mockCustomerPayload = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'customer@example.com',
  role: 'customer' as const,
};

const mockAdminPayload = {
  userId: '660e8400-e29b-41d4-a716-446655440000',
  email: 'admin@holon.com',
  role: 'admin' as const,
};

const mockTicketId = 'aaa00000-0000-0000-0000-000000000001';

function generateToken(payload: object, options?: jwt.SignOptions): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, options);
}

const customerToken = generateToken(mockCustomerPayload, { expiresIn: '1h' });
const adminToken = generateToken(mockAdminPayload, { expiresIn: '1h' });

// --- DB mock helpers ---

function setupDbMocks() {
  const selectChain: Record<string, jest.Mock> = {
    select: jest.fn(),
    selectAll: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    executeTakeFirst: jest.fn(),
    execute: jest.fn(),
  };
  for (const key of Object.keys(selectChain)) {
    if (key !== 'executeTakeFirst' && key !== 'execute') {
      selectChain[key].mockReturnValue(selectChain);
    }
  }
  mockedDb.selectFrom.mockReturnValue(selectChain);
  return selectChain;
}

// --- Test suite ---

describe('Socket.io with Authentication', () => {
  let httpServer: http.Server;
  let ioServer: ReturnType<typeof createSocketServer>;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll((done) => {
    httpServer = http.createServer(app);
    ioServer = createSocketServer(httpServer);
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      done();
    });
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    jest.clearAllMocks();
  });

  afterAll((done) => {
    ioServer.close();
    httpServer.close(done);
  });

  // =================================================================
  // Server initialization
  // =================================================================

  describe('Server initialization', () => {
    it('should create a Socket.io server instance', () => {
      expect(ioServer).toBeInstanceOf(Server);
    });

    it('should return the same instance via getIO()', () => {
      const io = getIO();
      expect(io).toBe(ioServer);
    });
  });

  // =================================================================
  // Authentication
  // =================================================================

  describe('Authentication', () => {
    it('should accept connection with valid customer JWT', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    it('should accept connection with valid admin JWT', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    it('should reject connection without token', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: 'invalid-token-string' },
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        done();
      });
    });

    it('should reject connection with expired token', (done) => {
      const expiredToken = generateToken(mockCustomerPayload, {
        expiresIn: '0s',
      });

      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: expiredToken },
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        done();
      });
    });

    it('should reject connection with token signed by wrong secret', (done) => {
      const badToken = jwt.sign(mockCustomerPayload, 'wrong-secret');

      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: badToken },
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        done();
      });
    });

    it('should reject connection with empty string token', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: '' },
      });

      clientSocket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        done();
      });
    });

    it('should accept connection with polling transport', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['polling'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    it('should assign a unique socket id on authenticated connection', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.id).toBeDefined();
        expect(typeof clientSocket.id).toBe('string');
        done();
      });
    });
  });

  // =================================================================
  // Auto-join rooms
  // =================================================================

  describe('Auto-join rooms', () => {
    it('should auto-join user:<userId> room for customer', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', async () => {
        // Wait a tick for room join to complete
        await new Promise((r) => setTimeout(r, 50));
        const sockets = await ioServer
          .in(`user:${mockCustomerPayload.userId}`)
          .fetchSockets();
        expect(sockets.length).toBe(1);
        expect(sockets[0].id).toBe(clientSocket.id);
        done();
      });
    });

    it('should auto-join user:<userId> room for admin', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      clientSocket.on('connect', async () => {
        await new Promise((r) => setTimeout(r, 50));
        const sockets = await ioServer
          .in(`user:${mockAdminPayload.userId}`)
          .fetchSockets();
        expect(sockets.length).toBe(1);
        expect(sockets[0].id).toBe(clientSocket.id);
        done();
      });
    });

    it('should auto-join dashboard room for admin', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      clientSocket.on('connect', async () => {
        await new Promise((r) => setTimeout(r, 50));
        const sockets = await ioServer.in('dashboard').fetchSockets();
        expect(sockets.length).toBe(1);
        expect(sockets[0].id).toBe(clientSocket.id);
        done();
      });
    });

    it('should NOT auto-join dashboard room for customer', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', async () => {
        await new Promise((r) => setTimeout(r, 50));
        const sockets = await ioServer.in('dashboard').fetchSockets();
        const customerSocket = sockets.find((s) => s.id === clientSocket.id);
        expect(customerSocket).toBeUndefined();
        done();
      });
    });
  });

  // =================================================================
  // Room management: join_ticket / leave_ticket
  // =================================================================

  describe('Room management', () => {
    it('should join ticket room when admin emits join_ticket', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      clientSocket.on('connect', async () => {
        clientSocket.emit('join_ticket', mockTicketId);
        await new Promise((r) => setTimeout(r, 100));
        const sockets = await ioServer
          .in(`ticket:${mockTicketId}`)
          .fetchSockets();
        expect(sockets.length).toBe(1);
        expect(sockets[0].id).toBe(clientSocket.id);
        done();
      });
    });

    it('should join ticket room when customer owns the ticket', (done) => {
      const selectChain = setupDbMocks();
      selectChain.executeTakeFirst.mockResolvedValueOnce({
        id: mockTicketId,
        user_id: mockCustomerPayload.userId,
      });

      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', async () => {
        clientSocket.emit('join_ticket', mockTicketId);
        await new Promise((r) => setTimeout(r, 100));
        const sockets = await ioServer
          .in(`ticket:${mockTicketId}`)
          .fetchSockets();
        const found = sockets.find((s) => s.id === clientSocket.id);
        expect(found).toBeDefined();
        done();
      });
    });

    it('should NOT join ticket room when customer does not own the ticket', (done) => {
      const selectChain = setupDbMocks();
      selectChain.executeTakeFirst.mockResolvedValueOnce({
        id: mockTicketId,
        user_id: 'another-user-id',
      });

      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', async () => {
        clientSocket.emit('join_ticket', mockTicketId);
        await new Promise((r) => setTimeout(r, 100));
        const sockets = await ioServer
          .in(`ticket:${mockTicketId}`)
          .fetchSockets();
        const found = sockets.find((s) => s.id === clientSocket.id);
        expect(found).toBeUndefined();
        done();
      });
    });

    it('should NOT join ticket room when ticket does not exist', (done) => {
      const selectChain = setupDbMocks();
      selectChain.executeTakeFirst.mockResolvedValueOnce(undefined);

      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', async () => {
        clientSocket.emit('join_ticket', 'nonexistent-ticket-id');
        await new Promise((r) => setTimeout(r, 100));
        const sockets = await ioServer
          .in('ticket:nonexistent-ticket-id')
          .fetchSockets();
        const found = sockets.find((s) => s.id === clientSocket.id);
        expect(found).toBeUndefined();
        done();
      });
    });

    it('should leave ticket room when emitting leave_ticket', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      clientSocket.on('connect', async () => {
        clientSocket.emit('join_ticket', mockTicketId);
        await new Promise((r) => setTimeout(r, 100));

        // Verify joined
        let sockets = await ioServer
          .in(`ticket:${mockTicketId}`)
          .fetchSockets();
        expect(sockets.find((s) => s.id === clientSocket.id)).toBeDefined();

        // Leave
        clientSocket.emit('leave_ticket', mockTicketId);
        await new Promise((r) => setTimeout(r, 100));

        // Verify left
        sockets = await ioServer.in(`ticket:${mockTicketId}`).fetchSockets();
        expect(sockets.find((s) => s.id === clientSocket.id)).toBeUndefined();
        done();
      });
    });
  });

  // =================================================================
  // Disconnection
  // =================================================================

  describe('Disconnection', () => {
    it('should handle client disconnection gracefully', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', () => {
        expect(clientSocket.connected).toBe(false);
        done();
      });
    });

    it('should clean up rooms on disconnection', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      clientSocket.on('connect', async () => {
        clientSocket.emit('join_ticket', mockTicketId);
        await new Promise((r) => setTimeout(r, 100));

        clientSocket.disconnect();
        await new Promise((r) => setTimeout(r, 100));

        const sockets = await ioServer
          .in(`ticket:${mockTicketId}`)
          .fetchSockets();
        expect(sockets.find((s) => s.id === clientSocket.id)).toBeUndefined();
        done();
      });
    });
  });

  // =================================================================
  // Multiple connections
  // =================================================================

  describe('Multiple connections', () => {
    let secondClient: ClientSocket;

    afterEach(() => {
      if (secondClient && secondClient.connected) {
        secondClient.disconnect();
      }
    });

    it('should handle multiple simultaneous authenticated connections', (done) => {
      let connectedCount = 0;

      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customerToken },
      });
      secondClient = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      const checkDone = () => {
        connectedCount++;
        if (connectedCount === 2) {
          expect(clientSocket.id).not.toBe(secondClient.id);
          done();
        }
      };

      clientSocket.on('connect', checkDone);
      secondClient.on('connect', checkDone);
    });
  });
});
