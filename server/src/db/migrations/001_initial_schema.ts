import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE SEQUENCE ticket_display_id_seq START 1`.execute(db);

  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('password', 'varchar(255)', (col) => col.notNull())
    .addColumn('role', 'varchar(20)', (col) =>
      col.notNull().defaultTo('customer'),
    )
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createTable('tickets')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('display_id', 'varchar(20)', (col) =>
      col
        .unique()
        .notNull()
        .defaultTo(
          sql`'TK-' || LPAD(nextval('ticket_display_id_seq')::TEXT, 4, '0')`,
        ),
    )
    .addColumn('user_id', 'uuid', (col) => col.references('users.id').notNull())
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('product_id', 'integer', (col) => col.notNull())
    .addColumn('product_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('subject', 'varchar(255)', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) =>
      col.notNull().defaultTo('open'),
    )
    .addColumn('priority', 'varchar(20)', (col) =>
      col.notNull().defaultTo('medium'),
    )
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createTable('replies')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('ticket_id', 'uuid', (col) =>
      col.references('tickets.id').onDelete('cascade').notNull(),
    )
    .addColumn('user_id', 'uuid', (col) => col.references('users.id').notNull())
    .addColumn('author_type', 'varchar(20)', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createTable('notifications')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('type', 'varchar(30)', (col) => col.notNull())
    .addColumn('ticket_id', 'uuid', (col) =>
      col.references('tickets.id').onDelete('cascade').notNull(),
    )
    .addColumn('message', 'varchar(500)', (col) => col.notNull())
    .addColumn('read', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createIndex('idx_tickets_user_id')
    .on('tickets')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_tickets_status')
    .on('tickets')
    .column('status')
    .execute();

  await db.schema
    .createIndex('idx_tickets_priority')
    .on('tickets')
    .column('priority')
    .execute();

  await db.schema
    .createIndex('idx_replies_ticket_id')
    .on('replies')
    .column('ticket_id')
    .execute();

  await db.schema
    .createIndex('idx_notifications_user_id')
    .on('notifications')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('notifications').execute();
  await db.schema.dropTable('replies').execute();
  await db.schema.dropTable('tickets').execute();
  await db.schema.dropTable('users').execute();
  await sql`DROP SEQUENCE IF EXISTS ticket_display_id_seq`.execute(db);
}
