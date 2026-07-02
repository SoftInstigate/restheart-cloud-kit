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

// ── Admin fetch (Basic Auth, no cookie jar) ──────────────────────────────────

const _originalFetch = globalThis.fetch.bind(globalThis);

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

async function adminGet<T>(path: string): Promise<T> {
  const res = await adminFetch(path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`adminFetch GET ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Token readers ─────────────────────────────────────────────────────────────

export async function readVerificationToken(email: string): Promise<string> {
  const doc = await adminGet<Record<string, unknown>>(`/users/${encodeURIComponent(email)}`);
  const token = doc['emailVerificationToken'];
  if (!token) throw new Error(`emailVerificationToken not found for ${email}. Doc keys: ${Object.keys(doc).join(', ')}`);
  return token as string;
}

export async function readInvitationToken(email: string): Promise<string> {
  const filter = encodeURIComponent(JSON.stringify({ email }));
  const docs   = await adminGet<Array<Record<string, unknown>>>(`/auth_invitations?filter=${filter}&pagesize=1`);
  const token  = docs[0]?.['token'];
  if (!token) throw new Error(`invitation token not found for ${email}`);
  return token as string;
}

export async function readPasswordResetToken(email: string): Promise<string> {
  const doc = await adminGet<Record<string, unknown>>(`/users/${encodeURIComponent(email)}`);
  const token = doc['emailPasswordResetToken'] ?? doc['passwordResetToken'];
  if (!token) throw new Error(`password reset token not found for ${email}. Doc keys: ${Object.keys(doc).join(', ')}`);
  return token as string;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function deleteUser(email: string): Promise<void> {
  await adminFetch(`/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

export async function cleanupTestUsers(): Promise<void> {
  const filter = encodeURIComponent(JSON.stringify({ _id: { $regex: '@restheart-test\\.com$' } }));
  await adminFetch(`/users/*?filter=${filter}`, { method: 'DELETE' });
  await adminFetch(`/auth_invitations/*?filter=${filter}`, { method: 'DELETE' });
}
