import type { AuthConfig, ApiError } from './types.js';

/** Returns true if `apiBaseUrl` is a well-formed RESTHeart Cloud service URL (*.restheart.com). */
export function isValidApiBaseUrl(apiBaseUrl: string): boolean {
  try {
    return new URL(apiBaseUrl).hostname.toLowerCase().endsWith('.restheart.com');
  } catch {
    return false;
  }
}

function assertValidApiBaseUrl(apiBaseUrl: string): void {
  if (!isValidApiBaseUrl(apiBaseUrl)) {
    throw {
      status: 0,
      message: `Invalid URL: apiBaseUrl must be a RESTHeart Cloud service (*.restheart.com), got "${apiBaseUrl}"`,
    } satisfies ApiError;
  }
}

export async function apiFetch(
  config: AuthConfig,
  path: string,
  init?: RequestInit
): Promise<Response> {
  assertValidApiBaseUrl(config.apiBaseUrl);

  const url = `${config.apiBaseUrl}${path}`;
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // Suppress RESTHeart's WWW-Authenticate challenge on 401 responses —
  // without this, browsers show their native Basic Auth popup whenever
  // an unauthenticated request (e.g. a session check) gets a 401.
  headers.set('No-Auth-Challenge', 'true');

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    let message = res.statusText;
    let body: unknown;
    try {
      body = await res.json();
      const b = body as Record<string, unknown>;
      message = (b['message'] ?? b['msg'] ?? message) as string;
    } catch {
      // ignore parse errors
    }
    const err: ApiError = { status: res.status, message };
    console.error(`[apiFetch] ${init?.method ?? 'GET'} ${url} → ${res.status} ${res.statusText}`, body ?? '');
    throw err;
  }

  return res;
}
