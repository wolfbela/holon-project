import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { Database } from '../src/db/types';

let db: Kysely<Database>;

beforeAll(() => {
  db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });
});

afterAll(async () => {
  await db.destroy();
});

describe('Kysely Database Setup', () => {
  describe('Database connection', () => {
    it('should connect to PostgreSQL successfully', async () => {
      const result = await sql<{ result: number }>`SELECT 1 AS result`.execute(
        db,
      );
      expect(result.rows[0].result).toBe(1);
    });

    it('should connect to the correct database', async () => {
      const result = await sql<{
        current_database: string;
      }>`SELECT current_database()`.execute(db);
      expect(result.rows[0].current_database).toBe('agilite');
    });
  });

  describe('Tables existence', () => {
    it('should have created the users table', async () => {
      const result = await sql<{
        exists: boolean;
      }>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')`.execute(
        db,
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have created the tickets table', async () => {
      const result = await sql<{
        exists: boolean;
      }>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets')`.execute(
        db,
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have created the replies table', async () => {
      const result = await sql<{
        exists: boolean;
      }>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'replies')`.execute(
        db,
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have created the notifications table', async () => {
      const result = await sql<{
        exists: boolean;
      }>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications')`.execute(
        db,
      );
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('Users table schema', () => {
    let columns: {
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }[];

    beforeAll(async () => {
      const result = await sql<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`.execute(
        db,
      );
      columns = result.rows;
    });

    it('should have all expected columns', () => {
      const columnNames = columns.map((c) => c.column_name);
      expect(columnNames).toEqual([
        'id',
        'email',
        'name',
        'password',
        'role',
        'created_at',
        'updated_at',
      ]);
    });

    it('should have id column as UUID type', () => {
      const col = columns.find((c) => c.column_name === 'id');
      expect(col?.data_type).toBe('uuid');
    });

    it('should have id column with gen_random_uuid() default', () => {
      const col = columns.find((c) => c.column_name === 'id');
      expect(col?.column_default).toBe('gen_random_uuid()');
    });

    it('should have email as varchar NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'email');
      expect(col?.data_type).toBe('character varying');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have name as varchar NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'name');
      expect(col?.data_type).toBe('character varying');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have password as varchar NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'password');
      expect(col?.data_type).toBe('character varying');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have role with default value customer', () => {
      const col = columns.find((c) => c.column_name === 'role');
      expect(col?.is_nullable).toBe('NO');
      expect(col?.column_default).toContain('customer');
    });

    it('should have created_at with NOW() default', () => {
      const col = columns.find((c) => c.column_name === 'created_at');
      expect(col?.data_type).toBe('timestamp without time zone');
      expect(col?.column_default).toContain('now()');
    });

    it('should have updated_at with NOW() default', () => {
      const col = columns.find((c) => c.column_name === 'updated_at');
      expect(col?.data_type).toBe('timestamp without time zone');
      expect(col?.column_default).toContain('now()');
    });
  });

  describe('Tickets table schema', () => {
    let columns: {
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }[];

    beforeAll(async () => {
      const result = await sql<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'tickets' ORDER BY ordinal_position`.execute(
        db,
      );
      columns = result.rows;
    });

    it('should have all expected columns', () => {
      const columnNames = columns.map((c) => c.column_name);
      expect(columnNames).toEqual([
        'id',
        'display_id',
        'user_id',
        'email',
        'name',
        'product_id',
        'product_name',
        'subject',
        'message',
        'status',
        'priority',
        'created_at',
        'updated_at',
      ]);
    });

    it('should have id column as UUID with gen_random_uuid() default', () => {
      const col = columns.find((c) => c.column_name === 'id');
      expect(col?.data_type).toBe('uuid');
      expect(col?.column_default).toBe('gen_random_uuid()');
    });

    it('should have display_id with sequence-based default', () => {
      const col = columns.find((c) => c.column_name === 'display_id');
      expect(col?.data_type).toBe('character varying');
      expect(col?.is_nullable).toBe('NO');
      expect(col?.column_default).toContain('ticket_display_id_seq');
    });

    it('should have user_id as UUID NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'user_id');
      expect(col?.data_type).toBe('uuid');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have product_id as integer NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'product_id');
      expect(col?.data_type).toBe('integer');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have message as text NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'message');
      expect(col?.data_type).toBe('text');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have status with default value open', () => {
      const col = columns.find((c) => c.column_name === 'status');
      expect(col?.is_nullable).toBe('NO');
      expect(col?.column_default).toContain('open');
    });

    it('should have priority with default value medium', () => {
      const col = columns.find((c) => c.column_name === 'priority');
      expect(col?.is_nullable).toBe('NO');
      expect(col?.column_default).toContain('medium');
    });
  });

  describe('Replies table schema', () => {
    let columns: {
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }[];

    beforeAll(async () => {
      const result = await sql<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'replies' ORDER BY ordinal_position`.execute(
        db,
      );
      columns = result.rows;
    });

    it('should have all expected columns', () => {
      const columnNames = columns.map((c) => c.column_name);
      expect(columnNames).toEqual([
        'id',
        'ticket_id',
        'user_id',
        'author_type',
        'message',
        'created_at',
      ]);
    });

    it('should have id column as UUID with gen_random_uuid() default', () => {
      const col = columns.find((c) => c.column_name === 'id');
      expect(col?.data_type).toBe('uuid');
      expect(col?.column_default).toBe('gen_random_uuid()');
    });

    it('should have ticket_id as UUID NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'ticket_id');
      expect(col?.data_type).toBe('uuid');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have author_type as varchar NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'author_type');
      expect(col?.data_type).toBe('character varying');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should not have updated_at column', () => {
      const col = columns.find((c) => c.column_name === 'updated_at');
      expect(col).toBeUndefined();
    });
  });

  describe('Notifications table schema', () => {
    let columns: {
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }[];

    beforeAll(async () => {
      const result = await sql<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position`.execute(
        db,
      );
      columns = result.rows;
    });

    it('should have all expected columns', () => {
      const columnNames = columns.map((c) => c.column_name);
      expect(columnNames).toEqual([
        'id',
        'user_id',
        'type',
        'ticket_id',
        'message',
        'read',
        'created_at',
      ]);
    });

    it('should have type as varchar(30) NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'type');
      expect(col?.data_type).toBe('character varying');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have message as varchar(500) NOT NULL', () => {
      const col = columns.find((c) => c.column_name === 'message');
      expect(col?.data_type).toBe('character varying');
      expect(col?.is_nullable).toBe('NO');
    });

    it('should have read with default value false', () => {
      const col = columns.find((c) => c.column_name === 'read');
      expect(col?.data_type).toBe('boolean');
      expect(col?.column_default).toBe('false');
    });
  });

  describe('Primary keys', () => {
    let primaryKeys: { table_name: string; column_name: string }[];

    beforeAll(async () => {
      const result = await sql<{
        table_name: string;
        column_name: string;
      }>`SELECT tc.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = 'public'
           AND tc.table_name IN ('users', 'tickets', 'replies', 'notifications')
         ORDER BY tc.table_name`.execute(db);
      primaryKeys = result.rows;
    });

    it('should have id as primary key for users', () => {
      const pk = primaryKeys.find((p) => p.table_name === 'users');
      expect(pk?.column_name).toBe('id');
    });

    it('should have id as primary key for tickets', () => {
      const pk = primaryKeys.find((p) => p.table_name === 'tickets');
      expect(pk?.column_name).toBe('id');
    });

    it('should have id as primary key for replies', () => {
      const pk = primaryKeys.find((p) => p.table_name === 'replies');
      expect(pk?.column_name).toBe('id');
    });

    it('should have id as primary key for notifications', () => {
      const pk = primaryKeys.find((p) => p.table_name === 'notifications');
      expect(pk?.column_name).toBe('id');
    });
  });

  describe('Foreign keys', () => {
    let foreignKeys: {
      table_name: string;
      column_name: string;
      foreign_table: string;
      foreign_column: string;
      delete_rule: string;
    }[];

    beforeAll(async () => {
      const result = await sql<{
        table_name: string;
        column_name: string;
        foreign_table: string;
        foreign_column: string;
        delete_rule: string;
      }>`SELECT
           tc.table_name,
           kcu.column_name,
           ccu.table_name AS foreign_table,
           ccu.column_name AS foreign_column,
           rc.delete_rule
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name
         JOIN information_schema.referential_constraints rc
           ON tc.constraint_name = rc.constraint_name
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'public'
         ORDER BY tc.table_name, kcu.column_name`.execute(db);
      foreignKeys = result.rows;
    });

    it('should have tickets.user_id referencing users.id', () => {
      const fk = foreignKeys.find(
        (f) => f.table_name === 'tickets' && f.column_name === 'user_id',
      );
      expect(fk?.foreign_table).toBe('users');
      expect(fk?.foreign_column).toBe('id');
    });

    it('should have tickets.user_id with NO ACTION (restrict) on delete', () => {
      const fk = foreignKeys.find(
        (f) => f.table_name === 'tickets' && f.column_name === 'user_id',
      );
      expect(fk?.delete_rule).toBe('NO ACTION');
    });

    it('should have replies.ticket_id referencing tickets.id', () => {
      const fk = foreignKeys.find(
        (f) => f.table_name === 'replies' && f.column_name === 'ticket_id',
      );
      expect(fk?.foreign_table).toBe('tickets');
      expect(fk?.foreign_column).toBe('id');
    });

    it('should have replies.ticket_id with CASCADE on delete', () => {
      const fk = foreignKeys.find(
        (f) => f.table_name === 'replies' && f.column_name === 'ticket_id',
      );
      expect(fk?.delete_rule).toBe('CASCADE');
    });

    it('should have replies.user_id referencing users.id', () => {
      const fk = foreignKeys.find(
        (f) => f.table_name === 'replies' && f.column_name === 'user_id',
      );
      expect(fk?.foreign_table).toBe('users');
      expect(fk?.foreign_column).toBe('id');
    });

    it('should have replies.user_id with NO ACTION (restrict) on delete', () => {
      const fk = foreignKeys.find(
        (f) => f.table_name === 'replies' && f.column_name === 'user_id',
      );
      expect(fk?.delete_rule).toBe('NO ACTION');
    });

    it('should have notifications.user_id referencing users.id with CASCADE', () => {
      const fk = foreignKeys.find(
        (f) => f.table_name === 'notifications' && f.column_name === 'user_id',
      );
      expect(fk?.foreign_table).toBe('users');
      expect(fk?.foreign_column).toBe('id');
      expect(fk?.delete_rule).toBe('CASCADE');
    });

    it('should have notifications.ticket_id referencing tickets.id with CASCADE', () => {
      const fk = foreignKeys.find(
        (f) =>
          f.table_name === 'notifications' && f.column_name === 'ticket_id',
      );
      expect(fk?.foreign_table).toBe('tickets');
      expect(fk?.foreign_column).toBe('id');
      expect(fk?.delete_rule).toBe('CASCADE');
    });
  });

  describe('Unique constraints', () => {
    let uniqueConstraints: { table_name: string; column_name: string }[];

    beforeAll(async () => {
      const result = await sql<{
        table_name: string;
        column_name: string;
      }>`SELECT tc.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
         WHERE tc.constraint_type = 'UNIQUE'
           AND tc.table_schema = 'public'
         ORDER BY tc.table_name, kcu.column_name`.execute(db);
      uniqueConstraints = result.rows;
    });

    it('should have UNIQUE constraint on users.email', () => {
      const uc = uniqueConstraints.find(
        (u) => u.table_name === 'users' && u.column_name === 'email',
      );
      expect(uc).toBeDefined();
    });

    it('should have UNIQUE constraint on tickets.display_id', () => {
      const uc = uniqueConstraints.find(
        (u) => u.table_name === 'tickets' && u.column_name === 'display_id',
      );
      expect(uc).toBeDefined();
    });
  });

  describe('Indexes', () => {
    let indexes: { indexname: string; tablename: string }[];

    beforeAll(async () => {
      const result = await sql<{
        indexname: string;
        tablename: string;
      }>`SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`.execute(
        db,
      );
      indexes = result.rows;
    });

    it('should have idx_tickets_user_id index', () => {
      const idx = indexes.find((i) => i.indexname === 'idx_tickets_user_id');
      expect(idx).toBeDefined();
      expect(idx?.tablename).toBe('tickets');
    });

    it('should have idx_tickets_status index', () => {
      const idx = indexes.find((i) => i.indexname === 'idx_tickets_status');
      expect(idx).toBeDefined();
      expect(idx?.tablename).toBe('tickets');
    });

    it('should have idx_tickets_priority index', () => {
      const idx = indexes.find((i) => i.indexname === 'idx_tickets_priority');
      expect(idx).toBeDefined();
      expect(idx?.tablename).toBe('tickets');
    });

    it('should have idx_replies_ticket_id index', () => {
      const idx = indexes.find((i) => i.indexname === 'idx_replies_ticket_id');
      expect(idx).toBeDefined();
      expect(idx?.tablename).toBe('replies');
    });

    it('should have idx_notifications_user_id index', () => {
      const idx = indexes.find(
        (i) => i.indexname === 'idx_notifications_user_id',
      );
      expect(idx).toBeDefined();
      expect(idx?.tablename).toBe('notifications');
    });
  });

  describe('Sequence: ticket_display_id_seq', () => {
    it('should have created the ticket_display_id_seq sequence', async () => {
      const result = await sql<{
        exists: boolean;
      }>`SELECT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'ticket_display_id_seq')`.execute(
        db,
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should generate TK-0001 format display IDs', async () => {
      const user = await db
        .insertInto('users')
        .values({
          email: 'seq-test@example.com',
          name: 'Seq Test',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const ticket = await db
        .insertInto('tickets')
        .values({
          user_id: user.id,
          email: user.email,
          name: user.name,
          product_id: 1,
          product_name: 'Test Product',
          subject: 'Test',
          message: 'Test message',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      expect(ticket.display_id).toMatch(/^TK-\d{4,}$/);

      await db.deleteFrom('tickets').where('id', '=', ticket.id).execute();
      await db.deleteFrom('users').where('id', '=', user.id).execute();
    });

    it('should auto-increment display IDs sequentially', async () => {
      const user = await db
        .insertInto('users')
        .values({
          email: 'seq-test-2@example.com',
          name: 'Seq Test 2',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const ticket1 = await db
        .insertInto('tickets')
        .values({
          user_id: user.id,
          email: user.email,
          name: user.name,
          product_id: 1,
          product_name: 'Product A',
          subject: 'First',
          message: 'First ticket',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const ticket2 = await db
        .insertInto('tickets')
        .values({
          user_id: user.id,
          email: user.email,
          name: user.name,
          product_id: 2,
          product_name: 'Product B',
          subject: 'Second',
          message: 'Second ticket',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const num1 = parseInt(ticket1.display_id.replace('TK-', ''), 10);
      const num2 = parseInt(ticket2.display_id.replace('TK-', ''), 10);
      expect(num2).toBe(num1 + 1);

      await db.deleteFrom('tickets').where('user_id', '=', user.id).execute();
      await db.deleteFrom('users').where('id', '=', user.id).execute();
    });
  });

  describe('Default values', () => {
    let userId: string;
    let ticketId: string;

    beforeAll(async () => {
      const user = await db
        .insertInto('users')
        .values({
          email: 'defaults-test@example.com',
          name: 'Defaults Test',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      userId = user.id;

      const ticket = await db
        .insertInto('tickets')
        .values({
          user_id: userId,
          email: user.email,
          name: user.name,
          product_id: 1,
          product_name: 'Default Product',
          subject: 'Test defaults',
          message: 'Testing default values',
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      ticketId = ticket.id;
    });

    afterAll(async () => {
      await db
        .deleteFrom('notifications')
        .where('user_id', '=', userId)
        .execute();
      await db.deleteFrom('tickets').where('id', '=', ticketId).execute();
      await db.deleteFrom('users').where('id', '=', userId).execute();
    });

    it('should default user role to customer', async () => {
      const user = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      expect(user.role).toBe('customer');
    });

    it('should generate UUID for user id', async () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      expect(userId).toMatch(uuidRegex);
    });

    it('should set created_at timestamp for user', async () => {
      const user = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      expect(user.created_at).toBeInstanceOf(Date);
    });

    it('should set updated_at timestamp for user', async () => {
      const user = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      expect(user.updated_at).toBeInstanceOf(Date);
    });

    it('should default ticket status to open', async () => {
      const ticket = await db
        .selectFrom('tickets')
        .selectAll()
        .where('id', '=', ticketId)
        .executeTakeFirstOrThrow();
      expect(ticket.status).toBe('open');
    });

    it('should default ticket priority to medium', async () => {
      const ticket = await db
        .selectFrom('tickets')
        .selectAll()
        .where('id', '=', ticketId)
        .executeTakeFirstOrThrow();
      expect(ticket.priority).toBe('medium');
    });

    it('should default notification read to false', async () => {
      const notification = await db
        .insertInto('notifications')
        .values({
          user_id: userId,
          type: 'new_ticket',
          ticket_id: ticketId,
          message: 'Test notification',
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      expect(notification.read).toBe(false);

      await db
        .deleteFrom('notifications')
        .where('id', '=', notification.id)
        .execute();
    });
  });

  describe('NOT NULL constraints', () => {
    it('should reject user insert without email', async () => {
      await expect(
        sql`INSERT INTO users (name, password) VALUES ('Test', 'hashed')`.execute(
          db,
        ),
      ).rejects.toThrow();
    });

    it('should reject user insert without name', async () => {
      await expect(
        sql`INSERT INTO users (email, password) VALUES ('test@null.com', 'hashed')`.execute(
          db,
        ),
      ).rejects.toThrow();
    });

    it('should reject user insert without password', async () => {
      await expect(
        sql`INSERT INTO users (email, name) VALUES ('test@null.com', 'Test')`.execute(
          db,
        ),
      ).rejects.toThrow();
    });

    it('should reject ticket insert without subject', async () => {
      await expect(
        sql`INSERT INTO tickets (user_id, email, name, product_id, product_name, message)
            VALUES (gen_random_uuid(), 'a@b.com', 'Test', 1, 'Product', 'Msg')`.execute(
          db,
        ),
      ).rejects.toThrow();
    });

    it('should reject ticket insert without message', async () => {
      await expect(
        sql`INSERT INTO tickets (user_id, email, name, product_id, product_name, subject)
            VALUES (gen_random_uuid(), 'a@b.com', 'Test', 1, 'Product', 'Subject')`.execute(
          db,
        ),
      ).rejects.toThrow();
    });

    it('should reject notification insert without message', async () => {
      await expect(
        sql`INSERT INTO notifications (user_id, type, ticket_id)
            VALUES (gen_random_uuid(), 'new_ticket', gen_random_uuid())`.execute(
          db,
        ),
      ).rejects.toThrow();
    });
  });

  describe('UNIQUE constraint enforcement', () => {
    it('should reject duplicate user email', async () => {
      const user = await db
        .insertInto('users')
        .values({
          email: 'unique-test@example.com',
          name: 'Unique Test',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await expect(
        db
          .insertInto('users')
          .values({
            email: 'unique-test@example.com',
            name: 'Duplicate',
            password: 'hashed',
          })
          .execute(),
      ).rejects.toThrow();

      await db.deleteFrom('users').where('id', '=', user.id).execute();
    });
  });

  describe('CASCADE delete behavior', () => {
    it('should cascade delete replies when ticket is deleted', async () => {
      const user = await db
        .insertInto('users')
        .values({
          email: 'cascade-reply@example.com',
          name: 'Cascade Test',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const ticket = await db
        .insertInto('tickets')
        .values({
          user_id: user.id,
          email: user.email,
          name: user.name,
          product_id: 1,
          product_name: 'Product',
          subject: 'Cascade test',
          message: 'Testing cascade',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await db
        .insertInto('replies')
        .values({
          ticket_id: ticket.id,
          user_id: user.id,
          author_type: 'customer',
          message: 'Reply to be cascaded',
        })
        .execute();

      await db.deleteFrom('tickets').where('id', '=', ticket.id).execute();

      const replies = await db
        .selectFrom('replies')
        .selectAll()
        .where('ticket_id', '=', ticket.id)
        .execute();
      expect(replies).toHaveLength(0);

      await db.deleteFrom('users').where('id', '=', user.id).execute();
    });

    it('should cascade delete notifications when ticket is deleted', async () => {
      const user = await db
        .insertInto('users')
        .values({
          email: 'cascade-notif-ticket@example.com',
          name: 'Cascade Notif',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const ticket = await db
        .insertInto('tickets')
        .values({
          user_id: user.id,
          email: user.email,
          name: user.name,
          product_id: 1,
          product_name: 'Product',
          subject: 'Cascade notification test',
          message: 'Testing cascade',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await db
        .insertInto('notifications')
        .values({
          user_id: user.id,
          type: 'new_ticket',
          ticket_id: ticket.id,
          message: 'Notification to be cascaded',
        })
        .execute();

      await db.deleteFrom('tickets').where('id', '=', ticket.id).execute();

      const notifications = await db
        .selectFrom('notifications')
        .selectAll()
        .where('ticket_id', '=', ticket.id)
        .execute();
      expect(notifications).toHaveLength(0);

      await db.deleteFrom('users').where('id', '=', user.id).execute();
    });

    it('should cascade delete notifications when user is deleted', async () => {
      const user = await db
        .insertInto('users')
        .values({
          email: 'cascade-notif-user@example.com',
          name: 'Cascade User Notif',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const ticket = await db
        .insertInto('tickets')
        .values({
          user_id: user.id,
          email: user.email,
          name: user.name,
          product_id: 1,
          product_name: 'Product',
          subject: 'User cascade test',
          message: 'Testing user cascade',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await db
        .insertInto('notifications')
        .values({
          user_id: user.id,
          type: 'new_reply',
          ticket_id: ticket.id,
          message: 'Notification for cascade user test',
        })
        .execute();

      // Must delete ticket first (no cascade on tickets.user_id)
      await db.deleteFrom('tickets').where('id', '=', ticket.id).execute();
      await db.deleteFrom('users').where('id', '=', user.id).execute();

      const notifications = await db
        .selectFrom('notifications')
        .selectAll()
        .where('user_id', '=', user.id)
        .execute();
      expect(notifications).toHaveLength(0);
    });
  });

  describe('RESTRICT delete behavior (no cascade)', () => {
    it('should prevent deleting a user who has tickets', async () => {
      const user = await db
        .insertInto('users')
        .values({
          email: 'restrict-test@example.com',
          name: 'Restrict Test',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const ticket = await db
        .insertInto('tickets')
        .values({
          user_id: user.id,
          email: user.email,
          name: user.name,
          product_id: 1,
          product_name: 'Product',
          subject: 'Restrict test',
          message: 'Testing restrict',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await expect(
        db.deleteFrom('users').where('id', '=', user.id).execute(),
      ).rejects.toThrow();

      await db.deleteFrom('tickets').where('id', '=', ticket.id).execute();
      await db.deleteFrom('users').where('id', '=', user.id).execute();
    });

    it('should prevent deleting a user who has replies', async () => {
      const user1 = await db
        .insertInto('users')
        .values({
          email: 'restrict-reply-owner@example.com',
          name: 'Ticket Owner',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const user2 = await db
        .insertInto('users')
        .values({
          email: 'restrict-reply-agent@example.com',
          name: 'Agent',
          password: 'hashed',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const ticket = await db
        .insertInto('tickets')
        .values({
          user_id: user1.id,
          email: user1.email,
          name: user1.name,
          product_id: 1,
          product_name: 'Product',
          subject: 'Restrict reply test',
          message: 'Testing restrict on replies',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await db
        .insertInto('replies')
        .values({
          ticket_id: ticket.id,
          user_id: user2.id,
          author_type: 'agent',
          message: 'Agent reply',
        })
        .execute();

      await expect(
        db.deleteFrom('users').where('id', '=', user2.id).execute(),
      ).rejects.toThrow();

      // Cleanup in correct order
      await db
        .deleteFrom('replies')
        .where('ticket_id', '=', ticket.id)
        .execute();
      await db.deleteFrom('tickets').where('id', '=', ticket.id).execute();
      await db.deleteFrom('users').where('id', '=', user1.id).execute();
      await db.deleteFrom('users').where('id', '=', user2.id).execute();
    });
  });

  describe('Down migration', () => {
    it('should export up and down functions', async () => {
      const migration = await import('../src/db/migrations/001_initial_schema');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });
  });

  describe('Kysely migration tracking', () => {
    it('should have recorded the migration in kysely_migration table', async () => {
      const result = await sql<{
        name: string;
      }>`SELECT name FROM kysely_migration ORDER BY name`.execute(db);
      const migrationNames = result.rows.map((r) => r.name);
      expect(migrationNames).toContain('001_initial_schema');
    });
  });
});
