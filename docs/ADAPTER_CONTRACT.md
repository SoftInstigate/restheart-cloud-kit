# Adapter test contract

The five adapter surfaces — `kit-ng`, `kit-react`, `kit-react/next`, `kit-vue`, `kit-vue/nuxt`
— expose the **same** behaviour over the core. That is exactly what lets one starter spec
serve all of them, and exactly what silently drifts. This file is the checklist each
adapter's unit tests must implement, so drift shows up as a red test instead of a support
ticket.

## Testing principle

The core (`@restheart-cloud/kit`) is integration-tested against a live RESTHeart Cloud
instance — it owns the network and the business rules. **Adapter tests must not re-test that.**
They mock the core and assert only the *wiring*: which core call fires, and how the reactive
state (signals / context / refs) and the framework glue (guards, middleware, cookies) react.

- Fast, deterministic, **no backend and no secrets** → runs on every push.
- Mock `@restheart-cloud/kit` wholesale; drive return values per case.

`kit-react` is the reference implementation of this file (`packages/kit-react/src/**/*.test.*`).

## A. Reactive contract — every SPA adapter

| # | Scenario | Expected |
|---|---|---|
| A1 | bootstrap, no token | `user=null`, `isAuthenticated=false`, **no HTTP call** (`checkSession`/`getTeams` never invoked) |
| A2 | bootstrap, valid token | loads `user` **and** `teams` |
| A3 | `login` | sets `user` **and** loads `teams` in the same flow |
| A4 | `logout` | clears `user` and `teams` |
| A5 | `switchTeam` | re-runs `checkSession` (fresh team claim) |
| A6 | `updateProfile` | re-runs `checkSession` |
| A7 | `acceptInvite` | reloads `teams` |
| A8 | `clearSession` | wipes state, calls `clearToken` + `cancelRefresh` |
| A9 | `hasMultipleTeams` | `true` iff `teams.length > 1` |

## B. Guards — every SPA adapter

| # | Scenario | Expected |
|---|---|---|
| B1 | `authGuard`, unauthenticated | redirect to `/auth/login` |
| B2 | `authGuard`, authenticated | allow |
| B3 | `publicGuard`, authenticated | redirect into the app |
| B4 | `publicGuard`, unauthenticated | allow |
| B5 | `/invitations/accept` | reachable under **neither** guard (checked at the starter level) |

## C. Token lifecycle

| # | Scenario | Expected |
|---|---|---|
| C1 | a 401 from an app request | session cleared (ng interceptor; other adapters as applicable) |

## D. SSR extras — `*/next` and `*/nuxt` only

| # | Scenario | Expected |
|---|---|---|
| D1 | middleware, token past 80% TTL | calls `/token?renew`, rewrites `Set-Cookie` |
| D2 | middleware, fresh token | no renew, cookie untouched |
| D3 | middleware, protected path, no session | redirect to login (before render) |
| D4 | middleware, public-only path, has session | redirect into the app |
| D5 | session route `POST { accessToken }` | writes the first-party cookie (maxAge from `exp`) |
| D6 | session route `POST` missing token | `400` |
| D7 | session route `DELETE` | clears the cookie |
| D8 | `rhLogin` / `rhSwitchTeam` / `rhActivate` / `rhResetPassword` | token captured via the `setToken` sink is written to the cookie |
| D9 | `rhLogout` | clears the cookie |
| D10 | fragment bridge | reads `#access_token`, POSTs it, strips the hash |

## Rollout status

| Adapter | A | B | C | D |
|---|---|---|---|---|
| `kit-react` | ✅ | ✅ | n/a | — |
| `kit-react/next` | — | — | — | D1–D9 ✅, D10 pending |
| `kit-vue` | ✅ | ✅ | n/a | — |
| `kit-vue/nuxt` | — | — | — | D1–D9 ✅, D10 pending |
| `kit-ng` | ✅ | ✅ | C1 ✅ | n/a |

## CI

Adapter unit tests need no secrets, so they run on every push — separate from the
core's gated live integration tests:

```yaml
# unit tests job
- run: npm ci
- run: npm run build                    # adapters compile against kit/dist
- run: npm test --workspaces --if-present
```

(Scope the workspace test run to the adapters, or keep the core's `test` script gated behind
its `.env`, so this job never needs the live instance.)
