import type { AuthConfig, LoginMode } from './types.js';
import { apiFetch } from './client.js';
import { applyBearerDelivery } from './auth.js';

export async function forgotPassword(config: AuthConfig, email: string): Promise<void> {
  await apiFetch(config, '/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Apply a new password using a reset token.
 *
 * Uses the `delivery` query parameter to control token delivery:
 * - bearer (default): delivery=body — token returned in the response JSON body
 * - cookie: delivery=cookie — backend sets HttpOnly JWT cookie, no token in body
 */
export async function resetPassword(
  config: AuthConfig,
  payload: { email: string; token: string; password: string },
  mode: LoginMode = 'bearer'
): Promise<void> {
  const delivery = mode === 'bearer' ? 'body' : 'cookie';
  const res = await apiFetch(config, `/auth/reset-password?delivery=${delivery}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (mode === 'bearer') {
    await applyBearerDelivery(config, res);
  }
  // Cookie mode: backend already set the JWT cookie, nothing to do
}
