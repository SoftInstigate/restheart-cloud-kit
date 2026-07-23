import type { AuthConfig, Invitation, LoginMode, PendingInvitation } from './types.js';
import { apiFetch } from './client.js';
import { applyBearerDelivery } from './auth.js';

export async function invite(
  config: AuthConfig,
  email: string,
  role: 'owner' | 'member'
): Promise<void> {
  await apiFetch(config, '/auth/invite', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export async function getInvitation(
  config: AuthConfig,
  email: string,
  token: string
): Promise<Invitation> {
  const res = await apiFetch(
    config,
    `/auth/invitation?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
  );
  return res.json() as Promise<Invitation>;
}

/**
 * Activate account for a newly invited user (sets password, auto-logs in).
 *
 * Uses the `delivery` query parameter to control token delivery:
 * - bearer (default): delivery=body — token returned in the response JSON body
 * - cookie: delivery=cookie — backend sets HttpOnly JWT cookie, no token in body
 *
 * Returns the fresh bearer token (bearer mode), or `null` (cookie mode), so a
 * server action can write it into a response cookie.
 */
export async function activate(
  config: AuthConfig,
  payload: { email: string; token: string; password: string },
  mode: LoginMode = 'bearer'
): Promise<string | null> {
  const delivery = mode === 'bearer' ? 'body' : 'cookie';
  const res = await apiFetch(config, `/auth/activate?delivery=${delivery}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (mode === 'bearer') {
    return applyBearerDelivery(config, res);
  }
  // Cookie mode: backend already set the JWT cookie, nothing to do
  return null;
}

export async function acceptInvite(config: AuthConfig, token: string): Promise<void> {
  await apiFetch(config, '/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendInvite(config: AuthConfig, email: string): Promise<void> {
  await apiFetch(config, '/auth/resend-invite', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Lists pending (non-expired) invitations for the caller's active team. Owner/admin only. */
export async function listInvitations(config: AuthConfig): Promise<PendingInvitation[]> {
  const res = await apiFetch(config, '/auth/invitations');
  return res.json() as Promise<PendingInvitation[]>;
}
