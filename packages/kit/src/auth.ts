import type { AuthConfig, UserInfo, LoginMode } from './types.js';
import { apiFetch, setToken, getToken, clearToken, getTokenExpiry } from './client.js';

// ── Proactive refresh ───────────────────────────────────────────────────────

let _refreshTimerId: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule a proactive token refresh at 80% of the token's remaining TTL.
 * The timer is module-scoped so it survives across calls but is cleared on
 * logout or explicit session clear.
 */
export function scheduleRefresh(config: AuthConfig): void {
  cancelRefresh();

  const token = getToken();
  if (!token) return;

  const expMs = getTokenExpiry(token);
  if (expMs === null) return; // no exp claim — can't schedule

  const ttlMs = expMs - Date.now();
  if (ttlMs <= 0) return; // already expired

  const refreshAt = ttlMs * 0.8; // 80% of TTL
  _refreshTimerId = setTimeout(async () => {
    try {
      const res = await apiFetch(config, '/token?renew');
      const newToken = res.headers.get('Auth-Token');
      if (newToken) {
        setToken(newToken);
        scheduleRefresh(config); // reschedule from new expiry
      }
    } catch {
      // refresh failed — token will expire naturally, next API call
      // will get a 401 and the session will be cleared
    }
  }, refreshAt);
}

/** Cancel any pending refresh timer. */
export function cancelRefresh(): void {
  if (_refreshTimerId !== null) {
    clearTimeout(_refreshTimerId);
    _refreshTimerId = null;
  }
}

// ── Bearer token extraction from auto-login responses ───────────────────────

/**
 * Extract a bearer token from an auto-login response (activate, resetPassword,
 * switchTeam) and store it locally. The server returns the token in the JSON
 * body (`access_token`) when `delivery=body`, or in the `Auth-Token` header
 * as a fallback.
 *
 * After storing the token, schedules a proactive refresh.
 *
 * Does nothing if no token is found (e.g. cookie mode, or the server did
 * not include a token).
 */
export async function applyBearerDelivery(
  config: AuthConfig,
  res: Response
): Promise<void> {
  const body = await res.clone().json().catch(() => null) as Record<string, unknown> | null;
  const token = (body?.['access_token'] as string | undefined) ?? res.headers.get('Auth-Token');
  if (token) {
    setToken(token);
    scheduleRefresh(config);
  }
}

// ── Auth operations ─────────────────────────────────────────────────────────

async function fetchUserInfo(config: AuthConfig): Promise<UserInfo> {
  const res = await apiFetch(config, '/users/me');
  return res.json() as Promise<UserInfo>;
}

export async function register(
  config: AuthConfig,
  payload: {
    email: string;
    password: string;
    teamName: string;
    firstName?: string;
    lastName?: string;
  }
): Promise<void> {
  await apiFetch(config, '/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Build the URL for email verification.
 *
 * This is a browser-navigation endpoint — the backend responds with a 302
 * redirect to frontend-app-url. The JWT is delivered according to delivery:
 * - cookie: sets a JWT cookie (for same-origin setups)
 * - fragment: appends #access_token=... to the redirect URL (for cross-origin SPAs)
 */
export function buildVerifyUrl(
  config: AuthConfig,
  email: string,
  token: string,
  delivery: 'cookie' | 'fragment' = 'fragment'
): string {
  const params = new URLSearchParams({ email, token, delivery });
  return `${config.apiBaseUrl}/auth/verify?${params.toString()}`;
}

/**
 * Verify an email token after signup.
 *
 * Returns the URL the browser must navigate to. The backend verifies the
 * token, promotes the user to roles: ["user"], and 302 redirects to
 * frontend-app-url with the JWT delivered per the delivery parameter.
 *
 * @param delivery  'cookie' sets a JWT cookie (same-origin);
 *                  'fragment' (default) redirects with #access_token=... in the URL hash
 *                  (cross-origin SPAs). Read the token from window.location.hash.
 *
 * @example
 * // Fragment delivery (default) — cross-origin SPAs
 * window.location.href = await verify(config, email, token);
 * // After redirect, read the token from location.hash
 *
 * @example
 * // Cookie delivery — same-origin setups
 * await verify(config, email, token, 'cookie');
 * // Cookie is set by the backend, no further action needed
 */
export async function verify(
  config: AuthConfig,
  email: string,
  token: string,
  delivery: 'cookie' | 'fragment' = 'fragment'
): Promise<string> {
  return buildVerifyUrl(config, email, token, delivery);
}

/**
 * Login.
 *
 * @param mode 'bearer' (default): POST /token, stores token in localStorage.
 *             'cookie': POST /token/cookie, backend sets HttpOnly JWT cookie.
 */
export async function login(
  config: AuthConfig,
  email: string,
  password: string,
  mode: LoginMode = 'bearer'
): Promise<UserInfo> {
  const credentials = btoa(`${email}:${password}`);

  if (mode === 'cookie') {
    // Cookie login — backend sets JWT cookie, no token in response
    await apiFetch(config, '/token/cookie', {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
    });
    return fetchUserInfo(config);
  }

  // Bearer login — token comes back in Auth-Token response header
  const res = await apiFetch(config, '/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
  });

  // Read token from Auth-Token response header
  const token = res.headers.get('Auth-Token');
  if (!token) {
    throw { status: 0, message: 'Login succeeded but no Auth-Token in response' };
  }

  setToken(token);
  scheduleRefresh(config);

  return fetchUserInfo(config);
}

export async function logout(config: AuthConfig): Promise<void> {
  cancelRefresh();
  try {
    await apiFetch(config, '/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}

/**
 * Check the current session state.
 *
 * Reads the token from localStorage — if present and not expired,
 * returns user info from the server. Otherwise returns null.
 */
export async function checkSession(config: AuthConfig): Promise<UserInfo | null> {
  const token = getToken();
  if (!token) return null;

  // Client-side expiry check — no need to call the server if the JWT is expired
  const expMs = getTokenExpiry(token);
  if (expMs !== null && expMs <= Date.now()) {
    clearToken();
    cancelRefresh();
    return null;
  }

  // Token exists and is not expired — verify with server and get full user info
  try {
    return await fetchUserInfo(config);
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status === 401 || e?.status === 403) {
      clearToken();
      cancelRefresh();
      return null;
    }
    throw err;
  }
}
