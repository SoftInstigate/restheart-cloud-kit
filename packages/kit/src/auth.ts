import type { AuthConfig, UserInfo } from './types.js';
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

export async function verify(config: AuthConfig, email: string, token: string): Promise<void> {
  await apiFetch(
    config,
    `/auth/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
  );
}

export async function login(
  config: AuthConfig,
  email: string,
  password: string
): Promise<UserInfo> {
  const credentials = btoa(`${email}:${password}`);
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
