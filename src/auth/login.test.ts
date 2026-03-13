import request from 'supertest';
import app from '../server';

interface LoginResponseBody {
  success: boolean;
  message: string;
  data: {
    userID: number;
    token: string;
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

function postLogin(email: string, password: string) {
  return request(app)
    .post('/auth/login')
    .send({ email, password })
    .set('Content-Type', 'application/json');
}

describe('POST /auth/login', () => {
  test('returns 200 and token for valid credentials', async () => {
    const res = await postLogin('admin@example.com', 'Password123');
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).not.toBeNull();
    expect(body.data?.userID).toBe(1);
    expect(typeof body.data?.token).toBe('string');
    expect(body.error).toBeNull();
  });

  test('treats email comparison as case-insensitive', async () => {
    const res = await postLogin('ADMIN@EXAMPLE.COM', 'Password123');
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.userID).toBe(1);
  });

  test('returns 400 for missing email or password', async () => {
    const res1 = await postLogin('', 'Password123');
    const res2 = await postLogin('admin@example.com', '');

    const body1 = res1.body as LoginResponseBody;
    const body2 = res2.body as LoginResponseBody;

    expect(res1.status).toBe(400);
    expect(body1.success).toBe(false);
    expect(body1.error?.code).toBe('VALIDATION_ERROR');

    expect(res2.status).toBe(400);
    expect(body2.success).toBe(false);
    expect(body2.error?.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for invalid email format', async () => {
    const res = await postLogin('not-an-email', 'Password123');
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for too-short password', async () => {
    const res = await postLogin('admin@example.com', 'short');
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  test('returns 401 for incorrect password', async () => {
    const res = await postLogin('admin@example.com', 'WrongPass123');
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  test('returns 401 for non-existent user', async () => {
    const res = await postLogin('idontexist@example.com', 'Password123');
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  test('handles very long password input safely', async () => {
    const longPassword = 'a'.repeat(1000);
    const res = await postLogin('admin@example.com', longPassword);
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  test('handles SQL injection-like email safely', async () => {
    const res = await postLogin("admin@example.com' OR '1'='1", 'Password123');
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  test('multiple successful logins return different tokens', async () => {
    const res1 = await postLogin('admin@example.com', 'Password123');
    const res2 = await postLogin('admin@example.com', 'Password123');

    const token1 = (res1.body as LoginResponseBody).data?.token;
    const token2 = (res2.body as LoginResponseBody).data?.token;

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(typeof token1).toBe('string');
    expect(typeof token2).toBe('string');
  });

  test('falls back to 500 when JWT secret is empty', async () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = '';

    const res = await postLogin('admin@example.com', 'Password123');
    const body = res.body as LoginResponseBody;

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('SERVER_MISCONFIGURED');

    if (original !== undefined) {
      process.env.JWT_SECRET = original;
    } else {
      delete process.env.JWT_SECRET;
    }
  });
});

