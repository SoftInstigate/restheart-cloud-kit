import type { AuthConfig, TeamMembership, LoginMode } from './types.js';
import { apiFetch } from './client.js';
import { applyBearerDelivery } from './auth.js';

export async function getTeams(config: AuthConfig): Promise<TeamMembership[]> {
  const res = await apiFetch(config, '/auth/teams');
  return res.json() as Promise<TeamMembership[]>;
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
