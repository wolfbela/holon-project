import bcrypt from 'bcrypt';
import { db } from '../db';
import { RegisterInput, User } from '@holon/shared';
import { AppError } from '../utils/AppError';
import { toUser } from './authService';
import { SALT_ROUNDS } from '../config';

export async function listAdminUsers(): Promise<User[]> {
  const rows = await db
    .selectFrom('users')
    .selectAll()
    .where('role', '=', 'admin')
    .orderBy('created_at', 'desc')
    .execute();

  return rows.map(toUser);
}

export async function createAdminUser(input: RegisterInput): Promise<User> {
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', input.email)
    .executeTakeFirst();

  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const row = await db
    .insertInto('users')
    .values({
      email: input.email,
      name: input.name,
      password: hashedPassword,
      role: 'admin',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return toUser(row);
}

export async function deleteAdminUser(
  targetId: string,
  requesterId: string,
): Promise<void> {
  if (targetId === requesterId) {
    throw new AppError('Cannot delete your own account', 400);
  }

  const result = await db
    .deleteFrom('users')
    .where('id', '=', targetId)
    .where('role', '=', 'admin')
    .returning('id')
    .executeTakeFirst();

  if (!result) {
    throw new AppError('Admin user not found', 404);
  }
}
