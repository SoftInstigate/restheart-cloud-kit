'use client';

import { useEffect } from 'react';

/** Default route where {@link createSessionRoute} is mounted. */
export const DEFAULT_SESSION_ENDPOINT = '/api/rh/session';

/**
 * Send `token` to the session route handler, which writes the first-party
 * cookie. Call this after a client-side `login()` or `switchTeam()` so the
 * server side of the app sees the same session.
 */
export async function syncServerSession(
  token: string,
  endpoint: string = DEFAULT_SESSION_ENDPOINT
): Promise<void> {
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: token }),
  });
}

/** Clear the first-party session cookie. Call this on logout. */
export async function clearServerSession(
  endpoint: string = DEFAULT_SESSION_ENDPOINT
): Promise<void> {
  await fetch(endpoint, { method: 'DELETE' });
}

export interface SessionSyncProps {
  /** Where {@link createSessionRoute} is mounted. Default `/api/rh/session`. */
  endpoint?: string;
  /** Called after the cookie has been written and the hash cleaned. */
  onSynced?: () => void;
}

/**
 * The fragment→cookie bridge. Email verification and OAuth redirect back with
 * `#access_token=…` in the URL fragment, which is never sent to the server.
 * This client component reads the fragment, POSTs the token to the session route
 * so the server can set the cookie, then strips the fragment from the URL.
 *
 * Render it once on the page the redirect lands on:
 *
 * ```tsx
 * 'use client';
 * <SessionSync onSynced={() => router.replace('/app')} />
 * ```
 */
export function SessionSync({
  endpoint = DEFAULT_SESSION_ENDPOINT,
  onSynced,
}: SessionSyncProps): null {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('access_token');
    if (!token) return;

    let cancelled = false;
    syncServerSession(token, endpoint)
      .then(() => {
        if (cancelled) return;
        // Drop the fragment so the token doesn't linger in the URL.
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
        onSynced?.();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [endpoint, onSynced]);

  return null;
}
