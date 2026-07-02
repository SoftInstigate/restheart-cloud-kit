import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, verify, login, logout, checkSession, clearToken } from '../../index';
import {
  getConfig, testEmail,
  readVerificationToken, deleteUser,
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

  it('verify activates the account', async () => {
    const token = await readVerificationToken(email);
    // GET /auth/verify → 302 to frontend (cross-origin, not followed by fetch)
    const res = await fetch(`${config.apiBaseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}`);
    // accept 302 (redirect to frontend) or 2xx (if frontend-app-url is same origin)
    expect(res.status === 302 || res.ok || res.redirected).toBe(true);
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
