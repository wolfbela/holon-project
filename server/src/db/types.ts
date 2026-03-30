import { ColumnType, Generated } from 'kysely';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string;
  password: string;
  role: ColumnType<string, string | undefined, string>;
  created_at: ColumnType<Date, Date | undefined, Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface TicketsTable {
  id: Generated<string>;
  display_id: Generated<string>;
  user_id: string;
  email: string;
  name: string;
  product_id: number;
  product_name: string;
  subject: string;
  message: string;
  status: ColumnType<string, string | undefined, string>;
  priority: ColumnType<string, string | undefined, string>;
  created_at: ColumnType<Date, Date | undefined, Date>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface RepliesTable {
  id: Generated<string>;
  ticket_id: string;
  user_id: string;
  author_type: string;
  message: string;
  created_at: ColumnType<Date, Date | undefined, Date>;
}

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  type: string;
  ticket_id: string;
  message: string;
  read: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, Date | undefined, Date>;
}

export interface Database {
  users: UsersTable;
  tickets: TicketsTable;
  replies: RepliesTable;
  notifications: NotificationsTable;
}
