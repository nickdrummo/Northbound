import request from 'supertest';
import app from '../app';
import * as emailModule from './email';

jest.mock('./email', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

interface StandardResponseBody {
  success: boolean;
  message: string;
  data: unknown;
  error: { code: string; message: string } | null;
}

function postForgotPassword(email: string) {
  return request(app)
    .post('/auth/forgot-password')
    .send({ email })
    .set('Content-Type', 'application/json');
}

describe('POST /auth/forgot-password', () => {
  beforeEach(() => {
    (emailModule.sendPasswordResetEmail as jest.Mock).mockClear();
  });

  test('returns 200 for a known email and sends reset email', async () => {
    const res = await postForgotPassword('admin@example.com');
    const body = res.body as StandardResponseBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.error).toBeNull();
    expect(emailModule.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(emailModule.sendPasswordResetEmail).toHaveBeenCalledWith(
      'admin@example.com',
      expect.any(String)
    );
  });

  test('returns 200 for an unknown email without sending email (no enumeration)', async () => {
    const res = await postForgotPassword('nobody@example.com');
    const body = res.body as StandardResponseBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.error).toBeNull();
    expect(emailModule.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('treats email comparison as case-insensitive', async () => {
    const res = await postForgotPassword('ADMIN@EXAMPLE.COM');
    const body = res.body as StandardResponseBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(emailModule.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  test('returns 200 for missing email without sending email', async () => {
    const res = await postForgotPassword('');
    const body = res.body as StandardResponseBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(emailModule.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
