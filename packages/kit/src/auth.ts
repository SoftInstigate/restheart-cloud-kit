import type { AuthConfig, UserInfo } from './types.js';
import { apiFetch } from './client.js';

export async function register(
  config: AuthConfig,
  payload: {
    email: string;
    password: string;
    orgName: string;
    firstName?: string;
    lastName?: string;
  }
): Promise<void> {
  await apiFetch(config, '/restheart-accounts/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verify(config: AuthConfig, email: string, token: string): Promise<void> {
  await apiFetch(config, `/restheart-accounts/users/${encodeURIComponent(email)}/verify`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function login(
  config: AuthConfig,
  email: string,
  password: string
): Promise<UserInfo> {
  const res = await apiFetch(config, '/restheart-accounts/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.json() as Promise<UserInfo>;
}

export async function logout(config: AuthConfig): Promise<void> {
  await apiFetch(config, '/restheart-accounts/logout', { method: 'POST' });
}

export async function checkSession(config: AuthConfig): Promise<UserInfo | null> {
  try {
    const res = await apiFetch(config, '/restheart-accounts/session');
    return res.json() as Promise<UserInfo>;
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status === 401 || e?.status === 403) return null;
    throw err;
  }
}
