---
type: Package
title: "@restheart-cloud/kit-vue"
description: Vue adapter for RESTHeart Cloud Kit. Provides composables and navigation guards, plus a /nuxt subpath for Nuxt SSR support.
tags: [package, vue, adapter, composables, nuxt]
---

# @restheart-cloud/kit-vue

Vue adapter for `@restheart-cloud/kit`. Wraps the core authentication logic in a Vue plugin with composables and navigation guards. A `/nuxt` subpath adds Nuxt SSR support.

## Installation

```bash
npm install @restheart-cloud/kit-vue @restheart-cloud/kit
```

The core `@restheart-cloud/kit` is a regular dependency — pulled in automatically.

`vue-router` (for guards) and `h3` (for `/nuxt` subpath) are **optional peer dependencies**.

## Quick Start

### 1. Install Plugin

```ts
import { createRhAuth } from '@restheart-cloud/kit-vue';

const rhAuth = createRhAuth({ apiBaseUrl: import.meta.env.VITE_API_URL });
app.use(rhAuth);
```

### 2. Wire Guards

```ts
router.beforeEach(rhAuth.authGuard);
```

At creation the store runs `checkSession()` once, restoring the session before the first guard evaluates. Until it settles, `initializing.value` is `true`.

### 3. Use `useAuth` Composable

```vue
<script setup lang="ts">
import { useAuth } from '@restheart-cloud/kit-vue';
const auth = useAuth();
</script>

<template>
  <template v-if="auth.isAuthenticated.value">
    <span>{{ auth.user.value?.profile?.name }}</span>
    <TeamSwitcher v-if="auth.hasMultipleTeams.value" :teams="auth.teams.value" />
  </template>
</template>
```

## State (Vue Refs)

| Field | Type | Description |
|-------|------|-------------|
| `user` | `Ref<UserInfo \| null>` | Current authenticated user |
| `teams` | `Ref<TeamMembership[]>` | User's team memberships |
| `isAuthenticated` | `ComputedRef<boolean>` | Whether user is logged in |
| `initializing` | `Ref<boolean>` | True during initial `checkSession` |
| `hasMultipleTeams` | `ComputedRef<boolean>` | True if `teams.length > 1` |

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

## Nuxt Subpath (`/nuxt`)

```ts
import {
  // Server middleware
  rhAuthServerMiddleware,         // h3 middleware: refresh at 80% TTL, protected/public redirects
  type RhServerMiddlewareOptions,

  // Session handler
  createSessionHandler,           // POST/DELETE session cookie management
  type SessionHandlerOptions,

  // Server actions
  rhLogin,                        // server-side login (sets cookie)
  rhSwitchTeam,                   // server-side team switch
  rhActivate,                     // activate invitation account
  rhResetPassword,                // reset password with token
  rhLogout,                       // server-side logout (clears cookie)

  // Client utilities
  syncServerSession,              // POST token to session endpoint
  clearServerSession,             // DELETE session endpoint
  bridgeFragmentToCookie,         // reads #access_token, POSTs to session handler
  DEFAULT_SESSION_ENDPOINT,       // '/api/rh/session'

  // Session reading (server)
  getServerSession,               // read session from request cookie → UserInfo | null
  getServerSessionWithTeams,      // read session + load teams

  // Cookie utilities
  RH_SESSION_COOKIE,
  DEFAULT_COOKIE_OPTIONS,
  rhServerConfig,
  cookieMaxAge,
  resolveCookieOptions,
  type SessionCookieOptions,
  type ServerActionOptions,
} from '@restheart-cloud/kit-vue/nuxt';
```

The `/nuxt` subpath provides:
- **Server middleware** (`rhAuthServerMiddleware`): token refresh at 80% TTL, protected/public path redirects
- **Session handler** (`createSessionHandler`): session cookie management (POST writes cookie, DELETE clears)
- **Server actions** (`rhLogin`, `rhSwitchTeam`, `rhActivate`, `rhResetPassword`, `rhLogout`): server-side auth operations that set or clear the session cookie
- **Fragment→cookie bridge** (`bridgeFragmentToCookie`): reads `#access_token` from URL and POSTs to the session handler so the server can set a first-party cookie
- **Session readers** (`getServerSession`, `getServerSessionWithTeams`): read the current user from the request cookie in server context
- **Cookie utilities**: `RH_SESSION_COOKIE`, `DEFAULT_COOKIE_OPTIONS`, `rhServerConfig`, `cookieMaxAge`, `resolveCookieOptions`

<!-- openwiki: broken internal link [../architecture/overview.md#pluggable-token-source-sink] heading anchor "pluggable-token-source-sink" does not exist in "../architecture/overview.md". Fix the href or restore the target, then delete this comment. -->
Uses the core's [pluggable token source/sink](../architecture/overview.md#pluggable-token-source-sink) to read tokens from request cookies and capture tokens for cookie writes — no `localStorage` on the server.

### Source Map

| Source file | Responsibility |
|-------------|---------------|
| `src/create.ts` | `createRhAuth` Vue plugin |
| `src/store.ts` | `createRhAuthStore`, `RhAuthStore` interface |
| `src/use-auth.ts` | `useAuth` composable |
| `src/guards.ts` | `buildGuards` for vue-router |
| `src/keys.ts` | `RH_AUTH_KEY` injection key |
| `src/index.ts` | SPA barrel export |
| `src/nuxt/middleware.ts` | `rhAuthServerMiddleware` |
| `src/nuxt/handler.ts` | `createSessionHandler` |
| `src/nuxt/actions.ts` | `rhLogin`, `rhSwitchTeam`, `rhActivate`, `rhResetPassword`, `rhLogout` |
| `src/nuxt/session.ts` | `getServerSession`, `getServerSessionWithTeams` |
| `src/nuxt/client.ts` | `syncServerSession`, `clearServerSession`, `bridgeFragmentToCookie` |
| `src/nuxt/cookies.ts` | Cookie constants and resolution |
| `src/nuxt/index.ts` | `/nuxt` subpath barrel export |

## See Also

- [Core Kit](kit.md) — API reference for `@restheart-cloud/kit`
- [Adapter Contract](../testing/guide.md#adapter-unit-tests) — Shared test checklist
- [Token Delivery](../architecture/token-delivery.md) — Bearer vs cookie modes
