import {
  // User schemas & constants
  USER_ROLES,
  UserRoleSchema,
  RegisterSchema,
  LoginSchema,
  // Ticket schemas & constants
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TicketStatusSchema,
  TicketPrioritySchema,
  CreateTicketSchema,
  UpdateTicketSchema,
  // Reply schemas & constants
  AUTHOR_TYPES,
  AuthorTypeSchema,
  CreateReplySchema,
  // Notification constants
  NOTIFICATION_TYPES,
  NotificationTypeSchema,
} from '@shared/index';

function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Enum Constants & Zod Enum Schemas
// ---------------------------------------------------------------------------

describe('Shared Zod Schemas', () => {
  // =========================================================================
  // ENUM CONSTANTS
  // =========================================================================

  describe('Enum constants', () => {
    it('USER_ROLES should contain customer and admin', () => {
      expect(USER_ROLES).toEqual(['customer', 'admin']);
    });

    it('TICKET_STATUSES should contain open and closed', () => {
      expect(TICKET_STATUSES).toEqual(['open', 'closed']);
    });

    it('TICKET_PRIORITIES should contain low, medium, and high', () => {
      expect(TICKET_PRIORITIES).toEqual(['low', 'medium', 'high']);
    });

    it('AUTHOR_TYPES should contain customer and agent', () => {
      expect(AUTHOR_TYPES).toEqual(['customer', 'agent']);
    });

    it('NOTIFICATION_TYPES should contain new_ticket, new_reply, and ticket_closed', () => {
      expect(NOTIFICATION_TYPES).toEqual([
        'new_ticket',
        'new_reply',
        'ticket_closed',
      ]);
    });
  });

  // =========================================================================
  // ENUM SCHEMAS
  // =========================================================================

  describe('Enum schemas', () => {
    describe('UserRoleSchema', () => {
      it.each(['customer', 'admin'])('should accept "%s"', (role) => {
        expect(UserRoleSchema.parse(role)).toBe(role);
      });

      it.each(['superadmin', 'moderator', '', 'ADMIN', 'Customer'])(
        'should reject invalid role "%s"',
        (role) => {
          const result = UserRoleSchema.safeParse(role);
          expect(result.success).toBe(false);
        },
      );

      it('should reject non-string values', () => {
        expect(UserRoleSchema.safeParse(123).success).toBe(false);
        expect(UserRoleSchema.safeParse(null).success).toBe(false);
        expect(UserRoleSchema.safeParse(undefined).success).toBe(false);
      });
    });

    describe('TicketStatusSchema', () => {
      it.each(['open', 'closed'])('should accept "%s"', (status) => {
        expect(TicketStatusSchema.parse(status)).toBe(status);
      });

      it.each(['pending', 'resolved', '', 'Open', 'CLOSED'])(
        'should reject invalid status "%s"',
        (status) => {
          const result = TicketStatusSchema.safeParse(status);
          expect(result.success).toBe(false);
        },
      );
    });

    describe('TicketPrioritySchema', () => {
      it.each(['low', 'medium', 'high'])('should accept "%s"', (priority) => {
        expect(TicketPrioritySchema.parse(priority)).toBe(priority);
      });

      it.each(['urgent', 'critical', '', 'Low', 'HIGH'])(
        'should reject invalid priority "%s"',
        (priority) => {
          const result = TicketPrioritySchema.safeParse(priority);
          expect(result.success).toBe(false);
        },
      );
    });

    describe('AuthorTypeSchema', () => {
      it.each(['customer', 'agent'])('should accept "%s"', (type) => {
        expect(AuthorTypeSchema.parse(type)).toBe(type);
      });

      it.each(['admin', 'bot', '', 'Agent', 'CUSTOMER'])(
        'should reject invalid author type "%s"',
        (type) => {
          const result = AuthorTypeSchema.safeParse(type);
          expect(result.success).toBe(false);
        },
      );
    });

    describe('NotificationTypeSchema', () => {
      it.each(['new_ticket', 'new_reply', 'ticket_closed'])(
        'should accept "%s"',
        (type) => {
          expect(NotificationTypeSchema.parse(type)).toBe(type);
        },
      );

      it.each(['ticket_reopened', 'assigned', '', 'NEW_TICKET'])(
        'should reject invalid notification type "%s"',
        (type) => {
          const result = NotificationTypeSchema.safeParse(type);
          expect(result.success).toBe(false);
        },
      );
    });
  });

  // =========================================================================
  // REGISTER SCHEMA
  // =========================================================================

  describe('RegisterSchema', () => {
    const validInput = {
      email: 'test@example.com',
      name: 'John Doe',
      password: 'secure123',
    };

    describe('Happy path', () => {
      it('should accept valid registration input', () => {
        const result = RegisterSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validInput);
        }
      });

      it('should accept email with subdomains', () => {
        const result = RegisterSchema.safeParse({
          ...validInput,
          email: 'user@mail.example.co.uk',
        });
        expect(result.success).toBe(true);
      });

      it('should accept name with exactly 1 character', () => {
        const result = RegisterSchema.safeParse({ ...validInput, name: 'A' });
        expect(result.success).toBe(true);
      });

      it('should accept name with exactly 255 characters', () => {
        const result = RegisterSchema.safeParse({
          ...validInput,
          name: 'A'.repeat(255),
        });
        expect(result.success).toBe(true);
      });

      it('should accept password with exactly 6 characters', () => {
        const result = RegisterSchema.safeParse({
          ...validInput,
          password: '123456',
        });
        expect(result.success).toBe(true);
      });

      it('should accept password with exactly 100 characters', () => {
        const result = RegisterSchema.safeParse({
          ...validInput,
          password: 'a'.repeat(100),
        });
        expect(result.success).toBe(true);
      });
    });

    describe('Email validation', () => {
      it('should reject missing email', () => {
        expect(
          RegisterSchema.safeParse(omit(validInput, 'email')).success,
        ).toBe(false);
      });

      it('should reject empty email', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, email: '' }).success,
        ).toBe(false);
      });

      it('should reject email without @', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, email: 'notanemail' })
            .success,
        ).toBe(false);
      });

      it('should reject email without domain', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, email: 'user@' }).success,
        ).toBe(false);
      });

      it('should reject email without local part', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, email: '@example.com' })
            .success,
        ).toBe(false);
      });

      it('should reject non-string email', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, email: 123 }).success,
        ).toBe(false);
      });
    });

    describe('Name validation', () => {
      it('should reject missing name', () => {
        expect(RegisterSchema.safeParse(omit(validInput, 'name')).success).toBe(
          false,
        );
      });

      it('should reject empty name', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, name: '' }).success,
        ).toBe(false);
      });

      it('should reject name exceeding 255 characters', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, name: 'A'.repeat(256) })
            .success,
        ).toBe(false);
      });

      it('should reject non-string name', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, name: 42 }).success,
        ).toBe(false);
      });
    });

    describe('Password validation', () => {
      it('should reject missing password', () => {
        expect(
          RegisterSchema.safeParse(omit(validInput, 'password')).success,
        ).toBe(false);
      });

      it('should reject password shorter than 6 characters', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, password: '12345' })
            .success,
        ).toBe(false);
      });

      it('should reject password exceeding 100 characters', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, password: 'a'.repeat(101) })
            .success,
        ).toBe(false);
      });

      it('should reject empty password', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, password: '' }).success,
        ).toBe(false);
      });

      it('should reject non-string password', () => {
        expect(
          RegisterSchema.safeParse({ ...validInput, password: 123456 }).success,
        ).toBe(false);
      });
    });

    describe('Wrong types', () => {
      it('should reject null input', () => {
        expect(RegisterSchema.safeParse(null).success).toBe(false);
      });

      it('should reject undefined input', () => {
        expect(RegisterSchema.safeParse(undefined).success).toBe(false);
      });

      it('should reject string input', () => {
        expect(RegisterSchema.safeParse('not an object').success).toBe(false);
      });

      it('should reject array input', () => {
        expect(RegisterSchema.safeParse([]).success).toBe(false);
      });
    });

    describe('Extra fields', () => {
      it('should strip unknown fields', () => {
        const result = RegisterSchema.safeParse({
          ...validInput,
          role: 'admin',
          extra: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('role');
          expect(result.data).not.toHaveProperty('extra');
        }
      });
    });

    describe('Security payloads', () => {
      it('should accept but not execute SQL injection in name', () => {
        const result = RegisterSchema.safeParse({
          ...validInput,
          name: "'; DROP TABLE users; --",
        });
        expect(result.success).toBe(true);
      });

      it('should accept but not execute XSS in name', () => {
        const result = RegisterSchema.safeParse({
          ...validInput,
          name: '<script>alert("xss")</script>',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // LOGIN SCHEMA
  // =========================================================================

  describe('LoginSchema', () => {
    const validInput = {
      email: 'user@example.com',
      password: 'mypassword',
    };

    describe('Happy path', () => {
      it('should accept valid login input', () => {
        const result = LoginSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validInput);
        }
      });

      it('should accept password with 1 character (min 1)', () => {
        const result = LoginSchema.safeParse({ ...validInput, password: 'a' });
        expect(result.success).toBe(true);
      });
    });

    describe('Email validation', () => {
      it('should reject missing email', () => {
        expect(LoginSchema.safeParse(omit(validInput, 'email')).success).toBe(
          false,
        );
      });

      it('should reject invalid email', () => {
        expect(
          LoginSchema.safeParse({ ...validInput, email: 'bademail' }).success,
        ).toBe(false);
      });

      it('should reject empty email', () => {
        expect(
          LoginSchema.safeParse({ ...validInput, email: '' }).success,
        ).toBe(false);
      });
    });

    describe('Password validation', () => {
      it('should reject missing password', () => {
        expect(
          LoginSchema.safeParse(omit(validInput, 'password')).success,
        ).toBe(false);
      });

      it('should reject empty password', () => {
        expect(
          LoginSchema.safeParse({ ...validInput, password: '' }).success,
        ).toBe(false);
      });

      it('should reject non-string password', () => {
        expect(
          LoginSchema.safeParse({ ...validInput, password: 123 }).success,
        ).toBe(false);
      });
    });

    describe('Wrong types', () => {
      it('should reject null input', () => {
        expect(LoginSchema.safeParse(null).success).toBe(false);
      });

      it('should reject number input', () => {
        expect(LoginSchema.safeParse(42).success).toBe(false);
      });
    });
  });

  // =========================================================================
  // CREATE TICKET SCHEMA
  // =========================================================================

  describe('CreateTicketSchema', () => {
    const validInput = {
      product_id: 1,
      product_name: 'Test Product',
      subject: 'Product arrived damaged',
      message: 'The zipper on my backpack was broken when it arrived.',
    };

    describe('Happy path', () => {
      it('should accept valid ticket creation input', () => {
        const result = CreateTicketSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validInput);
        }
      });

      it('should accept product_id of 1 (minimum positive)', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          product_id: 1,
        });
        expect(result.success).toBe(true);
      });

      it('should accept large product_id', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          product_id: 999999,
        });
        expect(result.success).toBe(true);
      });

      it('should accept subject with exactly 255 characters', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          subject: 'A'.repeat(255),
        });
        expect(result.success).toBe(true);
      });

      it('should accept message with exactly 5000 characters', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          message: 'A'.repeat(5000),
        });
        expect(result.success).toBe(true);
      });

      it('should accept single character product_name', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          product_name: 'X',
        });
        expect(result.success).toBe(true);
      });

      it('should accept single character subject', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          subject: 'X',
        });
        expect(result.success).toBe(true);
      });

      it('should accept single character message', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          message: 'X',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('product_id validation', () => {
      it('should reject missing product_id', () => {
        expect(
          CreateTicketSchema.safeParse(omit(validInput, 'product_id')).success,
        ).toBe(false);
      });

      it('should reject product_id of 0', () => {
        expect(
          CreateTicketSchema.safeParse({ ...validInput, product_id: 0 })
            .success,
        ).toBe(false);
      });

      it('should reject negative product_id', () => {
        expect(
          CreateTicketSchema.safeParse({ ...validInput, product_id: -1 })
            .success,
        ).toBe(false);
      });

      it('should reject non-number product_id', () => {
        expect(
          CreateTicketSchema.safeParse({ ...validInput, product_id: '1' })
            .success,
        ).toBe(false);
      });

      it('should accept float product_id (positive)', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          product_id: 1.5,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('product_name validation', () => {
      it('should reject missing product_name', () => {
        expect(
          CreateTicketSchema.safeParse(omit(validInput, 'product_name'))
            .success,
        ).toBe(false);
      });

      it('should reject empty product_name', () => {
        expect(
          CreateTicketSchema.safeParse({ ...validInput, product_name: '' })
            .success,
        ).toBe(false);
      });

      it('should reject non-string product_name', () => {
        expect(
          CreateTicketSchema.safeParse({ ...validInput, product_name: 123 })
            .success,
        ).toBe(false);
      });
    });

    describe('subject validation', () => {
      it('should reject missing subject', () => {
        expect(
          CreateTicketSchema.safeParse(omit(validInput, 'subject')).success,
        ).toBe(false);
      });

      it('should reject empty subject', () => {
        expect(
          CreateTicketSchema.safeParse({ ...validInput, subject: '' }).success,
        ).toBe(false);
      });

      it('should reject subject exceeding 255 characters', () => {
        expect(
          CreateTicketSchema.safeParse({
            ...validInput,
            subject: 'A'.repeat(256),
          }).success,
        ).toBe(false);
      });
    });

    describe('message validation', () => {
      it('should reject missing message', () => {
        expect(
          CreateTicketSchema.safeParse(omit(validInput, 'message')).success,
        ).toBe(false);
      });

      it('should reject empty message', () => {
        expect(
          CreateTicketSchema.safeParse({ ...validInput, message: '' }).success,
        ).toBe(false);
      });

      it('should reject message exceeding 5000 characters', () => {
        expect(
          CreateTicketSchema.safeParse({
            ...validInput,
            message: 'A'.repeat(5001),
          }).success,
        ).toBe(false);
      });
    });

    describe('Wrong types', () => {
      it('should reject null input', () => {
        expect(CreateTicketSchema.safeParse(null).success).toBe(false);
      });

      it('should reject string input', () => {
        expect(CreateTicketSchema.safeParse('ticket').success).toBe(false);
      });
    });

    describe('Extra fields', () => {
      it('should strip unknown fields like status and priority', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          status: 'open',
          priority: 'high',
          user_id: 'abc-123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('status');
          expect(result.data).not.toHaveProperty('priority');
          expect(result.data).not.toHaveProperty('user_id');
        }
      });
    });

    describe('Security payloads', () => {
      it('should accept SQL injection in subject without crashing', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          subject: "' OR 1=1 --",
        });
        expect(result.success).toBe(true);
      });

      it('should accept XSS in message without crashing', () => {
        const result = CreateTicketSchema.safeParse({
          ...validInput,
          message: '<img src=x onerror=alert(1)>',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // UPDATE TICKET SCHEMA
  // =========================================================================

  describe('UpdateTicketSchema', () => {
    describe('Happy path', () => {
      it('should accept valid status update', () => {
        const result = UpdateTicketSchema.safeParse({ status: 'open' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('open');
        }
      });

      it('should accept valid priority update', () => {
        const result = UpdateTicketSchema.safeParse({ priority: 'high' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.priority).toBe('high');
        }
      });

      it('should accept both status and priority', () => {
        const result = UpdateTicketSchema.safeParse({
          status: 'closed',
          priority: 'low',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ status: 'closed', priority: 'low' });
        }
      });

      it('should accept empty object (all fields optional)', () => {
        const result = UpdateTicketSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBeUndefined();
          expect(result.data.priority).toBeUndefined();
        }
      });
    });

    describe('Status validation', () => {
      it.each(['open', 'closed'])('should accept status "%s"', (status) => {
        const result = UpdateTicketSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });

      it.each(['pending', 'resolved', 'Open', 'CLOSED', ''])(
        'should reject invalid status "%s"',
        (status) => {
          expect(UpdateTicketSchema.safeParse({ status }).success).toBe(false);
        },
      );

      it('should reject non-string status', () => {
        expect(UpdateTicketSchema.safeParse({ status: 1 }).success).toBe(false);
      });
    });

    describe('Priority validation', () => {
      it.each(['low', 'medium', 'high'])(
        'should accept priority "%s"',
        (priority) => {
          const result = UpdateTicketSchema.safeParse({ priority });
          expect(result.success).toBe(true);
        },
      );

      it.each(['urgent', 'critical', 'Low', 'HIGH', ''])(
        'should reject invalid priority "%s"',
        (priority) => {
          expect(UpdateTicketSchema.safeParse({ priority }).success).toBe(
            false,
          );
        },
      );

      it('should reject non-string priority', () => {
        expect(UpdateTicketSchema.safeParse({ priority: 2 }).success).toBe(
          false,
        );
      });
    });

    describe('Extra fields', () => {
      it('should strip unknown fields', () => {
        const result = UpdateTicketSchema.safeParse({
          status: 'open',
          subject: 'new subject',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('subject');
        }
      });
    });
  });

  // =========================================================================
  // CREATE REPLY SCHEMA
  // =========================================================================

  describe('CreateReplySchema', () => {
    const validInput = { message: 'Thank you for your support.' };

    describe('Happy path', () => {
      it('should accept valid reply input', () => {
        const result = CreateReplySchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validInput);
        }
      });

      it('should accept message with exactly 1 character', () => {
        const result = CreateReplySchema.safeParse({ message: 'A' });
        expect(result.success).toBe(true);
      });

      it('should accept message with exactly 5000 characters', () => {
        const result = CreateReplySchema.safeParse({
          message: 'B'.repeat(5000),
        });
        expect(result.success).toBe(true);
      });
    });

    describe('Message validation', () => {
      it('should reject missing message', () => {
        expect(CreateReplySchema.safeParse({}).success).toBe(false);
      });

      it('should reject empty message', () => {
        expect(CreateReplySchema.safeParse({ message: '' }).success).toBe(
          false,
        );
      });

      it('should reject message exceeding 5000 characters', () => {
        expect(
          CreateReplySchema.safeParse({ message: 'C'.repeat(5001) }).success,
        ).toBe(false);
      });

      it('should reject non-string message', () => {
        expect(CreateReplySchema.safeParse({ message: 42 }).success).toBe(
          false,
        );
      });

      it('should reject null message', () => {
        expect(CreateReplySchema.safeParse({ message: null }).success).toBe(
          false,
        );
      });
    });

    describe('Wrong types', () => {
      it('should reject null input', () => {
        expect(CreateReplySchema.safeParse(null).success).toBe(false);
      });

      it('should reject undefined input', () => {
        expect(CreateReplySchema.safeParse(undefined).success).toBe(false);
      });
    });

    describe('Extra fields', () => {
      it('should strip unknown fields like author_type', () => {
        const result = CreateReplySchema.safeParse({
          message: 'Hello',
          author_type: 'agent',
          ticket_id: 'abc',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('author_type');
          expect(result.data).not.toHaveProperty('ticket_id');
        }
      });
    });

    describe('Security payloads', () => {
      it('should accept SQL injection in message without crashing', () => {
        const result = CreateReplySchema.safeParse({
          message: "'; DROP TABLE replies; --",
        });
        expect(result.success).toBe(true);
      });

      it('should accept XSS in message without crashing', () => {
        const result = CreateReplySchema.safeParse({
          message: '<script>alert("xss")</script>',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // BARREL EXPORT VERIFICATION
  // =========================================================================

  describe('Barrel export', () => {
    it('should export all schemas from @shared/index', () => {
      expect(RegisterSchema).toBeDefined();
      expect(LoginSchema).toBeDefined();
      expect(CreateTicketSchema).toBeDefined();
      expect(UpdateTicketSchema).toBeDefined();
      expect(CreateReplySchema).toBeDefined();
    });

    it('should export all enum schemas from @shared/index', () => {
      expect(UserRoleSchema).toBeDefined();
      expect(TicketStatusSchema).toBeDefined();
      expect(TicketPrioritySchema).toBeDefined();
      expect(AuthorTypeSchema).toBeDefined();
      expect(NotificationTypeSchema).toBeDefined();
    });

    it('should export all constant arrays from @shared/index', () => {
      expect(USER_ROLES).toBeDefined();
      expect(TICKET_STATUSES).toBeDefined();
      expect(TICKET_PRIORITIES).toBeDefined();
      expect(AUTHOR_TYPES).toBeDefined();
      expect(NOTIFICATION_TYPES).toBeDefined();
    });
  });
});
