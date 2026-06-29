import type { AuthConfig, Invitation } from './types.js';
import { apiFetch } from './client.js';

export async function invite(
  config: AuthConfig,
  email: string,
  role: 'owner' | 'member'
): Promise<void> {
  await apiFetch(config, '/restheart-accounts/invitations', {
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
    `/restheart-accounts/invitations/${encodeURIComponent(email)}?token=${encodeURIComponent(token)}`
  );
  return res.json() as Promise<Invitation>;
}

export async function activate(
  config: AuthConfig,
  payload: { email: string; token: string; password: string }
): Promise<void> {
  await apiFetch(config, '/restheart-accounts/users/activate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function acceptInvite(config: AuthConfig, token: string): Promise<void> {
  await apiFetch(config, '/restheart-accounts/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendInvite(config: AuthConfig, email: string): Promise<void> {
  await apiFetch(config, '/restheart-accounts/invitations/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}
