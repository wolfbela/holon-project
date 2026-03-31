import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { RegisterInput, LoginInput, User, AuthResponse } from '@holon/shared';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../middleware/auth';
import { SALT_ROUNDS } from '../config';

function generateToken(payload: JwtPayload): string {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function toUser(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as User['role'],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function registerUser(
  input: RegisterInput,
): Promise<AuthResponse> {
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
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const user = toUser(row);
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { token, user };
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const row = await db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', input.email)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('Invalid credentials', 401);
  }

  const valid = await bcrypt.compare(input.password, row.password);
  if (!valid) {
    throw new AppError('Invalid credentials', 401);
  }

  const user = toUser(row);
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { token, user };
}

export async function getCurrentUser(userId: string): Promise<User> {
  const row = await db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('User not found', 404);
  }

  return toUser(row);
}
