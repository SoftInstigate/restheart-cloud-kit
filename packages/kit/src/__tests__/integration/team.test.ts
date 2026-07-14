import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, verify, login, clearToken } from '../../index';
import { invite, acceptInvite } from '../../invite';
import { getTeams, switchTeam } from '../../team';
import {
  getConfig, testEmail,
  readVerificationToken, readInvitationToken, deleteUser,
} from './helpers';

const config      = getConfig();
const ownerEmail  = testEmail('team-owner');
const memberEmail = testEmail('team-member');
const password    = 'Test-Password-99!';

async function registerAndVerify(email: string) {
  await register(config, { email, password, teamName: `Org-${email.slice(0, 8)}`, firstName: 'Test', lastName: 'User' });
  const token = await readVerificationToken(email);
  await fetch(`${config.apiBaseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}&delivery=cookie`);
}

beforeAll(async () => {
  await registerAndVerify(ownerEmail);
  await registerAndVerify(memberEmail);
  // owner invites member so member has 2 teams
  await login(config, ownerEmail, password);
  await invite(config, memberEmail, 'member');
  const inviteToken = await readInvitationToken(memberEmail);
  clearToken();
  await login(config, memberEmail, password);
  await acceptInvite(config, inviteToken);
});

afterAll(async () => {
  clearToken();
  await Promise.allSettled([deleteUser(ownerEmail), deleteUser(memberEmail)]);
});

describe('team', () => {
  beforeAll(() => login(config, memberEmail, password));

  it('getTeams returns all memberships', async () => {
    const teams = await getTeams(config);
    expect(teams.length).toBeGreaterThanOrEqual(2);
  });

  it('switchTeam changes the active team', async () => {
    const teams = await getTeams(config);
    const other = teams.find((t: { active?: boolean }) => !t.active);
    expect(other).toBeDefined();
    await expect(switchTeam(config, other!.id)).resolves.toBeUndefined();
  });
});
