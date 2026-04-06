import request from 'supertest';
import app from '../app';
import * as emailModule from './email';

jest.mock('./email', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

interface StandardResponseBody {
  success: boolean;
  message: string;
  data: { userID?: number; token?: string } | null;
  error: { code: string; message: string } | null;
}

const TEST_EMAIL = 'admin@example.com';
const INITIAL_PASSWORD = 'Password123';
const NEW_PASSWORD = 'NewPassword1';

async function getResetToken(email: string): Promise<string> {
  (emailModule.sendPasswordResetEmail as jest.Mock).mockClear();
  await request(app)
    .post('/auth/forgot-password')
    .send({ email })
    .set('Content-Type', 'application/json');
  const calls = (emailModule.sendPasswordResetEmail as jest.Mock).mock.calls;
  return calls[0][1] as string;
}

function postResetPassword(token: string, newPassword: string) {
  return request(app)
    .post('/auth/reset-password')
    .send({ token, newPassword })
    .set('Content-Type', 'application/json');
}

describe('POST /auth/reset-password', () => {
  let originalJwtSecret: string | undefined;

  beforeAll(() => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-jwt-secret-for-reset-password-32ch';
  });

  afterAll(() => {
    if (originalJwtSecret !== undefined) {
      process.env.JWT_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  beforeEach(() => {
    (emailModule.sendPasswordResetEmail as jest.Mock).mockClear();
  });

  test('returns 200 and allows login with new password after valid token', async () => {
    const token = await getResetToken(TEST_EMAIL);

    const resetRes = await postResetPassword(token, NEW_PASSWORD);
    const resetBody = resetRes.body as StandardResponseBody;

    expect(resetRes.status).toBe(200);
    expect(resetBody.success).toBe(true);
    expect(resetBody.error).toBeNull();

    // Login with the new password should succeed
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: NEW_PASSWORD })
      .set('Content-Type', 'application/json');
    expect(loginRes.status).toBe(200);

    // Restore password for subsequent tests
    const restoreToken = await getResetToken(TEST_EMAIL);
    await postResetPassword(restoreToken, INITIAL_PASSWORD);
  });

  test('returns 400 for an invalid token', async () => {
    const res = await postResetPassword('not-a-valid-token', NEW_PASSWORD);
    const body = res.body as StandardResponseBody;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_RESET_TOKEN');
  });

  test('returns 400 if a token is used a second time (one-time use)', async () => {
    const token = await getResetToken(TEST_EMAIL);

    await postResetPassword(token, NEW_PASSWORD);

    const secondRes = await postResetPassword(token, 'AnotherPass1');
    const secondBody = secondRes.body as StandardResponseBody;

    expect(secondRes.status).toBe(400);
    expect(secondBody.error?.code).toBe('INVALID_RESET_TOKEN');

    const restoreToken = await getResetToken(TEST_EMAIL);
    await postResetPassword(restoreToken, INITIAL_PASSWORD);
  });

  test('returns 400 for a password that is too short', async () => {
    const token = await getResetToken(TEST_EMAIL);

    const res = await postResetPassword(token, 'short');
    const body = res.body as StandardResponseBody;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');

    await postResetPassword(token, INITIAL_PASSWORD);
  });

  test('returns 400 for a missing token', async () => {
    const res = await postResetPassword('', NEW_PASSWORD);
    const body = res.body as StandardResponseBody;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_RESET_TOKEN');
  });
});
