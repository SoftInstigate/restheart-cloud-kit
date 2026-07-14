import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, verify, buildVerifyUrl, login, logout, checkSession, clearToken } from '../../index';
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

  it('verify returns the fragment delivery URL by default', async () => {
    const token = await readVerificationToken(email);
    const url = await verify(config, email, token);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/auth/verify');
    expect(parsed.searchParams.get('delivery')).toBe('fragment');
    expect(parsed.searchParams.get('email')).toBe(email);
    expect(parsed.searchParams.get('token')).toBe(token);
  });

  it('verify returns cookie delivery URL when requested', async () => {
    const token = await readVerificationToken(email);
    const url = await verify(config, email, token, 'cookie');
    const parsed = new URL(url);
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
