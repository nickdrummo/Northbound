import express from 'express';
import { login, register, forgotPassword, resetPassword } from './auth';
import { AppError, type ErrorDetail, fail, ok } from '../errors';

const router = express.Router();

router.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const authToken = login(email ?? '', password ?? '');
    return res.status(200).json(
      ok('Login successful.', {
        userID: authToken.userID,
        token: authToken.token,
      })
    );
  } catch (err: unknown) {
    const appErr = err instanceof AppError ? err : null;
    if (appErr) {
      const detail: ErrorDetail = {
        code: appErr.code,
        message: appErr.message,
      };
      return res.status(appErr.status).json(fail(appErr.message, detail));
    }

    const detail: ErrorDetail = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    };
    return res.status(500).json(fail(detail.message, detail));
  }
});

router.post('/auth/register', (req, res) => {
  try {
    const { email, password, passwordConfirm } = req.body as {
      email?: string;
      password?: string;
      passwordConfirm?: string;
    };

    const authToken = register(
      email ?? '',
      password ?? '',
      passwordConfirm ?? ''
    );

    return res.status(201).json(
      ok('User registered successfully.', {
        userID: authToken.userID,
        token: authToken.token,
      })
    );
  } catch (err: unknown) {
    const appErr = err instanceof AppError ? err : null;
    if (appErr) {
      const detail: ErrorDetail = {
        code: appErr.code,
        message: appErr.message,
      };
      return res.status(appErr.status).json(fail(appErr.message, detail));
    }

    const detail: ErrorDetail = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    };
    return res.status(500).json(fail(detail.message, detail));
  }
});

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    await forgotPassword(email ?? '');
    return res.status(200).json(ok('If that email exists, a reset token has been sent.', null));
  } catch (err: unknown) {
    const appErr = err instanceof AppError ? err : null;
    if (appErr) {
      const detail: ErrorDetail = { code: appErr.code, message: appErr.message };
      return res.status(appErr.status).json(fail(appErr.message, detail));
    }
    const detail: ErrorDetail = { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' };
    return res.status(500).json(fail(detail.message, detail));
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    await resetPassword(token ?? '', newPassword ?? '');
    return res.status(200).json(ok('Password updated successfully.', null));
  } catch (err: unknown) {
    const appErr = err instanceof AppError ? err : null;
    if (appErr) {
      const detail: ErrorDetail = { code: appErr.code, message: appErr.message };
      return res.status(appErr.status).json(fail(appErr.message, detail));
    }
    const detail: ErrorDetail = { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' };
    return res.status(500).json(fail(detail.message, detail));
  }
});

export default router;

