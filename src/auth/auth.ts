import bcrypt from 'bcrypt';
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
    passwordHash: bcrypt.hashSync('Password123', 10),
  },
];

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

export function resetPassword(
  email: string,
  newPassword: string,
  passwordConfirm: string
): void {
  if (!email || !newPassword || !passwordConfirm) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Email, newPassword and passwordConfirm are required.',
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

  if (!isValidPassword(newPassword)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Password must be at least 8 characters long.',
      400
    );
  }

  if (newPassword !== passwordConfirm) {
    throw new AppError(
      'VALIDATION_ERROR',
      'newPassword and passwordConfirm must match.',
      400
    );
  }

  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    throw new AppError(
      'USER_NOT_FOUND',
      'No user exists with this email.',
      404
    );
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
}


