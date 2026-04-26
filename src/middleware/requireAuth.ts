import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { fail } from '../errors';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(
      fail('Unauthorized', {
        code: 'UNAUTHORIZED',
        message: 'Authorization token is required.',
      })
    );
    return;
  }

  const parts = authHeader.split(' ');
  const token = parts[1];

  if (!token) {
    res.status(401).json(
      fail('Unauthorized', {
        code: 'UNAUTHORIZED',
        message: 'Authorization token is required.',
      })
    );
    return;
  }
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json(
      fail('Server misconfigured', {
        code: 'SERVER_MISCONFIGURED',
        message: 'Authentication is temporarily unavailable.',
      })
    );
    return;
  }

  try {
    jwt.verify(token, secret);
    next();
  } catch (_err) {
    res.status(401).json(
      fail('Unauthorized', {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
      })
    );
  }
}