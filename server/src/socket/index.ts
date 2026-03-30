import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
} from '@holon/shared';
import { socketAuthMiddleware } from './authMiddleware';
import { db } from '../db';

type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

let io: TypedServer;

export const createSocketServer = (httpServer: HttpServer): TypedServer => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const { userId, role } = socket.data;

    // Auto-join personal room
    socket.join(`user:${userId}`);

    // Admins auto-join dashboard room
    if (role === 'admin') {
      socket.join('dashboard');
    }

    // Join a ticket room (with access control)
    socket.on('join_ticket', async (ticketId: string) => {
      try {
        if (role === 'admin') {
          socket.join(`ticket:${ticketId}`);
          return;
        }

        const ticket = await db
          .selectFrom('tickets')
          .select(['id', 'user_id'])
          .where('id', '=', ticketId)
          .executeTakeFirst();

        if (ticket && ticket.user_id === userId) {
          socket.join(`ticket:${ticketId}`);
        }
      } catch (err) {
        console.error('Error joining ticket room:', err);
      }
    });

    // Leave a ticket room
    socket.on('leave_ticket', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
    });

    socket.on('disconnect', () => {
      // Room cleanup is automatic in Socket.io
    });
  });

  return io;
};

export const getIO = (): TypedServer => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
