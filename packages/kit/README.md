# @restheart-cloud/kit

Adds signup and login to your frontend — zero dependencies, works with Angular, React, Vue, or vanilla JS.

Covers every [`restheart-accounts`](https://restheart.org/docs/accounts) flow: signup, login, email verification, password reset — plus team management for apps that need it: invitations, member roles, multi-team switching.

Pairs with [RESTHeart Cloud](https://cloud.restheart.com), which gives you a production-ready backend — MongoDB, REST API, authentication, signup/signin, all managed.

## Installation

```bash
npm install @restheart-cloud/kit
```

> **v0.3.0+ requires RESTHeart 9.6.0 or later.** Bearer-mode `activate()`, `resetPassword()`, and `switchTeam()` rely on the `delivery=body` query parameter, introduced in RESTHeart 9.6.0. Against an older server the request still succeeds, but the kit won't be able to capture the bearer token from the response (the extra param is silently ignored) — you'll need to log in again to get a token. Cookie mode is unaffected.

## Usage

```typescript
import { checkSession, login, logout } from '@restheart-cloud/kit';

const config = { apiBaseUrl: 'https://api.example.com' };

const user = await checkSession(config);  // UserInfo | null
await login(config, 'user@example.com', 'secret');
await logout(config);
```

If the users collection has a JSON Schema with additional fields, pass them in the register payload:

```typescript
import { register } from '@restheart-cloud/kit';

await register(config, {
  email: 'user@example.com',
  password: 'secret',
  teamName: 'acme',
  latestConsents: { tos: '2026-07-01', pp: '2026-07-01' },
  consents: [{ tos: '2026-07-01', pp: '2026-07-01' }]
});
```

> **Note:** When no JSON Schema is configured on the users collection the server silently drops any extra properties — the request still succeeds with `201`.

See [Consents](#consents) for the whole pattern, including the users who cannot accept at sign-up.

Authentication is handled via a Bearer token stored in `localStorage` — every authenticated request sends `Authorization: Bearer <token>`. This is the default (`mode: 'bearer'`) and works cross-origin.

Cookie authentication (`mode: 'cookie'`) is also supported, but **only for same-origin setups**: the backend manages an HttpOnly JWT cookie and no token ever touches `localStorage` or JavaScript.

Because a RESTHeart Cloud service lives on `*.restheart.com` while your app lives on your own domain, that cookie is *third-party* on every request your page makes — blocked by default in Safari and Firefox, and left to the user in Chrome. A permissive CORS configuration does not change this: the browser drops the cookie before CORS is even consulted. **Use bearer mode unless the app is served from the same origin as the service.**

If you are building on Next.js or Nuxt, note that this is a different cookie from the one those frameworks use — theirs is a first-party cookie set by your own server, holding the same bearer token, and it needs no cookie support from RESTHeart at all. See [docs/ADAPTERS.md](../../docs/ADAPTERS.md#2-token-delivery--the-cookie-story).

The token is stored in `localStorage` and expires within 15 minutes. Sessions survive page reloads but don't persist across browser sessions if the token has expired.

Token refresh is fully transparent: the kit schedules a proactive renewal at 80% of the token's TTL (~12 minutes). As long as the tab stays open, the session stays alive without the app or user noticing.

### Bearer vs cookie — same functions, one `mode` parameter

`login`, `activate`, and `resetPassword` accept a `mode: 'bearer' | 'cookie'` parameter (default `'bearer'`), and `switchTeam` does too. Under the hood, this sets the `delivery` query parameter the backend understands (`body` for bearer, `cookie` for cookie mode) on every auto-login endpoint — `POST /token` / `POST /token/cookie`, `PATCH /auth/activate`, `PATCH /auth/reset-password`, `POST /auth/switch-team`. In bearer mode, the fresh token always comes back in the same response (no extra round-trip); in cookie mode, the backend sets the cookie and the response body carries no token.

Pick one mode per app — mixing modes for the same user session isn't supported.

### Email verification flow

After signup, the user receives a verification email. The `verify()` function returns a URL that the app must navigate to:

```typescript
// Fragment delivery (default) — cross-origin SPAs
const url = await verify(config, email, token);
window.location.href = url; // backend 302 redirects to frontend-app-url#access_token=...
```

The backend verifies the token, promotes the user, and redirects to your `frontend-app-url` with the JWT as a URL fragment. Your app reads the token from `window.location.hash` and calls `setToken()` to store it.

For same-origin setups where cookies work, pass `'cookie'`:

```typescript
// Cookie delivery — same-origin setups
const url = await verify(config, email, token, 'cookie');
window.location.href = url; // backend sets JWT cookie and redirects
```

Errors are thrown as `{ status: number; message: string }`.

## API

### Auth

| Function | Description |
|---|---|
| `checkSession(config)` | Returns `UserInfo` if a valid token is held in memory, `null` otherwise |
| `register(config, payload)` | Sign up — creates user and team. Accepts additional properties for app-specific JSON Schema fields (e.g. consents) |
| `verify(config, email, token, delivery?)` | Verify email after signup — returns a URL for browser redirect (`delivery`: `'fragment'` (default) or `'cookie'`) |
| `login(config, email, password, mode?)` | Email/password login (`mode`: `'bearer'` (default) or `'cookie'`) |
| `logout(config)` | Clears the token and cancels pending refresh |
| `getUserInfo(config)` | Read the stored user document (`GET /users/me`) without the session bookkeeping of `checkSession` |
| `updateUser(config, email, updates)` | Update a user document via `PATCH /users/{email}` — ACL-scoped, distinct from `updateProfile` |
| `acceptConsents(config, userId, body?, mode?)` | Record the acceptance, renew the token, return the updated user |

### Token management

| Function | Description |
|---|---|
| `setToken(token)` | Store a token manually (e.g. after OAuth redirect) |
| `getToken()` | Read the current token, or `null` |
| `clearToken()` | Clear the token and cancel any pending refresh |
| `renewToken(config, mode?)` | Force a new token, rebuilt from the user document as it is now |
| `scheduleRefresh(config)` | Schedule proactive token renewal (called automatically by `login`) |
| `cancelRefresh()` | Cancel a pending refresh timer |

### Invitations

| Function | Description |
|---|---|
| `invite(config, email, role)` | Invite a user to the current team |
| `getInvitation(config, email, token)` | Invitation metadata (org name, role, isNewUser) |
| `activate(config, payload, mode?)` | Activate account for a newly invited user (`mode`: `'bearer'` (default) or `'cookie'`) |
| `acceptInvite(config, token)` | Accept invitation for an already registered user |
| `resendInvite(config, email)` | Resend an expired invitation |

### Password

| Function | Description |
|---|---|
| `forgotPassword(config, email)` | Request a reset link (always returns 202) |
| `resetPassword(config, payload, mode?)` | Apply the reset token (`mode`: `'bearer'` (default) or `'cookie'`) |

### Multi-team

| Function | Description |
|---|---|
| `getTeams(config)` | List teams the authenticated user belongs to |
| `switchTeam(config, teamId, mode?)` | Switch active team (`mode`: `'bearer'` (default) or `'cookie'`) — in bearer mode, the stored token is replaced with the freshly issued one carrying the new team claim |

## Consents

Blocking users who have not accepted the current terms is a server-side rule — a [Guards](https://restheart.org/docs/cloud/guards#_example_gating_on_consents) condition that refuses every request from a user whose document does not carry the current versions, plus an ACL permission that exempts the one request recording the acceptance. What the client contributes is small, and easy to get wrong in exactly one way.

**At sign-up**, when your form shows the terms, send them with the credentials. The user is then never in the blocked state:

```typescript
await register(config, {
  email, password, teamName,
  latestConsents: { tos: TOS_VERSION, pp: PP_VERSION },
  consents: [{ tos: TOS_VERSION, pp: PP_VERSION }]
});
```

This works only when a JSON Schema is configured on the users collection — otherwise the server drops the extra properties and the user is registered without them.

**Afterwards** — someone who signed in with OAuth, where there was no form of yours to tick, or anyone who already had an account when the terms changed:

```typescript
const user = await acceptConsents(config, session.user._id);
```

That one call does three things: `PATCH /users/{_id}`, which the permission's `mergeRequest` turns into the versions and the timestamp *the server* chose; a token renewal; and a re-read of the user document, returned to you.

**The renewal is the part that is easy to miss.** The guard reads the token, and the token the user is holding was issued before they accepted. Write the acceptance without renewing and the rule keeps blocking them until that token expires — with the acceptance sitting in the database the whole time. `renewToken(config)` is exported separately for the same reason: whenever something the token carries changes underneath it.

**Reading the state.** `checkSession` and `getUserInfo` return the stored document, not the token's claims, so the extra fields are there whether or not you expose them as JWT claims:

```typescript
type AppUser = { latestConsents?: { tos: string; pp: string } };

const user = await checkSession<AppUser>(config);
const mustAccept = user !== null && user.latestConsents?.tos !== TOS_VERSION;
```

The guard, on the other hand, reads the claims — so the fields it tests must be in the service's JWT claim list.

## Types

```typescript
interface AuthConfig {
  apiBaseUrl: string;
}

type UserInfo<E extends object = Record<never, never>> = {
  _id: string;
  roles: string[];
  team?: { _id: { $oid: string }; role: string };
  profile?: { name?: string; surname?: string; avatarUrl?: string };
} & E

interface TeamMembership {
  id: { $oid: string };
  name?: string;
  role: 'owner' | 'member';
  active?: boolean;
}

interface Invitation {
  email: string;
  teamName: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  expiresAt: string;
}
```

## Framework adapters

- **Angular** → [`@restheart-cloud/kit-ng`](https://www.npmjs.com/package/@restheart-cloud/kit-ng) — signals, guards, interceptor
- React → `@restheart-cloud/kit-react` *(coming soon)*
