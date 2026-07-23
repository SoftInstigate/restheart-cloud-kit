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

## Nuxt Subpath (`/nuxt`)

```ts
import { rhAuthEventHandler } from '@restheart-cloud/kit-vue/nuxt';
```

The `/nuxt` subpath provides:
- **Server middleware**: token refresh at 80% TTL, protected/public path redirects
- **Route handler**: session cookie management (POST/DELETE)
- **Server actions**: `rhLogin`, `rhSwitchTeam`, `rhActivate`, `rhResetPassword`
- **Fragment bridge**: reads `#access_token` and writes to first-party cookie

Uses the core's [pluggable token source/sink](../architecture/overview.md) to read tokens from request cookies and capture tokens for cookie writes — no `localStorage` on the server.

## See Also

- [Core Kit](kit.md) — API reference for `@restheart-cloud/kit`
- [Adapter Contract](../testing/guide.md#adapter-unit-tests) — Shared test checklist
- [Token Delivery](../architecture/token-delivery.md) — Bearer vs cookie modes
