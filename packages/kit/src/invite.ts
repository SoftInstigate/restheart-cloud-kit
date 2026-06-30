import type { AuthConfig, Invitation } from './types.js';
import { apiFetch } from './client.js';

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

export async function activate(
  config: AuthConfig,
  payload: { email: string; token: string; password: string }
): Promise<void> {
  await apiFetch(config, '/auth/activate', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
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
