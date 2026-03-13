import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors';

export interface AuthToken {
  userID: number;
  token: string;
}

interface UserRecord {
  userID: number;
  email: string;
  passwordHash: string;
}

// Temporary in-memory user store for MVP.
// Replace with Supabase-backed implementation later.
const users: UserRecord[] = [
  {
    userID: 1,
    email: 'admin@example.com',
    passwordHash: hashPassword('Password123'),
  },
];

function hashPassword(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function login(email: string, password: string): AuthToken {
  if (!email || !password) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Email and password are required.',
      400
    );
  }

  if (!isValidEmail(email) || !isValidPassword(password)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Email or password format is invalid.',
      400
    );
  }

  const passwordHash = hashPassword(password);
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === passwordHash
  );

  if (!user) {
    throw new AppError(
      'INVALID_CREDENTIALS',
      'Email does not exist or password is incorrect.',
      401
    );
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(
      'SERVER_MISCONFIGURED',
      'Authentication is temporarily unavailable.',
      500
    );
  }

  const token = jwt.sign(
    { userID: user.userID },
    secret,
    { expiresIn: '1h' }
  );

  return {
    userID: user.userID,
    token,
  };
}

