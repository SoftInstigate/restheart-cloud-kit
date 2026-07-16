import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { register, verify, login, clearToken, getToken } from '../../index';
import { forgotPassword, resetPassword } from '../../password';
import {
  getConfig, testEmail,
  readVerificationToken, readPasswordResetToken, deleteUser,
} from './helpers';

const config   = getConfig();
const email    = testEmail('password');
const password = 'Test-Password-99!';
const newPassword = 'NewTest-Password-88!';

beforeAll(async () => {
  await register(config, { email, password, teamName: 'PwdOrg', firstName: 'Test', lastName: 'User' });
  const token = await readVerificationToken(email);
  await fetch(`${config.apiBaseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}&delivery=cookie`);
});

afterAll(async () => {
  clearToken();
  await deleteUser(email);
});

describe('password reset', () => {
  it('forgotPassword returns without error', async () => {
    await expect(forgotPassword(config, email)).resolves.toBeUndefined();
  });

  it('resetPassword in bearer mode obtains token with a single request (no POST /token fallback)', async () => {
    const token = await readPasswordResetToken(email);
    clearToken();

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const tokenCallsBefore = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/token') && !url.includes('/token/cookie')
    ).length;

    await resetPassword(config, { email, token, password: newPassword });

    const tokenCallsAfter = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/token') && !url.includes('/token/cookie')
    ).length;

    // No additional /token call should have been made after resetPassword
    expect(tokenCallsAfter - tokenCallsBefore).toBe(0);

    // A token should now be stored
    expect(getToken()).toBeTruthy();

    fetchSpy.mockRestore();
  });

  it('resetPassword in cookie mode does not expose a token', async () => {
    // Trigger another password reset for cookie-mode test
    await forgotPassword(config, email);
    const token = await readPasswordResetToken(email);
    clearToken();

    const cookieNewPassword = 'Cookie-Test-77!';
    await resetPassword(config, { email, token, password: cookieNewPassword }, 'cookie');

    // Cookie mode should NOT store a bearer token
    expect(getToken()).toBeNull();
  });

  it('login works with the new password', async () => {
    clearToken();
    // The last password set was by the cookie-mode test
    const user = await login(config, email, 'Cookie-Test-77!');
    expect(user._id).toBeTruthy();
  });
});
