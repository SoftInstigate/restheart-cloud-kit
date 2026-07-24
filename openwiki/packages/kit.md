---
type: Package
title: "@restheart-cloud/kit"
description: Core authentication package with zero dependencies. Provides all auth flows, token management, team operations, and password reset functionality.
tags: [package, core, authentication, typescript]
---

# @restheart-cloud/kit

The core authentication package for RESTHeart Cloud. Framework-agnostic, zero dependencies, Promise-based API.

## Installation

```bash
npm install @restheart-cloud/kit
```

**Requirements**: RESTHeart 9.6.0+ (for `delivery=body` support in bearer mode)

## Quick Start

```typescript
import { checkSession, login, logout } from '@restheart-cloud/kit';

const config = { apiBaseUrl: 'https://api.example.com' };

// Check existing session
const user = await checkSession(config);  // UserInfo | null

// Login
await login(config, 'user@example.com', 'secret');

// Logout
await logout(config);
```

## Configuration

All functions accept an `AuthConfig` object:

```typescript
interface AuthConfig {
  apiBaseUrl: string;  // Must be *.restheart.com
}
```

**Validation**: `apiBaseUrl` must be a RESTHeart Cloud service URL (`*.restheart.com`). Invalid URLs throw an `ApiError`.

## Authentication Flows

### Registration

```typescript
import { register, verify, buildVerifyUrl } from '@restheart-cloud/kit';

// Step 1: Register
await register(config, {
  email: 'user@example.com',
  password: 'secure-password',
  teamName: 'My Team',
  firstName: 'John',  // optional
  lastName: 'Doe'     // optional
});

// Step 2: Build verification URL (sent via email)
const verifyUrl = buildVerifyUrl(config, email, token, 'fragment');

// Step 3: User clicks link, app handles redirect
// For fragment delivery: read token from URL hash
// For cookie delivery: token is set automatically
```

### Email Verification

```typescript
import { verify, buildVerifyUrl } from '@restheart-cloud/kit';

// Build URL for browser redirect
const url = await verify(config, email, token, 'fragment');

// Navigate to URL
window.location.href = url;
// Backend 302 redirects to frontend-app-url#access_token=...

// After redirect, read token from location.hash
const hashParams = new URLSearchParams(window.location.hash.slice(1));
const accessToken = hashParams.get('access_token');
if (accessToken) {
  setToken(accessToken);
}
```

### Login

```typescript
import { login } from '@restheart-cloud/kit';

// Bearer mode (default)
const user = await login(config, email, password);
// Token stored in localStorage, proactive refresh scheduled

// Cookie mode (same-origin only)
const user = await login(config, email, password, 'cookie');
// Backend sets HttpOnly JWT cookie
```

**Unverified account rejection**: After a successful login, the kit fetches user info and checks for the `$unauthenticated` role. If the account has not yet been email-verified, `login()` clears the stored token and throws `{ status: 403, message: 'Account not verified' }`. This applies to both bearer and cookie modes. Catch this error to prompt the user to verify their email before retrying.

### Session Check

```typescript
import { checkSession } from '@restheart-cloud/kit';

// Returns UserInfo if valid token exists, null otherwise
const user = await checkSession(config);
if (user) {
  console.log(user._id, user.roles, user.team);
}
```

**Unverified accounts**: If the server returns a user whose roles include `$unauthenticated` (i.e., the account was registered but never email-verified), `checkSession()` clears the token and returns `null` rather than returning an unusable user object.

### Logout

```typescript
import { logout } from '@restheart-cloud/kit';

// Clears token, cancels pending refresh
await logout(config);
```

## Token Management

### Manual Token Operations

```typescript
import { setToken, getToken, clearToken, getTokenExpiry } from '@restheart-cloud/kit';

// Store token (e.g., after OAuth redirect)
setToken(token);

// Read current token (null if expired or missing)
const token = getToken();

// Clear token and cancel refresh
clearToken();

// Get token expiration in milliseconds
const expMs = getTokenExpiry(token);
```

### Proactive Refresh

```typescript
import { scheduleRefresh, cancelRefresh } from '@restheart-cloud/kit';

// Schedule refresh at 80% of TTL (called automatically by login)
scheduleRefresh(config);

// Cancel pending refresh
cancelRefresh();
```

**Refresh Strategy**:
- Tokens expire after 15 minutes
- Refresh scheduled at 80% of TTL (~12 minutes)
- Automatic rescheduling after successful refresh
- Graceful degradation on failure (token expires naturally)

## Team Operations

### List Teams

```typescript
import { getTeams } from '@restheart-cloud/kit';

const teams = await getTeams(config);
// Returns: TeamMembership[]
// Each team has: id, name, description, role, active
```

### Switch Team

```typescript
import { switchTeam } from '@restheart-cloud/kit';

// Bearer mode (default)
await switchTeam(config, { $oid: teamId });
// New token with updated team claim stored in localStorage

// Cookie mode
await switchTeam(config, { $oid: teamId }, 'cookie');
// Backend updates cookie with new team claim
```

### Team Management

```typescript
import {
  listTeamMembers,
  removeMember,
  updateMemberRole,
  createTeam,
  updateTeam,
  deleteTeam
} from '@restheart-cloud/kit';

// List members of active team
const members = await listTeamMembers(config);

// Remove member (owner/admin only)
await removeMember(config, 'member@example.com');

// Update member role (owner/admin only)
await updateMemberRole(config, 'member@example.com', 'owner');

// Create new team
const newTeam = await createTeam(config, 'New Team Name');

// Update team (owner/admin only)
await updateTeam(config, { name: 'Updated Name', description: 'New description' });

// Delete team (owner only, must have no other members)
await deleteTeam(config);
```

## Invitation Flows

### Send Invitation

```typescript
import { invite } from '@restheart-cloud/kit';

await invite(config, 'newuser@example.com', 'member');
// Sends invitation email with token
```

### Get Invitation Details

```typescript
import { getInvitation } from '@restheart-cloud/kit';

const invitation = await getInvitation(config, email, token);
// Returns: { email, teamName, role, isNewUser, expiresAt }
```

### Activate Account (New User)

```typescript
import { activate } from '@restheart-cloud/kit';

// Bearer mode (default)
await activate(config, {
  email: 'newuser@example.com',
  token: 'invitation-token',
  password: 'new-password'
});
// Sets password, logs in, stores token

// Cookie mode
await activate(config, {
  email: 'newuser@example.com',
  token: 'invitation-token',
  password: 'new-password'
}, 'cookie');
// Backend sets cookie, no token in response
```

### Accept Invitation (Existing User)

```typescript
import { acceptInvite } from '@restheart-cloud/kit';

await acceptInvite(config, invitationToken);
// Adds user to team
```

### Resend Invitation

```typescript
import { resendInvite } from '@restheart-cloud/kit';

await resendInvite(config, 'user@example.com');
```

### List Pending Invitations

```typescript
import { listInvitations } from '@restheart-cloud/kit';

const invitations = await listInvitations(config);
// Returns: PendingInvitation[]
// Each has: email, role, isNewUser, createdAt, expiresAt, expired
```

## Password Management

### Forgot Password

```typescript
import { forgotPassword } from '@restheart-cloud/kit';

await forgotPassword(config, 'user@example.com');
// Sends password reset email
```

### Reset Password

```typescript
import { resetPassword } from '@restheart-cloud/kit';

// Bearer mode (default)
await resetPassword(config, {
  email: 'user@example.com',
  token: 'reset-token',
  password: 'new-password'
});
// Resets password, logs in, stores token

// Cookie mode
await resetPassword(config, {
  email: 'user@example.com',
  token: 'reset-token',
  password: 'new-password'
}, 'cookie');
// Backend sets cookie, no token in response
```

## Profile Management

```typescript
import { updateProfile, changePassword } from '@restheart-cloud/kit';

// Update profile fields
await updateProfile(config, {
  firstName: 'John',
  lastName: 'Doe'
});

// Change password (requires current password)
await changePassword(config, 'current-password', 'new-password');
```

## Error Handling

All functions throw `ApiError` on failure:

```typescript
interface ApiError {
  status: number;   // HTTP status code
  message: string;  // Error message from server
}

try {
  await login(config, email, password);
} catch (error) {
  if (error.status === 401) {
    console.error('Invalid credentials');
  } else if (error.status === 403) {
    console.error('Account not verified — check email');
  } else if (error.status === 400) {
    console.error('Validation error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Type Definitions

### UserInfo

```typescript
interface UserInfo {
  _id: string;
  roles: string[];
  team?: {
    _id: { $oid: string };
    role: string;
  };
  profile?: {
    name?: string;
    surname?: string;
    avatarUrl?: string;
  };
}
```

### TeamMembership

```typescript
interface TeamMembership {
  id: { $oid: string };
  name?: string;
  description?: string;
  role: 'owner' | 'member';
  active?: boolean;
}
```

### TeamMember

```typescript
interface TeamMember {
  email: string;
  name?: string;
  role: 'owner' | 'member';
  joinedAt: string;
}
```

### Invitation

```typescript
interface Invitation {
  email: string;
  teamName: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  expiresAt: string;
}
```

### PendingInvitation

```typescript
interface PendingInvitation {
  email: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  createdAt?: string;
  expiresAt?: string;
  expired?: boolean;
}
```

## Internal Architecture

### Module Structure

```
src/
├── client.ts      # Token storage, API fetch, URL validation
├── auth.ts        # Auth flows, proactive refresh, bearer delivery
├── team.ts        # Team operations
├── invite.ts      # Invitation flows
├── password.ts    # Password reset
├── profile.ts     # Profile updates
├── types.ts       # TypeScript interfaces
└── index.ts       # Public API exports
```

### Key Implementation Details

**Token Storage**: localStorage with in-memory fallback
- Graceful handling of localStorage unavailability
- Automatic cleanup on expiration

**API Fetch Wrapper**: `apiFetch()`
- Automatic Bearer token attachment
- Content-Type header management
- No-Auth-Challenge header (suppresses browser Basic Auth popup)
- Error parsing and ApiError throwing

**Proactive Refresh**: Module-scoped timer
- Survives across calls
- Cleared on logout or explicit session clear
- 80% of TTL scheduling

## Building

```bash
# Build from monorepo root
npm run build -w packages/kit

# Or from package directory
cd packages/kit
npm run build
```

**Output**: `dist/` directory with compiled JavaScript and type declarations

## Testing

See [Testing Guide](../testing/guide.md) for integration test setup and execution.

```bash
# Run integration tests
npm test -w packages/kit

# With HTML report
npm test -w packages/kit && ./packages/kit/open-report.sh
```

## Source Map

| File | Purpose |
|------|---------|
| `src/client.ts` | Token storage, API fetch wrapper, URL validation |
| `src/auth.ts` | Authentication flows, proactive refresh, bearer delivery |
| `src/team.ts` | Team CRUD, member management, team switching |
| `src/invite.ts` | Invitation send, accept, activate, list |
| `src/password.ts` | Forgot password, reset password |
| `src/profile.ts` | Profile updates, password change |
| `src/types.ts` | TypeScript interfaces for all data structures |
| `src/index.ts` | Public API re-exports |
