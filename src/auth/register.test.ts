import request from 'supertest';
import app from '../app'

interface AuthResponseBody {
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

function postRegister(
  email: string,
  password: string,
  passwordConfirm: string
) {
  return request(app)
    .post('/auth/register')
    .send({ email, password, passwordConfirm })
    .set('Content-Type', 'application/json');
}

describe('POST /auth/register', () => {
  // ❌ INVALID EMAIL TESTS
  describe('Invalid email validation', () => {
    test('Email without @ symbol', async () => {
      const res = await postRegister(
        'invalidemail.com',
        'Password123',
        'Password123'
      );
      const body = res.body as AuthResponseBody;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    test('Empty email', async () => {
      const res = await postRegister('', 'Password123', 'Password123');
      const body = res.body as AuthResponseBody;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  // ❌ INVALID PASSWORD TESTS
  describe('Invalid password validation', () => {
    test('Password too short', async () => {
      const res = await postRegister(
        'user@example.com',
        'short',
        'short'
      );
      const body = res.body as AuthResponseBody;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    test('Password and confirm do not match', async () => {
      const res = await postRegister(
        'user@example.com',
        'Password123',
        'Different123'
      );
      const body = res.body as AuthResponseBody;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    test('Missing password fields', async () => {
      const res = await postRegister(
        'user@example.com',
        '',
        ''
      );
      const body = res.body as AuthResponseBody;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  // 🔄 EDGE CASES
  describe('Duplicate email and trimming behaviour', () => {
    test('Duplicate email entered returns EMAIL_ALREADY_REGISTERED', async () => {
      const first = await postRegister(
        'duplicate@example.com',
        'Password123',
        'Password123'
      );
      expect(first.status).toBe(201);

      const res = await postRegister(
        'duplicate@example.com',
        'AnotherPass123',
        'AnotherPass123'
      );
      const body = res.body as AuthResponseBody;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    test('Email with different case is considered duplicate', async () => {
      const first = await postRegister(
        'case@example.com',
        'Password123',
        'Password123'
      );
      expect(first.status).toBe(201);

      const res = await postRegister(
        'CASE@EXAMPLE.COM',
        'Password123',
        'Password123'
      );
      const body = res.body as AuthResponseBody;

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe('EMAIL_ALREADY_REGISTERED');
    });
  });

  // ✅ SUCCESS CASES
  describe('Successful registration', () => {
    test('Registers a new user and returns token', async () => {
      const res = await postRegister(
        'newuser@example.com',
        'Password123',
        'Password123'
      );
      const body = res.body as AuthResponseBody;

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data).not.toBeNull();
      expect(typeof body.data?.userID).toBe('number');
      expect(typeof body.data?.token).toBe('string');
      expect(body.error).toBeNull();
    });

    test('Registration allows immediate login', async () => {
      const email = 'immediate.login@example.com';
      const password = 'Password123';

      const registerRes = await postRegister(
        email,
        password,
        password
      );
      const registerBody = registerRes.body as AuthResponseBody;

      expect(registerRes.status).toBe(201);
      expect(registerBody.success).toBe(true);
      expect(registerBody.data?.userID).toBeGreaterThanOrEqual(1);

      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email, password })
        .set('Content-Type', 'application/json');

      expect(loginRes.status).toBe(200);
      const loginBody = loginRes.body as AuthResponseBody;
      expect(loginBody.success).toBe(true);
      expect(typeof loginBody.data?.token).toBe('string');
    });
  });
});

