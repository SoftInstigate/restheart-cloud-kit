# @restheart-cloud/kit-vue

Wraps [`@restheart-cloud/kit`](https://www.npmjs.com/package/@restheart-cloud/kit) in a Vue plugin with composables and navigation guards. A [`/nuxt`](#nuxt-subpath) subpath adds server-side rendering support for Nuxt.

Pairs with [RESTHeart Cloud](https://cloud.restheart.com), which gives you a production-ready backend — MongoDB, REST API, authentication, signup/signin, all managed.

## Installation

```bash
npm install @restheart-cloud/kit-vue @restheart-cloud/kit
```

`vue-router` (for the guards) and `h3` (for the `/nuxt` subpath) are **optional peer dependencies** — install them only if you use those parts.

## Setup

```ts
// main.ts
import { createRhAuth } from '@restheart-cloud/kit-vue';

const rhAuth = createRhAuth({ apiBaseUrl: import.meta.env.VITE_API_URL });
app.use(rhAuth);

// router.ts — wire the guards
router.beforeEach(rhAuth.authGuard);
```

At creation the store runs `checkSession()` once, so a page reload restores the session before the first guard evaluates. Until it settles, `initializing.value` is `true`.

## How sessions work

Same two modes as the core kit:

- **Bearer token** (default) — stored in `localStorage`, sent as `Authorization: Bearer <token>`.
- **Cookie** — JWT managed by the backend as an HttpOnly cookie, **same-origin only**.

Pass `mode: 'cookie'` to `login()`, `activate()`, `resetPassword()`, or `switchTeam()` only when the app is served from the same origin as the service. Since a RESTHeart Cloud service lives on `*.restheart.com` while your app lives on your own domain, that cookie is third-party and blocked by default in Safari and Firefox. **Cross-origin apps, the normal case, should stay on the default `'bearer'` mode.**

## `useAuth`

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

### State (Vue refs)

| Field | Type | Description |
|---|---|---|
| `user` | `Ref<UserInfo \| null>` | Authenticated user (`user._id` is the email) |
| `teams` | `Ref<TeamMembership[]>` | Teams the user belongs to |
| `isAuthenticated` | `ComputedRef<boolean>` | Derived from `user` |
| `hasMultipleTeams` | `ComputedRef<boolean>` | `true` when the user has more than one team |
| `initializing` | `Ref<boolean>` | `true` until the initial session check settles |

### Methods

All methods return Promises and update the shared state — the same surface as `kit-ng` and `kit-react`:

```ts
auth.checkSession()  auth.login(email, password, mode?)  auth.logout()  auth.register(payload)
auth.verify(email, token, delivery?)  auth.forgotPassword(email)  auth.resetPassword(payload, mode?)
auth.updateProfile(updates)  auth.changePassword(current, next)
auth.invite(email, role)  auth.getInvitation(email, token)  auth.activate(payload, mode?)
auth.acceptInvite(token)  auth.resendInvite(email)  auth.listInvitations()
auth.loadTeams()  auth.switchTeam(teamId, mode?)
auth.listTeamMembers()  auth.removeMember(email)  auth.updateMemberRole(email, role)
auth.createTeam(teamName)  auth.updateTeam(updates)  auth.deleteTeam()  auth.clearSession()
```

## Guards

`createRhAuth()` exposes `vue-router` navigation guards bound to the store:

```ts
router.beforeEach(rhAuth.authGuard);   // global — redirects to /auth/login when unauthenticated

// or per route:
const routes = [
  { path: '/app', component: Shell, beforeEnter: rhAuth.authGuard },
  { path: '/auth/login', component: Login, beforeEnter: rhAuth.publicGuard },
  // /invitations/accept stays unguarded — it must work signed out, signed in, or with no account
];
```

## Nuxt subpath

For Nuxt apps, `@restheart-cloud/kit-vue/nuxt` adds the server pieces the SPA adapter can't cover — see [docs/ADAPTERS.md](../../docs/ADAPTERS.md).

```ts
// server/middleware/rh-auth.ts — proactive refresh + guards before render
import { rhAuthServerMiddleware } from '@restheart-cloud/kit-vue/nuxt';
export default rhAuthServerMiddleware(config, {
  isProtected: (p) => p.startsWith('/app'),
  isPublicOnly: (p) => p.startsWith('/auth'),
});
```

```ts
// server/api/rh/session.ts — writes/clears the first-party session cookie
import { createSessionHandler } from '@restheart-cloud/kit-vue/nuxt';
export default createSessionHandler();
```

```ts
// server/api/me.get.ts — read the session on the server, no client waterfall
import { getServerSession } from '@restheart-cloud/kit-vue/nuxt';
export default defineEventHandler((event) => getServerSession(event, config));
```

| Export | Purpose |
|---|---|
| `rhAuthServerMiddleware(config, opts)` | Refresh the cookie past 80% TTL; guards as redirects |
| `getServerSession(event, config)` / `getServerSessionWithTeams` | Read the session in server code |
| `rhServerConfig(event, config)` | An `AuthConfig` whose token source is the request cookie |
| `createSessionHandler(opts)` | `POST`/`DELETE` handler that sets/clears the cookie |
| `rhLogin` / `rhSwitchTeam` / `rhActivate` / `rhResetPassword` / `rhLogout` | Server handlers: run the core call and rewrite the session cookie from the event |
| `bridgeFragmentToCookie()` | Client: read `#access_token` and sync it into the cookie |
| `syncServerSession(token)` / `clearServerSession()` | Sync/clear the cookie after client-side `login`/`switchTeam`/`logout` |

The server handlers take the h3 `event`, so the credentials never leave the server:

```ts
// server/api/login.post.ts
import { rhLogin } from '@restheart-cloud/kit-vue/nuxt';
export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event);
  return rhLogin(event, config, email, password); // sets the cookie, returns the user
});
```

> The cookie is a first-party container for the same JWT a SPA keeps in `localStorage` — not a security upgrade. The gains are architectural: server routes render authenticated data with no waterfall, and guards run in server middleware so there's no unauthenticated flash.

## Quickstart

1. Create a service on [RESTHeart Cloud](https://cloud.restheart.com)
2. Set `apiBaseUrl` to your service URL
3. `app.use(createRhAuth(config))` and use `useAuth()` in components
