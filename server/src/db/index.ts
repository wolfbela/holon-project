import dotenv from 'dotenv';
import path from 'path';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './types';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const db = new Kysely<Database>({ dialect });
