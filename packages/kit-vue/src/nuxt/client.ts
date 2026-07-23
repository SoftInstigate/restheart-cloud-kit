/** Default route where {@link createSessionHandler} is mounted. */
export const DEFAULT_SESSION_ENDPOINT = '/api/rh/session';

/**
 * Send `token` to the session route handler, which writes the first-party
 * cookie. Call after a client-side `login()` or `switchTeam()` so the server
 * side of the app sees the same session.
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

/** Clear the first-party session cookie. Call on logout. */
export async function clearServerSession(
  endpoint: string = DEFAULT_SESSION_ENDPOINT
): Promise<void> {
  await fetch(endpoint, { method: 'DELETE' });
}

/**
 * The fragment→cookie bridge. Email verification and OAuth redirect back with
 * `#access_token=…` in the URL fragment, which never reaches the server. Read
 * the fragment on the landing page, POST the token to the session handler, then
 * strip the fragment. Returns `true` when a token was found and synced.
 *
 * ```ts
 * // on the redirect landing page (client only)
 * onMounted(async () => {
 *   if (await bridgeFragmentToCookie()) router.replace('/app');
 * });
 * ```
 */
export async function bridgeFragmentToCookie(
  endpoint: string = DEFAULT_SESSION_ENDPOINT
): Promise<boolean> {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  if (!token) return false;

  await syncServerSession(token, endpoint);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return true;
}
