import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { register, login, clearToken, getToken, getUserInfo, acceptConsents } from '../../index';
import {
  getConfig, testEmail,
  adminFetch, verifyEmail, deleteUser,
} from './helpers';

const config   = getConfig();
const email    = testEmail('consents');
const password = 'Test-Password-99!';

const TOS = '2026-07-01';
const PP  = '2026-07-01';

const PERMISSION_ID = `kitTest-${email.split('@')[0]}-consents`;

/**
 * The ACL permission the acceptance needs. Nothing authorizes `PATCH /users/{id}`
 * out of the box: `restheart-accounts` only vetoes the account-management fields,
 * so without this the request is a 403 and `acceptConsents` cannot work at all.
 *
 * `bson-request-whitelist(consents)` narrows it to the one field, and
 * `mergeRequest` decides what is actually written — the client states neither the
 * version nor the timestamp. `_$push` is unescaped to `$push` by the server, which
 * is what grows the history array.
 */
const permission = {
  _id: PERMISSION_ID,
  predicate: "path-template('/users/{userId}') and method(PATCH) and (equals(@user._id, ${userId}) or equals(@user.sub, ${userId})) and bson-request-whitelist(consents)",
  roles: ['user'],
  priority: 1,
  mongo: {
    mergeRequest: {
      latestConsents: { tos: TOS, pp: PP, acceptedAt: '@now' },
      _$push: { consents: { tos: TOS, pp: PP, acceptedAt: '@now' } },
    },
  },
};

type AppUser = {
  latestConsents?: { tos: string; pp: string; acceptedAt?: { $date: number } };
  consents?: Array<{ tos: string; pp: string }>;
};

beforeAll(async () => {
  const res = await adminFetch('/acl', { method: 'POST', body: JSON.stringify(permission) });
  if (!res.ok) throw new Error(`could not create the test permission: ${res.status} ${await res.text()}`);

  await register(config, { email, password, teamName: `Org-${email.slice(0, 8)}`, firstName: 'Ada', lastName: 'Lovelace' });
  await verifyEmail(email);
  await login(config, email, password);

  // The ACL is cached for 20s on a service node — a permission created a moment
  // ago is not in effect yet.
  await new Promise(r => setTimeout(r, 22_000));
}, 60_000);

afterAll(async () => {
  clearToken();
  await adminFetch(`/acl/${PERMISSION_ID}`, { method: 'DELETE' });
  await deleteUser(email);
});

// ── register ─────────────────────────────────────────────────────────────────

describe('register with application fields', () => {
  it('succeeds, and drops them when no JSON Schema is configured', async () => {
    const other = testEmail('consents-signup');
    await expect(register(config, {
      email: other,
      password,
      teamName: `Org-${other.slice(0, 8)}`,
      firstName: 'Grace',
      lastName: 'Hopper',
      latestConsents: { tos: TOS, pp: PP },
    })).resolves.toBeUndefined();

    const doc = await adminFetch(`/users/${encodeURIComponent(other)}`).then(r => r.json()) as AppUser;
    // No schema on this service: the extra properties never reach the document.
    // With one configured they would, which is what makes accepting at sign-up work.
    expect(doc.latestConsents).toBeUndefined();

    await deleteUser(other);
  });
});

// ── acceptConsents ───────────────────────────────────────────────────────────

describe('acceptConsents', () => {
  it('records the versions the server chose, not the ones the client sent', async () => {
    const user = await acceptConsents<AppUser>(config, email, { consents: [{ tos: '1999-01-01', pp: '1999-01-01' }] });

    expect(user.latestConsents?.tos).toBe(TOS);
    expect(user.latestConsents?.pp).toBe(PP);
    expect(user.latestConsents?.acceptedAt).toBeDefined();
  });

  it('renews the token', async () => {
    const before = getToken();
    // The expiry has a one-second granularity: two tokens issued within the same
    // second are byte-identical, which would make this pass or fail on timing.
    await new Promise(r => setTimeout(r, 1_100));
    await acceptConsents<AppUser>(config, email);
    expect(getToken()).not.toBe(before);
  });

  it('appends to the history rather than overwriting it', async () => {
    const user = await getUserInfo<AppUser>(config);
    // one record per acceptance: the two above plus this suite's first call
    expect(user.consents?.length).toBeGreaterThanOrEqual(2);
    expect(user.consents?.every(c => c.tos === TOS && c.pp === PP)).toBe(true);
  });

  it('rejects a write outside the whitelist', async () => {
    // Not a field the accounts veto covers — only the permission's whitelist can
    // refuse this one, which is what makes the scoping meaningful.
    await expect(
      acceptConsents(config, email, { preferences: { theme: 'dark' } })
    ).rejects.toMatchObject({ status: 403 });
  });
});
