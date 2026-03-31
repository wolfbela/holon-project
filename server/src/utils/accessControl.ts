import { AppError } from './AppError';
import { JwtPayload } from '../middleware/auth';

export function assertCanAccessTicket(
  user: JwtPayload,
  ticketUserId: string,
): void {
  if (user.role !== 'admin' && ticketUserId !== user.userId) {
    throw new AppError('Forbidden', 403);
  }
}
