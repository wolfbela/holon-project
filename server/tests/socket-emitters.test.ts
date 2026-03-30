import {
  emitNewReply,
  emitTicketUpdated,
  emitTicketCreated,
  emitNewNotification,
} from '../src/socket/emitters';
import { getIO } from '../src/socket';
import type { Ticket, Reply, Notification } from '@holon/shared';

// --- Mock getIO ---

const mockEmit = jest.fn();
const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });

jest.mock('../src/socket', () => ({
  getIO: jest.fn().mockReturnValue({
    to: (...args: unknown[]) => mockTo(...args),
  }),
}));

// --- Test data ---

const mockReply: Reply = {
  id: 'bbb00000-0000-0000-0000-000000000001',
  ticket_id: 'aaa00000-0000-0000-0000-000000000001',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  author_type: 'customer',
  message: 'Can you help me?',
  created_at: '2026-01-15T11:00:00.000Z',
};

const mockTicket: Ticket = {
  id: 'aaa00000-0000-0000-0000-000000000001',
  display_id: 'TK-0001',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'customer@example.com',
  name: 'Test Customer',
  product_id: 1,
  product_name: 'Fjallraven Backpack',
  subject: 'Product arrived damaged',
  message: 'The zipper was broken.',
  status: 'open',
  priority: 'medium',
  created_at: '2026-01-15T10:00:00.000Z',
  updated_at: '2026-01-15T10:00:00.000Z',
};

const mockNotification: Notification = {
  id: 'nnn00000-0000-0000-0000-000000000001',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'new_reply',
  ticket_id: 'aaa00000-0000-0000-0000-000000000001',
  message: 'New reply on ticket TK-0001',
  read: false,
  created_at: '2026-01-16T10:00:00.000Z',
};

// --- Tests ---

describe('Socket Emitters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTo.mockReturnValue({ emit: mockEmit });
  });

  // =================================================================
  // emitNewReply
  // =================================================================

  describe('emitNewReply', () => {
    it('should emit new_reply to the correct ticket room', () => {
      const ticketId = 'aaa00000-0000-0000-0000-000000000001';
      emitNewReply(ticketId, mockReply);

      expect(getIO).toHaveBeenCalled();
      expect(mockTo).toHaveBeenCalledWith(`ticket:${ticketId}`);
      expect(mockEmit).toHaveBeenCalledWith('new_reply', {
        reply: mockReply,
        ticketId,
      });
    });

    it('should use the ticketId parameter for room name, not reply.ticket_id', () => {
      const differentTicketId = 'different-ticket-id';
      emitNewReply(differentTicketId, mockReply);

      expect(mockTo).toHaveBeenCalledWith(`ticket:${differentTicketId}`);
    });
  });

  // =================================================================
  // emitTicketUpdated
  // =================================================================

  describe('emitTicketUpdated', () => {
    it('should emit ticket_updated to the correct ticket room', () => {
      emitTicketUpdated(mockTicket);

      expect(mockTo).toHaveBeenCalledWith(`ticket:${mockTicket.id}`);
      expect(mockEmit).toHaveBeenCalledWith('ticket_updated', {
        ticket: mockTicket,
      });
    });

    it('should use ticket.id for the room name', () => {
      const closedTicket = {
        ...mockTicket,
        id: 'closed-ticket-id',
        status: 'closed' as const,
      };
      emitTicketUpdated(closedTicket);

      expect(mockTo).toHaveBeenCalledWith('ticket:closed-ticket-id');
    });
  });

  // =================================================================
  // emitTicketCreated
  // =================================================================

  describe('emitTicketCreated', () => {
    it('should emit ticket_created to the dashboard room', () => {
      emitTicketCreated(mockTicket);

      expect(mockTo).toHaveBeenCalledWith('dashboard');
      expect(mockEmit).toHaveBeenCalledWith('ticket_created', {
        ticket: mockTicket,
      });
    });

    it('should always emit to dashboard room regardless of ticket data', () => {
      const anotherTicket = { ...mockTicket, id: 'another-id' };
      emitTicketCreated(anotherTicket);

      expect(mockTo).toHaveBeenCalledWith('dashboard');
    });
  });

  // =================================================================
  // emitNewNotification
  // =================================================================

  describe('emitNewNotification', () => {
    it('should emit new_notification to the correct user room', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      emitNewNotification(userId, mockNotification);

      expect(mockTo).toHaveBeenCalledWith(`user:${userId}`);
      expect(mockEmit).toHaveBeenCalledWith('new_notification', {
        notification: mockNotification,
      });
    });

    it('should use the userId parameter for room name', () => {
      const adminUserId = '660e8400-e29b-41d4-a716-446655440000';
      const adminNotification = { ...mockNotification, user_id: adminUserId };
      emitNewNotification(adminUserId, adminNotification);

      expect(mockTo).toHaveBeenCalledWith(`user:${adminUserId}`);
    });
  });
});
