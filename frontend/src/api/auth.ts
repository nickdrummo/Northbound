const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface AuthResponse {
  userID: number;
  token: string;
}

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: { code: string; message: string } | null;
}

async function authFetch<T>(
  endpoint: string,
  body: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json: ApiResult<T> = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? json.message ?? 'Request failed');
  }

  return json.data as T;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return authFetch<AuthResponse>('/auth/login', { email, password });
}

export function register(
  email: string,
  password: string,
  passwordConfirm: string,
): Promise<AuthResponse> {
  return authFetch<AuthResponse>('/auth/register', {
    email,
    password,
    passwordConfirm,
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await authFetch<null>('/auth/forgot-password', { email });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await authFetch<null>('/auth/reset-password', { token, newPassword });
}

export async function logoutApi(token: string): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch {
    // Best-effort — local state is cleared regardless
  }
}
