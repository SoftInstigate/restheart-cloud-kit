import type { AuthConfig, UserInfo } from './types.js';
import { mockDelay, mockError } from './mock.js';

// ── Mocked — no backend endpoint yet, see restheart#648 ─────────────────────
//
// updateProfile and changePassword simulate their eventual server behavior
// (latency, validation, error shapes) so the starter app's UI can be built
// and visually verified before the restheart-accounts endpoints land.
// Replace each body with a real apiFetch call once its tracking sub-issue is
// implemented — signatures are meant to stay stable.

/** Mock — see restheart#646. Updates the caller's own profile fields. */
export async function updateProfile(
  _config: AuthConfig,
  updates: { firstName?: string; lastName?: string }
): Promise<Pick<UserInfo, 'profile'>> {
  // Once restheart#646 lands, replace with:
  //   const res = await apiFetch(config, '/auth/profile', { method: 'PATCH', body: JSON.stringify(updates) });
  //   return res.json();
  await mockDelay();
  return { profile: { ...updates } };
}

/** Mock — see restheart#647. Changes the caller's password (current password required, no email round-trip). */
export async function changePassword(
  _config: AuthConfig,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Once restheart#647 lands, replace with:
  //   await apiFetch(config, '/auth/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
  await mockDelay();
  if (!currentPassword) {
    throw mockError(400, 'Current password is required');
  }
  if (newPassword.length < 8) {
    throw mockError(400, 'Password is too weak — use at least 8 characters');
  }
}
