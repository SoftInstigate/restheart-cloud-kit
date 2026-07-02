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

Authentication is handled via a Bearer token stored in `localStorage` — every authenticated request sends `Authorization: Bearer <token>`. No cookies are used.

The token is stored in `localStorage` and expires within 15 minutes. Sessions survive page reloads but don't persist across browser sessions if the token has expired.

Token refresh is fully transparent: the kit schedules a proactive renewal at 80% of the token's TTL (~12 minutes). As long as the tab stays open, the session stays alive without the app or user noticing.

Errors are thrown as `{ status: number; message: string }`.

## API

### Auth

| Function | Description |
|---|---|
| `checkSession(config)` | Returns `UserInfo` if a valid token is held in memory, `null` otherwise |
| `register(config, payload)` | Sign up — creates user and team |
| `verify(config, email, token)` | Verify email after signup |
| `login(config, email, password)` | Email/password login — stores token in memory |
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
| `activate(config, payload)` | Activate account for a newly invited user |
| `acceptInvite(config, token)` | Accept invitation for an already registered user |
| `resendInvite(config, email)` | Resend an expired invitation |

### Password

| Function | Description |
|---|---|
| `forgotPassword(config, email)` | Request a reset link (always returns 202) |
| `resetPassword(config, payload)` | Apply the reset token |

### Multi-team

| Function | Description |
|---|---|
| `getTeams(config)` | List teams the authenticated user belongs to |
| `switchTeam(config, teamId)` | Switch active team |

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
