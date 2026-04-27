import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors';
import { sendPasswordResetEmail } from './email';

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
    passwordHash: bcrypt.hashSync('Password123', 10),
  },
];

const resetTokens = new Map<string, { userID: number; expiresAt: Date }>();
// token -> expiresAt timestamp (ms)
const revokedTokens = new Map<string, number>();

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function register(
  email: string,
  password: string,
  passwordConfirm: string
): AuthToken {
  if (!email || !password || !passwordConfirm) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Email, password and passwordConfirm are required.',
      400
    );
  }

  if (!isValidEmail(email)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Email format is invalid.',
      400
    );
  }

  if (!isValidPassword(password)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Password must be at least 8 characters long.',
      400
    );
  }

  if (password !== passwordConfirm) {
    throw new AppError(
      'VALIDATION_ERROR',
      'password and passwordConfirm must match.',
      400
    );
  }

  const existing = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    throw new AppError(
      'EMAIL_ALREADY_REGISTERED',
      'An account with this email already exists.',
      400
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

  const passwordHash = bcrypt.hashSync(password, 10);

  const newUser: UserRecord = {
    userID: users.length + 1,
    email,
    passwordHash,
  };
  users.push(newUser);

  const token = jwt.sign(
    {
      userID: newUser.userID,
      issuedAt: Date.now(),
    },
    secret,
    { expiresIn: '1h' }
  );

  return {
    userID: newUser.userID,
    token,
  };
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

  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    throw new AppError(
      'INVALID_CREDENTIALS',
      'Email does not exist or password is incorrect.',
      401
    );
  }

  const matches = bcrypt.compareSync(password, user.passwordHash);
  if (!matches) {
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
    {
      userID: user.userID,
      issuedAt: Date.now(),
    },
    secret,
    { expiresIn: '1h' }
  );

  return {
    userID: user.userID,
    token,
  };

}

export async function forgotPassword(email: string): Promise<void> {
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return; // silent — prevents user enumeration
  const token = randomBytes(32).toString('hex');
  resetTokens.set(token, { userID: user.userID, expiresAt: new Date(Date.now() + 3_600_000) });
  try {
    await sendPasswordResetEmail(user.email, token);
  } catch (err) {
    console.error('Failed to send password reset email:', err);
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const entry = resetTokens.get(token);
  if (!entry || entry.expiresAt < new Date()) {
    resetTokens.delete(token);
    throw new AppError('INVALID_RESET_TOKEN', 'Invalid or expired token.', 400);
  }
  if (newPassword.length < 8) {
    throw new AppError('VALIDATION_ERROR', 'Password must be at least 8 characters long.', 400);
  }
  const user = users.find((u) => u.userID === entry.userID);
  if (!user) {
    resetTokens.delete(token);
    throw new AppError('INVALID_RESET_TOKEN', 'Invalid or expired token.', 400);
  }
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  resetTokens.delete(token); // one-time use
}

export function logout(token: string): void {
  if (!token) {
    throw new AppError(
      'UNAUTHORIZED',
      'Authorization token is required.',
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

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;

    if (typeof payload.exp !== 'number') {
      throw new AppError(
        'UNAUTHORIZED',
        'Invalid or expired token.',
        401
      );
    }

    revokedTokens.set(token, payload.exp * 1000);
  } catch {
    throw new AppError(
      'UNAUTHORIZED',
      'Invalid or expired token.',
      401
    );
  }
}

