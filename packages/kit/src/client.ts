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
