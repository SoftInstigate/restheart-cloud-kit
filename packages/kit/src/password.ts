import type { AuthConfig, LoginMode } from './types.js';
import { apiFetch } from './client.js';
import { storeBearerTokenAfterAutoLogin } from './invite.js';

export async function forgotPassword(config: AuthConfig, email: string): Promise<void> {
  await apiFetch(config, '/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Apply a new password using a reset token.
 *
 * The backend issues a JWT cookie on success (auto-login). For Bearer mode,
 * the kit reads the token from the response header if present, otherwise
 * falls back to an explicit POST /token call.
 */
export async function resetPassword(
  config: AuthConfig,
  payload: { email: string; token: string; password: string },
  mode: LoginMode = 'bearer'
): Promise<void> {
  const res = await apiFetch(config, '/auth/reset-password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (mode === 'bearer') {
    await storeBearerTokenAfterAutoLogin(config, res, payload.email, payload.password);
  }
  // Cookie mode: backend already set the JWT cookie, nothing to do
}
