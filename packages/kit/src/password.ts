import type { AuthConfig } from './types.js';
import { apiFetch } from './client.js';

export async function forgotPassword(config: AuthConfig, email: string): Promise<void> {
  await apiFetch(config, '/restheart-accounts/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  config: AuthConfig,
  payload: { email: string; token: string; password: string }
): Promise<void> {
  await apiFetch(config, '/restheart-accounts/password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
