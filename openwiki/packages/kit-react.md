---
type: Package
title: "@restheart-cloud/kit-react"
description: React adapter for RESTHeart Cloud Kit. Provides context, hooks, and route guards, plus a /next subpath for Next.js SSR support.
tags: [package, react, adapter, hooks, nextjs]
---

# @restheart-cloud/kit-react

React adapter for `@restheart-cloud/kit`. Wraps the core authentication logic in React context with hooks and route guards. A `/next` subpath adds Next.js SSR support.

## Installation

```bash
npm install @restheart-cloud/kit-react
```

The core `@restheart-cloud/kit` is a regular dependency — pulled in automatically.

`react-router-dom` (for guards) and `next` (for `/next` subpath) are **optional peer dependencies**.

## Quick Start

### 1. Wrap App with Provider

```tsx
import { RhAuthProvider } from '@restheart-cloud/kit-react';

createRoot(document.getElementById('root')!).render(
  <RhAuthProvider config={{ apiBaseUrl: import.meta.env.VITE_API_URL }}>
    <App />
  </RhAuthProvider>
);
```

On mount the provider runs `checkSession()` once, restoring the session before the first guard evaluates. Until it settles, `initializing` is `true`.

### 2. Use `useAuth` Hook

```tsx
import { useAuth } from '@restheart-cloud/kit-react';

function Header() {
  const auth = useAuth();
  if (!auth.isAuthenticated) return null;
  return (
    <>
      <span>{auth.user?.profile?.name}</span>
      {auth.hasMultipleTeams && <TeamSwitcher teams={auth.teams} />}
    </>
  );
}
```

### 3. Protect Routes

```tsx
import { AuthGuard, PublicGuard } from '@restheart-cloud/kit-react';

<Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
<Route path="/login" element={<PublicGuard><Login /></PublicGuard>} />
```

## Hooks and Components

| Export | Type | Description |
|--------|------|-------------|
| `useAuth()` | Hook | Access all auth state and methods (see below) |
| `RhAuthProvider` | Component | Context provider, runs `checkSession` on mount |
| `AuthGuard` | Component | Redirects unauthenticated users to `/auth/login` |
| `PublicGuard` | Component | Redirects authenticated users into the app |

## Auth Methods

All methods are available on the `useAuth()` return value. These wrap `@restheart-cloud/kit` functions and update reactive state (`user`, `teams`) where applicable:

```ts
const auth = useAuth();

// Session
await auth.checkSession();              // → UserInfo | null
auth.clearSession();                    // clear token, cancel refresh, reset state

// Registration & verification
await auth.register({ email, password, teamName, firstName?, lastName? });
await auth.verify(email, token, delivery?);

// Login / logout
await auth.login(email, password, mode?);   // mode: 'bearer' (default) | 'cookie'
await auth.logout();

// Password
await auth.forgotPassword(email);
await auth.resetPassword({ email, token, password }, mode?);
await auth.changePassword(currentPassword, newPassword);

// Profile
await auth.updateProfile({ firstName?, lastName? });

// Teams
await auth.loadTeams();                 // → TeamMembership[]
await auth.switchTeam({ $oid }, mode?);
await auth.createTeam(teamName);        // → TeamMembership
await auth.updateTeam({ name?, description? });
await auth.deleteTeam();
await auth.listTeamMembers();           // → TeamMember[]
await auth.removeMember(email);
await auth.updateMemberRole(email, role);

// Invitations
await auth.invite(email, role);         // role: 'owner' | 'member'
await auth.getInvitation(email, token); // → Invitation
await auth.activate({ email, token, password }, mode?);
await auth.acceptInvite(token);
await auth.resendInvite(email);
await auth.listInvitations();           // → PendingInvitation[]
```

Methods that perform auto-login (`login`, `activate`, `resetPassword`, `switchTeam`) accept an optional `mode` parameter (`'bearer'` | `'cookie'`) that maps to the backend's `delivery` query parameter.

## Next.js Subpath (`/next`)

```ts
import {
  // Middleware
  rhAuthMiddleware,              // Next.js middleware: refresh at 80% TTL, protected/public redirects
  type RhMiddlewareOptions,

  // Route handler
  createSessionRoute,            // POST/DELETE session cookie management
  type SessionRouteOptions,

  // Server actions
  rhLogin,                       // server-side login (sets cookie)
  rhSwitchTeam,                  // server-side team switch
  rhActivate,                    // activate invitation account
  rhResetPassword,               // reset password with token
  rhLogout,                      // server-side logout (clears cookie)

  // Fragment→cookie bridge (client component)
  SessionSync,                   // React component: reads #access_token, POSTs to session route
  syncServerSession,             // programmatic: POST token to session endpoint
  clearServerSession,            // programmatic: DELETE session endpoint
  DEFAULT_SESSION_ENDPOINT,      // '/api/rh/session'

  // Session reading (server)
  getServerSession,              // read session from request cookie → UserInfo | null
  getServerSessionWithTeams,     // read session + load teams

  // Cookie utilities
  RH_SESSION_COOKIE,
  DEFAULT_COOKIE_OPTIONS,
  rhServerConfig,
  cookieMaxAge,
  resolveCookieOptions,
  type SessionCookieOptions,
  type ServerActionOptions,
} from '@restheart-cloud/kit-react/next';
```

The `/next` subpath provides:
- **Middleware** (`rhAuthMiddleware`): token refresh at 80% TTL, protected/public path redirects
- **Route handler** (`createSessionRoute`): session cookie management (POST writes cookie, DELETE clears)
- **Server actions** (`rhLogin`, `rhSwitchTeam`, `rhActivate`, `rhResetPassword`, `rhLogout`): server-side auth operations that set or clear the session cookie
- **Fragment→cookie bridge** (`SessionSync` client component): reads `#access_token` from URL and POSTs to the session route so the server can set a first-party cookie
- **Session readers** (`getServerSession`, `getServerSessionWithTeams`): read the current user from the request cookie in server components or middleware
- **Cookie utilities**: `RH_SESSION_COOKIE`, `DEFAULT_COOKIE_OPTIONS`, `rhServerConfig`, `cookieMaxAge`, `resolveCookieOptions`

Uses the core's [pluggable token source and sink](../architecture/overview.md#pluggable-token-source-and-sink) to read tokens from request cookies and capture tokens for cookie writes — no `localStorage` on the server.

### Source Map

| Source file | Responsibility |
|-------------|---------------|
| `src/context.tsx` | `RhAuthProvider`, `useAuth`, full `RhAuth` interface |
| `src/guards.tsx` | `AuthGuard`, `PublicGuard` components |
| `src/index.ts` | SPA barrel export |
| `src/next/middleware.ts` | `rhAuthMiddleware` |
| `src/next/route.ts` | `createSessionRoute` |
| `src/next/actions.ts` | `rhLogin`, `rhSwitchTeam`, `rhActivate`, `rhResetPassword`, `rhLogout` |
| `src/next/session.ts` | `getServerSession`, `getServerSessionWithTeams` |
| `src/next/sync.tsx` | `SessionSync`, `syncServerSession`, `clearServerSession` |
| `src/next/cookies.ts` | Cookie constants and resolution |
| `src/next/index.ts` | `/next` subpath barrel export |

## See Also

- [Core Kit](kit.md) — API reference for `@restheart-cloud/kit`
- [Adapter Contract](../testing/guide.md#adapter-unit-tests) — Shared test checklist
- [Token Delivery](../architecture/token-delivery.md) — Bearer vs cookie modes
