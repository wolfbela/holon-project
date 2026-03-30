import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import type { JwtPayload } from '../middleware/auth';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@holon/shared';

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export const socketAuthMiddleware = (
  socket: AppSocket,
  next: (err?: Error) => void,
): void => {
  const token = socket.handshake.auth.token as string | undefined;

  if (!token) {
    next(new Error('Authentication error: no token provided'));
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    socket.data.userId = decoded.userId;
    socket.data.email = decoded.email;
    socket.data.role = decoded.role;
    next();
  } catch {
    next(new Error('Authentication error: invalid token'));
  }
};
