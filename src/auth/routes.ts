import express from 'express';
import { login } from './service';
import { AppError, ErrorDetail, fail, ok } from '../errors';

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
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.status;
      const detail: ErrorDetail = {
        code: err.code,
        message: err.message,
      };
      return res.status(status).json(fail(err.message, detail));
    }

    const detail: ErrorDetail = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    };
    return res.status(500).json(fail(detail.message, detail));
  }
});

export default router;

