import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, verify, login } from '../../auth';
import { invite, activate } from '../../invite';
import { getTenants, switchTenant } from '../../tenant';
import {
  getConfig, testEmail,
  installCookieJar, clearCookieJar,
  readVerificationToken, readInvitationToken, deleteUser,
} from './helpers';

const config      = getConfig();
const ownerEmail  = testEmail('tenant-owner');
const memberEmail = testEmail('tenant-member');
const password    = 'Test-Password-99!';

async function registerAndVerify(email: string) {
  await register(config, { email, password, orgName: `Org-${email.slice(0, 8)}` });
  const token = await readVerificationToken(email);
  await fetch(`${config.apiBaseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}`, {
    credentials: 'include',
  });
}

beforeAll(async () => {
  installCookieJar();
  // create owner and an additional team for the member
  await registerAndVerify(ownerEmail);
  await registerAndVerify(memberEmail);
  // owner invites member so member has 2 tenants
  await login(config, ownerEmail, password);
  await invite(config, memberEmail, 'member');
  const inviteToken = await readInvitationToken(memberEmail);
  clearCookieJar();
  await login(config, memberEmail, password);
  await activate(config, { email: memberEmail, token: inviteToken, password });
});

afterAll(async () => {
  clearCookieJar();
  await Promise.allSettled([deleteUser(ownerEmail), deleteUser(memberEmail)]);
});

describe('tenant', () => {
  beforeAll(() => login(config, memberEmail, password));

  it('getTenants returns all memberships', async () => {
    const tenants = await getTenants(config);
    expect(tenants.length).toBeGreaterThanOrEqual(2);
  });

  it('switchTenant changes the active team', async () => {
    const tenants  = await getTenants(config);
    const other    = tenants.find((t: { active?: boolean }) => !t.active);
    expect(other).toBeDefined();
    await expect(switchTenant(config, other!.id)).resolves.toBeUndefined();
  });
});
