import type { AuthConfig, UserInfo } from './types.js';
import { apiFetch } from './client.js';

/** Updates the caller's own profile fields. restheart#646. */
export async function updateProfile(
  config: AuthConfig,
  updates: { firstName?: string; lastName?: string }
): Promise<Pick<UserInfo, 'profile'>> {
  const res = await apiFetch(config, '/auth/profile', { method: 'PATCH', body: JSON.stringify(updates) });
  return res.json() as Promise<Pick<UserInfo, 'profile'>>;
}

/** Changes the caller's password (current password required, no email round-trip). restheart#647. */
export async function changePassword(
  config: AuthConfig,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiFetch(config, '/auth/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
}
