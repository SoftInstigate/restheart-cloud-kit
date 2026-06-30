import type { AuthConfig } from '../../types';

// ── Config ──────────────────────────────────────────────────────────────────

export function getConfig(): AuthConfig {
  const apiBaseUrl = process.env['RH_TEST_API_URL'];
  if (!apiBaseUrl) throw new Error('RH_TEST_API_URL is not set');
  return { apiBaseUrl };
}

export function getAdminPassword(): string {
  const password = process.env['RH_TEST_ADMIN_PASSWORD'];
  if (!password) throw new Error('RH_TEST_ADMIN_PASSWORD is not set');
  return password;
}

// ── Test-data isolation ──────────────────────────────────────────────────────

const runId = crypto.randomUUID().slice(0, 8);

export function testEmail(label: string): string {
  return `test-${runId}-${label}@restheart-test.com`;
}

// ── Cookie jar (Node.js fetch does not persist cookies automatically) ────────

const cookieJar = new Map<string, string[]>();

function getOrigin(url: string): string {
  return new URL(url).origin;
}

function parseCookies(header: string): string[] {
  return header.split(/,(?=[^ ])/).map(c => c.split(';')[0].trim());
}

const _originalFetch = globalThis.fetch.bind(globalThis);

export function installCookieJar(): void {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url    = input.toString();
    const origin = getOrigin(url);

    const existing = cookieJar.get(origin) ?? [];
    const headers  = new Headers(init?.headers);
    if (existing.length) headers.set('Cookie', existing.join('; '));
    headers.set('X-Skip-Email', 'true');

    const res = await _originalFetch(input, { ...init, headers, redirect: 'manual' });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const incoming = parseCookies(setCookie);
      const updated  = [...existing.filter(c => !incoming.some(n => n.split('=')[0] === c.split('=')[0])), ...incoming];
      cookieJar.set(origin, updated);
    }

    // follow same-origin redirects only (cross-origin = frontend, ignore)
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (location && getOrigin(location) === origin) {
        return globalThis.fetch(location, { method: 'GET', credentials: 'include' });
      }
    }

    return res;
  };
}

export function clearCookieJar(): void {
  cookieJar.clear();
}

// ── Admin fetch (Basic Auth, no cookie jar) ──────────────────────────────────

export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const { apiBaseUrl } = getConfig();
  const credentials = Buffer.from(`root:${getAdminPassword()}`).toString('base64');
  return _originalFetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
      ...init?.headers,
    },
  });
}

// ── Token readers ─────────────────────────────────────────────────────────────

export async function readVerificationToken(email: string): Promise<string> {
  const res = await adminFetch(`/users/${encodeURIComponent(email)}`);
  const doc = await res.json() as { verificationToken?: string };
  if (!doc.verificationToken) throw new Error(`verificationToken not found for ${email}`);
  return doc.verificationToken;
}

export async function readInvitationToken(email: string): Promise<string> {
  const filter = encodeURIComponent(JSON.stringify({ email }));
  const res    = await adminFetch(`/auth_invitations?filter=${filter}&pagesize=1`);
  const docs   = await res.json() as Array<{ token?: string }>;
  if (!docs[0]?.token) throw new Error(`invitation token not found for ${email}`);
  return docs[0].token;
}

export async function readPasswordResetToken(email: string): Promise<string> {
  const res = await adminFetch(`/users/${encodeURIComponent(email)}`);
  const doc = await res.json() as { resetToken?: string };
  if (!doc.resetToken) throw new Error(`resetToken not found for ${email}`);
  return doc.resetToken;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function deleteUser(email: string): Promise<void> {
  await adminFetch(`/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
}
