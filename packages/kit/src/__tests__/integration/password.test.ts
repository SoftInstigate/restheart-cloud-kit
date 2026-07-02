import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, verify, login, clearToken } from '../../index';
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
  await fetch(`${config.apiBaseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}`);
});

afterAll(async () => {
  clearToken();
  await deleteUser(email);
});

describe('password reset', () => {
  it('forgotPassword returns without error', async () => {
    await expect(forgotPassword(config, email)).resolves.toBeUndefined();
  });

  it('resetPassword applies the new password', async () => {
    const token = await readPasswordResetToken(email);
    await expect(resetPassword(config, { email, token, password: newPassword })).resolves.toBeUndefined();
  });

  it('login works with the new password', async () => {
    const user = await login(config, email, newPassword);
    expect(user._id).toBeTruthy();
  });
});
