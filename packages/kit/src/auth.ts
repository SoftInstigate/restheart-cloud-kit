import type { AuthConfig, UserInfo, TokenInfo } from './types.js';
import { apiFetch } from './client.js';

export async function register(
  config: AuthConfig,
  payload: {
    email: string;
    password: string;
    teamName: string;
    firstName?: string;
    lastName?: string;
  }
): Promise<void> {
  await apiFetch(config, '/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verify(config: AuthConfig, email: string, token: string): Promise<void> {
  await apiFetch(
    config,
    `/auth/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
  );
}

async function fetchUserInfo(config: AuthConfig): Promise<UserInfo> {
  const tokenRes = await apiFetch(config, '/token');
  const { username } = await tokenRes.json() as TokenInfo;
  const userRes = await apiFetch(config, `/users/${encodeURIComponent(username)}`);
  return userRes.json() as Promise<UserInfo>;
}

export async function login(
  config: AuthConfig,
  email: string,
  password: string
): Promise<UserInfo> {
  const credentials = btoa(`${email}:${password}`);
  await apiFetch(config, '/token/cookie', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
  });
  return fetchUserInfo(config);
}

export async function logout(config: AuthConfig): Promise<void> {
  await apiFetch(config, '/logout', { method: 'POST' });
}

export async function checkSession(config: AuthConfig): Promise<UserInfo | null> {
  try {
    return await fetchUserInfo(config);
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status === 401 || e?.status === 403) return null;
    throw err;
  }
}
