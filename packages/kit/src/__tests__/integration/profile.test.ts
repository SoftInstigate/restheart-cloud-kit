import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, login, logout, clearToken, checkSession } from '../../index';
import { updateProfile, changePassword } from '../../profile';
import {
  getConfig, testEmail,
  readVerificationToken, deleteUser,
} from './helpers';

const config  = getConfig();
const email   = testEmail('profile');
const password = 'Test-Password-99!';

async function registerAndVerify(email: string) {
  await register(config, { email, password, teamName: `Org-${email.slice(0, 8)}`, firstName: 'Alice', lastName: 'Smith' });
  const token = await readVerificationToken(email);
  await fetch(`${config.apiBaseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}&delivery=cookie`);
}

beforeAll(async () => {
  await registerAndVerify(email);
  await login(config, email, password);
});

afterAll(async () => {
  clearToken();
  await deleteUser(email);
});

// ── updateProfile ────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  it('updates firstName and lastName', async () => {
    await expect(updateProfile(config, { firstName: 'Bob', lastName: 'Jones' })).resolves.toBeUndefined();
  });

  it('persists across checkSession', async () => {
    const user = await checkSession(config);
    expect(user).not.toBeNull();
    expect(user!.profile?.name).toBe('Bob');
    expect(user!.profile?.surname).toBe('Jones');
  });

  it('partial update — only firstName', async () => {
    await expect(updateProfile(config, { firstName: 'Carol' })).resolves.toBeUndefined();
    const user = await checkSession(config);
    expect(user!.profile?.name).toBe('Carol');
    expect(user!.profile?.surname).toBe('Jones');
  });
});

// ── changePassword ───────────────────────────────────────────────────────────

describe('changePassword', () => {
  const newPassword = 'New-Secure-99!';

  it('changes password with correct current password', async () => {
    await expect(changePassword(config, password, newPassword)).resolves.toBeUndefined();
  });

  it('can login with new password (waits 22s for authenticator cache TTL)', async () => {
    await new Promise(r => setTimeout(r, 22_000));
    clearToken();
    const user = await login(config, email, newPassword);
    expect(user._id).toBe(email);
  });

  it('rejects wrong current password', async () => {
    await expect(changePassword(config, 'wrong-password', 'Another-99!')).rejects.toThrow();
  });

  it('rejects too-short new password', async () => {
    await expect(changePassword(config, newPassword, 'short')).rejects.toThrow();
  });
});
