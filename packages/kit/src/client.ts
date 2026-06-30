import type { AuthConfig, ApiError } from './types.js';

export async function apiFetch(
  config: AuthConfig,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${config.apiBaseUrl}${path}`;
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? body.msg ?? message;
    } catch {
      // ignore parse errors
    }
    const err: ApiError = { status: res.status, message };
    throw err;
  }

  return res;
}
