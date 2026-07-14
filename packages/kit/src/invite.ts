import type { AuthConfig, Invitation, LoginMode } from './types.js';
import { apiFetch, setToken } from './client.js';
import { scheduleRefresh } from './auth.js';

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
 * The backend issues a JWT cookie on success. For Bearer mode, the kit
 * reads the token from the response header if present, otherwise falls
 * back to an explicit POST /token call.
 */
export async function activate(
  config: AuthConfig,
  payload: { email: string; token: string; password: string },
  mode: LoginMode = 'bearer'
): Promise<void> {
  const res = await apiFetch(config, '/auth/activate', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (mode === 'bearer') {
    await storeBearerTokenAfterAutoLogin(config, res, payload.email, payload.password);
  }
  // Cookie mode: backend already set the JWT cookie, nothing to do
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

/**
 * After an auto-login endpoint (activate, resetPassword), extract the
 * Bearer token from the response. If the backend only set a cookie and
 * didn't include the token in the response, fall back to an explicit
 * POST /token login.
 */
export async function storeBearerTokenAfterAutoLogin(
  config: AuthConfig,
  res: Response,
  email: string,
  password: string
): Promise<void> {
  const authToken = res.headers.get('Auth-Token');
  if (authToken) {
    setToken(authToken);
    scheduleRefresh(config);
    return;
  }

  // No token in response — do an explicit login to get the Bearer token
  const credentials = btoa(`${email}:${password}`);
  const loginRes = await apiFetch(config, '/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
  });
  const token = loginRes.headers.get('Auth-Token');
  if (token) {
    setToken(token);
    scheduleRefresh(config);
  }
}
