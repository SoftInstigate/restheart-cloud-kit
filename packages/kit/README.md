# @restheart-cloud/kit

TypeScript client for RESTHeart Cloud. Zero framework dependencies — works with Angular, React, Vue, or vanilla JS.

Implements all [`restheart-accounts`](https://restheart.org/docs/accounts) flows: signup, login, email verification, invitations, password reset, OAuth, multi-team.

## Installation

```bash
npm install @restheart-cloud/kit
```

## Usage

```typescript
import { checkSession, register, logout } from '@restheart-cloud/kit';

const config = { apiBaseUrl: 'https://api.example.com' };

const user = await checkSession(config);
```

## API

### Auth

| Function | Description |
|---|---|
| `checkSession(config)` | Check the current session from the JWT cookie |
| `register(config, payload)` | Sign up — creates user and team |
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
| `getTenants(config)` | List teams the authenticated user belongs to |
| `switchTenant(config, tenantId)` | Switch active team, re-issues JWT cookie |

## Types

```typescript
interface UserInfo {
  _id: string;
  roles: string[];
  tenant: string;
  tenants?: TenantMembership[];
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
}

interface TenantMembership {
  id: { $oid: string };
  name?: string;
  role: 'owner' | 'member';
  active?: boolean;
}

interface Invitation {
  email: string;
  orgName: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  expiresAt: string;
}
```

## Framework adapters

- Angular → [`@restheart-cloud/kit-ng`](../kit-ng)
- React → `@restheart-cloud/kit-react` (coming soon)
