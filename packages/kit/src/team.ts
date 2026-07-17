import type { AuthConfig, TeamMembership, TeamMember, LoginMode } from './types.js';
import { apiFetch } from './client.js';
import { applyBearerDelivery } from './auth.js';
import { mockDelay, mockError } from './mock.js';

export async function getTeams(config: AuthConfig): Promise<TeamMembership[]> {
  const res = await apiFetch(config, '/auth/teams');
  return res.json() as Promise<TeamMembership[]>;
}

// ── Mocked — no backend endpoint yet, see restheart#648 ─────────────────────
//
// listTeamMembers, createTeam, updateTeam, deleteTeam simulate their eventual
// server behavior (latency, validation, error shapes) against in-memory state
// so the starter app's UI can be built and visually verified before the
// restheart-accounts endpoints land.
//
// removeMember/updateMemberRole already have a real, working backend endpoint
// today (RemoveMemberService/UpdateMemberRoleService) — the apiFetch calls
// they'll make once restheart#642 (member list) lands are shown commented
// below each function. Until then they operate on the same in-memory roster
// as listTeamMembers, since a real removeMember call against a mock (fake)
// email would just 403/404 on the live server — there's nothing there to
// remove. Swap the body for the commented apiFetch call once the list is real.

let mockMembers: TeamMember[] = [
  { email: 'you@example.com', name: 'You', role: 'owner', joinedAt: new Date(Date.now() - 90 * 86400000).toISOString() },
  { email: 'alice@example.com', name: 'Alice Rossi', role: 'member', joinedAt: new Date(Date.now() - 30 * 86400000).toISOString() },
  { email: 'bob@example.com', name: 'Bob Bianchi', role: 'member', joinedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
];

/** Mock — see restheart#642. Lists the caller's active team's members. */
export async function listTeamMembers(_config: AuthConfig): Promise<TeamMember[]> {
  await mockDelay();
  return mockMembers.map(m => ({ ...m }));
}

/** Removes a member from the caller's active team. Owner/admin only; owners can't remove themselves. */
export async function removeMember(_config: AuthConfig, email: string): Promise<void> {
  // Real endpoint already exists — once restheart#642 lands, replace the body with:
  //   await apiFetch(config, '/auth/remove-member', { method: 'DELETE', body: JSON.stringify({ email }) });
  await mockDelay();
  mockMembers = mockMembers.filter(m => m.email !== email);
}

/** Updates a member's org-level role within the caller's active team. Owner/admin only. */
export async function updateMemberRole(_config: AuthConfig, email: string, role: 'owner' | 'member'): Promise<void> {
  // Real endpoint already exists — once restheart#642 lands, replace the body with:
  //   await apiFetch(config, '/auth/member-role', { method: 'PATCH', body: JSON.stringify({ email, role }) });
  await mockDelay();
  const m = mockMembers.find(m => m.email === email);
  if (m) m.role = role;
}

/** Mock — see restheart#643. Creates an additional team for the caller, who becomes its owner. */
export async function createTeam(_config: AuthConfig, teamName: string): Promise<TeamMembership> {
  await mockDelay();
  if (!teamName.trim()) {
    throw mockError(400, 'teamName is required');
  }
  return {
    id: { $oid: Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('') },
    name: teamName,
    role: 'owner',
    active: true,
  };
}

/** Mock — see restheart#644. Renames/edits the caller's active team. Owner/admin only. */
export async function updateTeam(
  _config: AuthConfig,
  _teamId: { $oid: string },
  _updates: { name?: string; description?: string }
): Promise<void> {
  await mockDelay();
}

/** Mock — see restheart#645. Deletes the caller's active team. Owner only; fails if the team has other members. */
export async function deleteTeam(_config: AuthConfig, _teamId: { $oid: string }): Promise<void> {
  await mockDelay();
  if (mockMembers.length > 1) {
    throw mockError(409, 'Team still has other members — remove them before deleting the team');
  }
}

/**
 * Switch the active team.
 *
 * Uses the `delivery` query parameter to control token delivery:
 * - bearer (default): delivery=body — new JWT (with updated team claim) returned in the response JSON body
 * - cookie: delivery=cookie — backend sets HttpOnly JWT cookie with updated team claim
 *
 * In bearer mode the stored token is replaced with the fresh one so that
 * subsequent requests carry the correct team context.
 */
export async function switchTeam(
  config: AuthConfig,
  teamId: { $oid: string },
  mode: LoginMode = 'bearer'
): Promise<void> {
  const delivery = mode === 'bearer' ? 'body' : 'cookie';
  const res = await apiFetch(config, `/auth/switch-team?delivery=${delivery}`, {
    method: 'POST',
    body: JSON.stringify({ teamId }),
  });

  if (mode === 'bearer') {
    await applyBearerDelivery(config, res);
  }
  // Cookie mode: backend already set the JWT cookie, nothing to do
}
