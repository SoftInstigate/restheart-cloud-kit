import type { AuthConfig, TeamMembership } from './types.js';
import { apiFetch } from './client.js';

export async function getTeams(config: AuthConfig): Promise<TeamMembership[]> {
  const res = await apiFetch(config, '/auth/teams');
  return res.json() as Promise<TeamMembership[]>;
}

export async function switchTeam(
  config: AuthConfig,
  teamId: { $oid: string }
): Promise<void> {
  await apiFetch(config, '/auth/switch-team', {
    method: 'POST',
    body: JSON.stringify({ teamId }),
  });
}
