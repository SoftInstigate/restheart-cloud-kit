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

All calls use `credentials: 'include'` — authentication is handled via httpOnly JWT cookie.

Errors are thrown as `{ status: number; message: string }`.

## API

### Auth

| Function | Description |
|---|---|
| `checkSession(config)` | Returns `UserInfo` from the active JWT cookie, or `null` |
| `register(config, payload)` | Sign up — creates user and team |
| `verify(config, email, token)` | Verify email after signup |
| `login(config, email, password)` | Email/password login |
| `logout(config)` | Invalidates the cookie |

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
| `switchTeam(config, teamId)` | Switch active team, re-issues JWT cookie |

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
