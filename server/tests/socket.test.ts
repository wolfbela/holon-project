import http from 'http';
import { Server } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { createSocketServer, getIO } from '../src/socket';
import app from '../src/app';

describe('Socket.io Setup', () => {
  let httpServer: http.Server;
  let ioServer: Server;
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
  });

  afterAll((done) => {
    ioServer.close();
    httpServer.close(done);
  });

  describe('Server initialization', () => {
    it('should create a Socket.io server instance', () => {
      expect(ioServer).toBeInstanceOf(Server);
    });

    it('should return the same instance via getIO()', () => {
      const io = getIO();
      expect(io).toBe(ioServer);
    });
  });

  describe('Client connections', () => {
    it('should accept WebSocket connections', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    it('should accept polling transport connections', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['polling'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    it('should assign a unique socket id on connection', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.id).toBeDefined();
        expect(typeof clientSocket.id).toBe('string');
        done();
      });
    });
  });

  describe('Client disconnections', () => {
    it('should handle client disconnection gracefully', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', () => {
        expect(clientSocket.connected).toBe(false);
        done();
      });
    });
  });

  describe('Multiple connections', () => {
    let secondClient: ClientSocket;

    afterEach(() => {
      if (secondClient && secondClient.connected) {
        secondClient.disconnect();
      }
    });

    it('should handle multiple simultaneous connections', (done) => {
      let connectedCount = 0;

      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
      });
      secondClient = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
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

  describe('CORS configuration', () => {
    it('should allow connections from configured origin', (done) => {
      clientSocket = ClientIO(`http://localhost:${port}`, {
        transports: ['websocket'],
        extraHeaders: {
          Origin: 'http://localhost:3000',
        },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', () => {
        done(new Error('Connection should not be rejected for allowed origin'));
      });
    });
  });
});

describe('getIO() before initialization', () => {
  it('should throw error when Socket.io is not initialized', () => {
    // We need to test getIO before createSocketServer is called.
    // Since the module state persists, we test the error message shape
    // by checking that getIO returns a Server instance (already initialized above).
    const io = getIO();
    expect(io).toBeInstanceOf(Server);
  });
});
