import request from 'supertest';
import app from '../app';

interface AuthResponseBody {
  success: boolean;
  message: string;
  data: null;
  error: {
    code: string;
    message: string;
  } | null;
}

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

function postLogout(token?: string) {
  const req = request(app)
    .post('/auth/logout')
    .set('Content-Type', 'application/json');

  if (token !== undefined) {
    req.set('Authorization', `Bearer ${token}`);
  }

  return req;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-key';
});
describe('POST /auth/logout', () => {
  test('returns 200 for valid token', async () => {
    const loginRes = await postLogin('admin@example.com', 'Password123');
    const loginBody = loginRes.body as LoginResponseBody;

    expect(loginRes.status).toBe(200);
    expect(loginBody.data).not.toBeNull();

    const token = loginBody.data!.token;

    const res = await postLogout(token);
    const body = res.body as AuthResponseBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Logout successful.');
    expect(body.data).toBeNull();
    expect(body.error).toBeNull();
  });

  test('returns 401 when Authorization header is missing', async () => {
    const res = await postLogout();
    const body = res.body as AuthResponseBody;

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when Authorization header does not use Bearer scheme', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Token abc123');

    const body = res.body as AuthResponseBody;

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when token is invalid', async () => {
    const res = await postLogout('not-a-real-jwt');
    const body = res.body as AuthResponseBody;

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when token is empty', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer ');

    const body = res.body as AuthResponseBody;

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  test('returns 500 when JWT secret is empty', async () => {
    const loginRes = await postLogin('admin@example.com', 'Password123');
    const loginBody = loginRes.body as LoginResponseBody;

    expect(loginRes.status).toBe(200);
    expect(loginBody.data).not.toBeNull();

    const token = loginBody.data!.token;

    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = '';

    const res = await postLogout(token);
    const body = res.body as AuthResponseBody;

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