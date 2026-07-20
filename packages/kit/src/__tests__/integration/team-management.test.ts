import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, login, clearToken } from '../../index';
import { invite, acceptInvite } from '../../invite';
import {
  getTeams,
  listTeamMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  removeMember,
  updateMemberRole,
} from '../../team';
import {
  getConfig, testEmail,
  readVerificationToken, readInvitationToken, deleteUser,
} from './helpers';

const config      = getConfig();
const ownerEmail  = testEmail('tm-owner');
const memberEmail = testEmail('tm-member');
const password    = 'Test-Password-99!';

async function registerAndVerify(email: string) {
  await register(config, { email, password, teamName: `Org-${email.slice(0, 8)}`, firstName: 'Test', lastName: 'User' });
  const token = await readVerificationToken(email);
  await fetch(`${config.apiBaseUrl}/auth/verify?email=${encodeURIComponent(email)}&token=${token}&delivery=cookie`);
}

beforeAll(async () => {
  await registerAndVerify(ownerEmail);
  await registerAndVerify(memberEmail);
  // owner invites member
  await login(config, ownerEmail, password);
  await invite(config, memberEmail, 'member');
  const inviteToken = await readInvitationToken(memberEmail);
  clearToken();
  await login(config, memberEmail, password);
  await acceptInvite(config, inviteToken);
  clearToken();
});

afterAll(async () => {
  clearToken();
  await Promise.allSettled([deleteUser(ownerEmail), deleteUser(memberEmail)]);
});

// ── listTeamMembers ──────────────────────────────────────────────────────────

describe('listTeamMembers', () => {
  beforeAll(() => login(config, ownerEmail, password));

  it('returns members of the active team', async () => {
    const members = await listTeamMembers(config);
    expect(members.length).toBeGreaterThanOrEqual(2);
    const emails = members.map(m => m.email);
    expect(emails).toContain(ownerEmail);
    expect(emails).toContain(memberEmail);
  });

  it('each member has email, role, and joinedAt', async () => {
    const members = await listTeamMembers(config);
    for (const m of members) {
      expect(m.email).toBeTruthy();
      expect(['owner', 'member']).toContain(m.role);
      expect(m.joinedAt).toBeTruthy();
    }
  });
});

// ── createTeam ───────────────────────────────────────────────────────────────

describe('createTeam', () => {
  beforeAll(() => login(config, ownerEmail, password));

  it('creates a new team and returns it', async () => {
    const team = await createTeam(config, 'Workspace Alpha');
    expect(team.id).toBeDefined();
    expect(team.id.$oid).toBeTruthy();
    expect(team.name).toBe('Workspace Alpha');
    expect(team.role).toBe('owner');
  });

  it('new team becomes the active one', async () => {
    const team = await createTeam(config, 'Workspace Beta');
    const teams = await getTeams(config);
    const active = teams.find(t => t.active);
    expect(active).toBeDefined();
    expect(active!.id.$oid).toBe(team.id.$oid);
  });
});

// ── updateTeam ───────────────────────────────────────────────────────────────

describe('updateTeam', () => {
  beforeAll(() => login(config, ownerEmail, password));

  it('updates the active team name', async () => {
    await createTeam(config, 'Rename Me');
    await updateTeam(config, { name: 'Renamed Workspace' });
    const teams = await getTeams(config);
    const active = teams.find(t => t.active);
    expect(active).toBeDefined();
    expect(active!.name).toBe('Renamed Workspace');
  });
});

// ── deleteTeam ───────────────────────────────────────────────────────────────

describe('deleteTeam', () => {
  it('deletes a team with no other members', async () => {
    clearToken();
    await login(config, ownerEmail, password);
    await createTeam(config, 'Delete Me');
    await deleteTeam(config);
    // After deletion, the active team should have changed
    const teams = await getTeams(config);
    const deleted = teams.find(t => t.name === 'Delete Me');
    expect(deleted).toBeUndefined();
  });

  it('fails to delete a team that has other members', async () => {
    clearToken();
    await login(config, ownerEmail, password);
    // The default team has both owner and member — cannot delete
    await expect(deleteTeam(config)).rejects.toThrow();
  });
});

// ── removeMember ─────────────────────────────────────────────────────────────

describe('removeMember', () => {
  it('removes a member from the active team', async () => {
    clearToken();
    await login(config, ownerEmail, password);

    // Create a fresh team, invite member, accept, then remove
    await createTeam(config, 'Remove Test');
    await invite(config, memberEmail, 'member');
    const inviteToken = await readInvitationToken(memberEmail);
    clearToken();
    await login(config, memberEmail, password);
    await acceptInvite(config, inviteToken);
    clearToken();
    await login(config, ownerEmail, password);

    // Switch to the team where both are members
    const teams = await getTeams(config);
    const removeTeam = teams.find(t => t.name === 'Remove Test');
    expect(removeTeam).toBeDefined();

    const membersBefore = await listTeamMembers(config);
    const countBefore = membersBefore.length;

    await removeMember(config, memberEmail);

    const membersAfter = await listTeamMembers(config);
    expect(membersAfter.length).toBe(countBefore - 1);
    expect(membersAfter.find(m => m.email === memberEmail)).toBeUndefined();
  });
});

// ── updateMemberRole ─────────────────────────────────────────────────────────

describe('updateMemberRole', () => {
  it('changes a member role', async () => {
    clearToken();
    await login(config, ownerEmail, password);

    // Create a fresh team, invite member with 'member' role, accept
    await createTeam(config, 'Role Test');
    await invite(config, memberEmail, 'member');
    const inviteToken = await readInvitationToken(memberEmail);
    clearToken();
    await login(config, memberEmail, password);
    await acceptInvite(config, inviteToken);
    clearToken();
    await login(config, ownerEmail, password);

    // Switch to that team
    const teams = await getTeams(config);
    const roleTeam = teams.find(t => t.name === 'Role Test');
    expect(roleTeam).toBeDefined();

    // Update member's role
    await updateMemberRole(config, memberEmail, 'owner');

    const members = await listTeamMembers(config);
    const updated = members.find(m => m.email === memberEmail);
    expect(updated).toBeDefined();
    expect(updated!.role).toBe('owner');
  });
});
