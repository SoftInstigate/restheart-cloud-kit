import { describe, it, expect, afterAll } from 'vitest';
import { register, verify, buildVerifyUrl, login, logout, checkSession, clearToken } from '../../index';
import {
  getConfig, testEmail,
  readVerificationToken, deleteUser, adminGet,
} from './helpers';

const config = getConfig();
const email  = testEmail('auth');
const password = 'Test-Password-99!';

afterAll(async () => {
  clearToken();
  try { await deleteUser(email); } catch { /* ignore */ }
});

describe('auth flow', () => {
  it('register creates a new user', async () => {
    await expect(register(config, {
      email,
      password,
      teamName:   'Test Org',
      firstName: 'Test',
      lastName:  'User',
    })).resolves.toBeUndefined();
  });

  it('checkSession returns null before login (no token in memory)', async () => {
    await expect(checkSession(config)).resolves.toBeNull();
  });

  it('verify returns the fragment delivery URL by default', async () => {
    const token = await readVerificationToken(email);
    const url = await verify(config, email, token);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/auth/verify');
    expect(parsed.searchParams.get('delivery')).toBe('fragment');
    expect(parsed.searchParams.get('email')).toBe(email);
    expect(parsed.searchParams.get('token')).toBe(token);
  });

  it('verify with fragment delivery activates the account', async () => {
    const token = await readVerificationToken(email);
    const url = buildVerifyUrl(config, email, token, 'fragment');

    // Follow redirects manually — the backend should 302 to frontend-app-url#access_token=...
    let current = url;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(current, { redirect: 'manual' });
      const location = res.headers.get('Location');
      if (!location) break;
      current = new URL(location, current).toString();
    }

    // The final URL should contain #access_token=... (the backend verified
    // the token and redirected to the frontend with the JWT in the fragment).
    expect(current).toContain('access_token=');

    // Verify the user was activated by the backend (roles changed from
    // $unauthenticated to user) — read directly from the admin API.
    const userDoc = await adminGet<Record<string, unknown>>(
      `/users/${encodeURIComponent(email)}`
    );
    const roles = userDoc['roles'] as string[] | undefined;
    expect(roles).toContain('user');
  });

  it('verify with cookie delivery builds correct URL', async () => {
    // User is already activated — just verify the URL construction
    const url = verify(config, email, 'dummy-token', 'cookie');
    const parsed = new URL(await url);
    expect(parsed.searchParams.get('delivery')).toBe('cookie');
  });

  it('login returns UserInfo and stores the token', async () => {
    clearToken();
    const user = await login(config, email, password);
    expect(user._id).toBeTruthy();
    expect(user.roles).toContain('user');
  });

  it('checkSession returns the authenticated user (token in memory)', async () => {
    const user = await checkSession(config);
    expect(user).not.toBeNull();
    expect(user!._id).toBeTruthy();
  });

  it('logout clears the token', async () => {
    await expect(logout(config)).resolves.toBeUndefined();
  });

  it('checkSession returns null after logout (token cleared)', async () => {
    await expect(checkSession(config)).resolves.toBeNull();
  });
});