import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, login, clearToken } from '../../index';
import { invite, getInvitation, activate, acceptInvite } from '../../invite';
import {
  getConfig, testEmail,
  readVerificationToken, readInvitationToken, deleteUser,
} from './helpers';

const config       = getConfig();
const ownerEmail   = testEmail('invite-owner');
const newUserEmail = testEmail('invite-new');
const existingUserEmail = testEmail('invite-existing');
const password     = 'Test-Password-99!';

async function registerAndVerify(email: string) {
  await register(config, { email, password, teamName: `Org-${email.slice(0, 8)}`, firstName: 'Test', lastName: 'User' });
  const token = await readVerificationToken(email);
  await fetch(`${config.apiBaseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}&delivery=cookie`);
}

beforeAll(async () => {
  await registerAndVerify(ownerEmail);
  await registerAndVerify(existingUserEmail);
});

afterAll(async () => {
  clearToken();
  await Promise.allSettled([
    deleteUser(ownerEmail),
    deleteUser(newUserEmail),
    deleteUser(existingUserEmail),
  ]);
});

describe('invite — new user', () => {
  beforeAll(async () => {
    await login(config, ownerEmail, password);
  });

  it('invite sends invitation to a new user', async () => {
    await expect(invite(config, newUserEmail, 'member')).resolves.toBeUndefined();
  });

  it('getInvitation returns metadata', async () => {
    const token      = await readInvitationToken(newUserEmail);
    const invitation = await getInvitation(config, newUserEmail, token);
    expect(invitation.isNewUser).toBe(true);
    expect(invitation.role).toBe('member');
    expect(invitation.email).toBe(newUserEmail);
  });

  it('activate sets password and logs in the new user', async () => {
    const token = await readInvitationToken(newUserEmail);
    clearToken();
    await expect(activate(config, { email: newUserEmail, token, password })).resolves.toBeUndefined();
  });
});

describe('invite — existing user', () => {
  beforeAll(async () => {
    clearToken();
    await login(config, ownerEmail, password);
  });

  it('invite sends invitation to an existing user', async () => {
    await expect(invite(config, existingUserEmail, 'member')).resolves.toBeUndefined();
  });

  it('acceptInvite adds the user to the team', async () => {
    const token = await readInvitationToken(existingUserEmail);
    clearToken();
    await login(config, existingUserEmail, password);
    await expect(acceptInvite(config, token)).resolves.toBeUndefined();
  });
});