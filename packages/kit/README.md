# @restheart-cloud/kit

Adds signup and login to your frontend — zero dependencies, works with Angular, React, Vue, or vanilla JS.

Covers every [`restheart-accounts`](https://restheart.org/docs/accounts) flow: signup, login, email verification, password reset — plus team management for apps that need it: invitations, member roles, multi-team switching.

Pairs with [RESTHeart Cloud](https://cloud.restheart.com), which gives you a production-ready backend — MongoDB, REST API, authentication, signup/signin, all managed.

## Installation

```bash
npm install @restheart-cloud/kit
```

## Usage

```typescript
import { checkSession, login, logout } from '@restheart-cloud/kit';

const config = { apiBaseUrl: 'https://api.example.com' };

const user = await checkSession(config);  // UserInfo | null
await login(config, 'user@example.com', 'secret');
await logout(config);
```

Authentication is handled via a Bearer token stored in `localStorage` — every authenticated request sends `Authorization: Bearer <token>`. This is the default (`mode: 'bearer'`) and works cross-origin.

Cookie authentication (`mode: 'cookie'`) is also supported, for same-origin setups: the backend manages an HttpOnly JWT cookie and no token ever touches `localStorage` or JavaScript. `apiFetch` always sends `credentials: 'include'`, so the cookie is sent on cross-origin requests too as long as the server's CORS config allows credentials for your origin.

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
| `register(config, payload)` | Sign up — creates user and team |
| `verify(config, email, token, delivery?)` | Verify email after signup — returns a URL for browser redirect (`delivery`: `'fragment'` (default) or `'cookie'`) |
| `login(config, email, password, mode?)` | Email/password login (`mode`: `'bearer'` (default) or `'cookie'`) |
| `logout(config)` | Clears the token and cancels pending refresh |

### Token management

| Function | Description |
|---|---|
| `setToken(token)` | Store a token manually (e.g. after OAuth redirect) |
| `getToken()` | Read the current token, or `null` |
| `clearToken()` | Clear the token and cancel any pending refresh |
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

## Types

```typescript
interface AuthConfig {
  apiBaseUrl: string;
}

interface UserInfo {
  _id: string;
  roles: string[];
  team: string;
  teams?: TeamMembership[];
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
}

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
