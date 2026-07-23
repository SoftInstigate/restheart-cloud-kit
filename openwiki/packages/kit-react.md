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
| `useAuth()` | Hook | Access auth state: `user`, `teams`, `isAuthenticated`, `initializing`, `hasMultipleTeams` |
| `RhAuthProvider` | Component | Context provider, runs `checkSession` on mount |
| `AuthGuard` | Component | Redirects unauthenticated users to `/auth/login` |
| `PublicGuard` | Component | Redirects authenticated users into the app |

## Auth Methods

All methods are available on the `useAuth()` return value:

```ts
const auth = useAuth();
await auth.login(email, password);
await auth.register({ email, password, teamName });
await auth.logout();
await auth.switchTeam(teamId);
await auth.updateProfile(fields);
await auth.acceptInvite(token);
auth.clearSession();
```

## Next.js Subpath (`/next`)

```ts
import { rhAuthMiddleware } from '@restheart-cloud/kit-react/next';
```

The `/next` subpath provides:
- **Middleware**: token refresh at 80% TTL, protected/public path redirects
- **Route handlers**: session cookie management (POST/DELETE)
- **Server actions**: `rhLogin`, `rhSwitchTeam`, `rhActivate`, `rhResetPassword`
- **Fragment bridge**: reads `#access_token` from URL and writes to first-party cookie

Uses the core's [pluggable token source/sink](../architecture/overview.md) to read tokens from request cookies and capture tokens for cookie writes — no `localStorage` on the server.

## See Also

- [Core Kit](kit.md) — API reference for `@restheart-cloud/kit`
- [Adapter Contract](../testing/guide.md#adapter-unit-tests) — Shared test checklist
- [Token Delivery](../architecture/token-delivery.md) — Bearer vs cookie modes
