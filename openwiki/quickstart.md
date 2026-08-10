---
type: Documentation
title: RESTHeart Cloud Kit - Quickstart
description: Entry point for understanding the RESTHeart Cloud Kit monorepo, its architecture, packages, and how to get started with development.
tags: [quickstart, overview, getting-started]
---

# RESTHeart Cloud Kit

A TypeScript SDK for adding authentication to frontend applications that use [RESTHeart Cloud](https://cloud.restheart.com) as their backend.

## What is RESTHeart Cloud Kit?

RESTHeart Cloud Kit provides the same speed on the frontend that RESTHeart Cloud gives you on the backend. It's a monorepo containing:

- **`@restheart-cloud/kit`** — Framework-agnostic core with zero dependencies. Handles all authentication logic: signup, login, email verification, password reset, team management, and multi-team switching.
- **`@restheart-cloud/kit-ng`** — Angular adapter with signals, route guards, and HTTP interceptor. Wraps the core kit.
- **`@restheart-cloud/kit-react`** — React adapter with context, hooks, and route guards. Includes a `/next` subpath for Next.js SSR support (middleware, route handlers, server actions).
- **`@restheart-cloud/kit-vue`** — Vue adapter with composables and navigation guards. Includes a `/nuxt` subpath for Nuxt SSR support.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Your Frontend App                               │
├─────────────────────────────────────────────────────────────────────┤
│  Framework Adapters (reactive wrappers)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  kit-ng      │  │  kit-react   │  │  kit-vue     │              │
│  │  (Angular)   │  │  (React)     │  │  (Vue)       │              │
│  │  signals,    │  │  hooks,      │  │  composables,│              │
│  │  guards,     │  │  context,    │  │  navigation  │              │
│  │  interceptor │  │  guards      │  │  guards      │              │
│  │              │  │  + /next     │  │  + /nuxt     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └─────────────────┼─────────────────┘                       │
│                           ▼                                         │
│  @restheart-cloud/kit (Core)                                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  • Auth flows (register, login, verify, logout)               │  │
│  │  • Token management (localStorage, proactive refresh)         │  │
│  │  • Team operations (switch, create, manage members)           │  │
│  │  • Password reset & profile updates                           │  │
│  │  • Pluggable token source/sink (for SSR runtimes)             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              RESTHeart Cloud Backend                                 │
│  • MongoDB database                                                  │
│  • REST API                                                          │
│  • Authentication & multi-tenancy                                    │
│  • Managed infrastructure                                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Navigation

### Architecture & Design
- **[Architecture Overview](architecture/overview.md)** — Monorepo structure, package layering, design principles
- **[Token Delivery](architecture/token-delivery.md)** — Bearer vs cookie modes, SSR considerations

### Packages
- **[Core Kit](packages/kit.md)** — API reference, configuration, authentication flows
- **[Angular Adapter](packages/kit-ng.md)** — RhAuthService, signals, guards, interceptor
- **[React Adapter](packages/kit-react.md)** — Hooks, context, guards, Next.js `/next` subpath
- **[Vue Adapter](packages/kit-vue.md)** — Composables, navigation guards, Nuxt `/nuxt` subpath

### Development
- **[Testing Guide](testing/guide.md)** — Core integration tests and adapter unit tests
- **[Release Process](deployment/release.md)** — Tag-driven releases, CI/CD pipeline
- **[Contributing](contributing/development.md)** — Local setup, workspace configuration, debugging

### External Resources
- **[RESTHeart Cloud Documentation](https://cloud.restheart.com)**
- **[Adapter Contract & Roadmap](https://github.com/SoftInstigate/restheart-cloud-kit/blob/main/docs/ADAPTERS.md)** — Framework adapter specifications
- **[Starter App](https://github.com/SoftInstigate/restheart-cloud-starter-ng)** — Angular starter template

## Task Routing

Use this table to find the right starting point for common change types:

| Change area | Wiki page | Source entry points | Important symbols | Focused tests | Validation |
|------------|-----------|--------------------|--------------------|--------------|------------|
| Auth flow (register, login, verify, logout) | [Core Kit](packages/kit.md#authentication-flows) | `packages/kit/src/auth.ts` | `register`, `login`, `verify`, `checkSession`, `applyBearerDelivery` | `packages/kit/src/__tests__/integration/auth.test.ts` | `npm test -w packages/kit` |
| Token management & refresh | [Core Kit](packages/kit.md#token-management) | `packages/kit/src/client.ts`, `packages/kit/src/auth.ts` | `setToken`, `getToken`, `clearToken`, `scheduleRefresh`, `cancelRefresh` | `packages/kit/src/__tests__/integration/auth.test.ts` | `npm test -w packages/kit` |
| Team operations | [Core Kit](packages/kit.md#team-operations) | `packages/kit/src/team.ts` | `getTeams`, `switchTeam`, `createTeam`, `listTeamMembers` | `packages/kit/src/__tests__/integration/team.test.ts`, `team-management.test.ts` | `npm test -w packages/kit` |
| Invitations | [Core Kit](packages/kit.md#invitation-flows) | `packages/kit/src/invite.ts` | `invite`, `activate`, `acceptInvite`, `listInvitations` | `packages/kit/src/__tests__/integration/invite.test.ts` | `npm test -w packages/kit` |
| Password reset | [Core Kit](packages/kit.md#password-management) | `packages/kit/src/password.ts` | `forgotPassword`, `resetPassword` | `packages/kit/src/__tests__/integration/password.test.ts` | `npm test -w packages/kit` |
| Profile updates | [Core Kit](packages/kit.md#profile-management) | `packages/kit/src/profile.ts` | `updateProfile`, `updateUser`, `changePassword` | `packages/kit/src/__tests__/integration/profile.test.ts` | `npm test -w packages/kit` |
| Consents gating | [Core Kit — Consents](packages/kit.md#consents-gating) | `packages/kit/src/consents.ts` | `acceptConsents` | `packages/kit/src/__tests__/integration/consents.test.ts` | `npm test -w packages/kit` |
| Angular adapter (signals, guards, interceptor) | [Angular Adapter](packages/kit-ng.md) | `packages/kit-ng/src/auth.service.ts`, `auth.guard.ts`, `auth.interceptor.ts` | `RhAuthService`, `authGuard`, `provideRhAuth` | `packages/kit-ng/src/__tests__/` | `npm test -w packages/kit-ng` |
| React adapter (hooks, context, guards) | [React Adapter](packages/kit-react.md) | `packages/kit-react/src/context.tsx`, `guards.tsx` | `useAuth`, `RhAuthProvider`, `AuthGuard` | `packages/kit-react/src/__tests__/` | `npm test -w packages/kit-react` |
| Next.js SSR (middleware, route handlers, server actions) | [React Adapter — /next](packages/kit-react.md#nextjs-subpath-next) | `packages/kit-react/src/next/` | `rhAuthMiddleware`, `createSessionRoute`, `rhLogin`, `SessionSync` | `packages/kit-react/src/next/__tests__/` | `npm test -w packages/kit-react` |
| Vue adapter (composables, guards) | [Vue Adapter](packages/kit-vue.md) | `packages/kit-vue/src/store.ts`, `create.ts`, `guards.ts` | `createRhAuth`, `useAuth`, `buildGuards` | `packages/kit-vue/src/__tests__/` | `npm test -w packages/kit-vue` |
| Nuxt SSR (middleware, handler, bridge) | [Vue Adapter — /nuxt](packages/kit-vue.md#nuxt-subpath-nuxt) | `packages/kit-vue/src/nuxt/` | `rhAuthServerMiddleware`, `createSessionHandler`, `bridgeFragmentToCookie` | `packages/kit-vue/src/nuxt/__tests__/` | `npm test -w packages/kit-vue` |
| Token delivery (bearer vs cookie) | [Token Delivery](architecture/token-delivery.md) | `packages/kit/src/auth.ts`, `packages/kit/src/client.ts` | `applyBearerDelivery`, `persistToken`, `LoginMode` | `packages/kit/src/__tests__/integration/auth.test.ts` | `npm test -w packages/kit` |
| Package publishing / release | [Release Process](deployment/release.md) | `.github/workflows/release.yml` | tag-driven versioning | Integration tests (gated) | `git tag X.Y.Z && git push origin X.Y.Z` |
| Types & interfaces | [Core Kit](packages/kit.md#type-definitions) | `packages/kit/src/types.ts` | `UserInfo<E>`, `TeamMembership`, `AuthConfig`, `ApiError`, `LoginMode` | All integration tests | `npm run build` |

## Getting Started

### 1. Prerequisites

- Node.js 22.22.3+ (required by Angular 22 CLI for `kit-ng` tests)
- npm 9+ (workspaces support)
- A RESTHeart Cloud service ([sign up](https://cloud.restheart.com))

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/SoftInstigate/restheart-cloud-kit.git
cd restheart-cloud-kit

# Install dependencies
npm install
```

### 3. Build

```bash
# Build all packages (kit first, then adapters)
npm run build
```

### 4. Run Tests

Integration tests require a RESTHeart Cloud instance:

```bash
# Create packages/kit/.env (not committed)
cat > packages/kit/.env << EOF
RH_TEST_API_URL=https://<your-instance>.restheart.com
RH_TEST_ADMIN_PASSWORD=<root-password>
EOF

# Run integration tests
npm test -w packages/kit
```

Adapter unit tests need no backend:

```bash
npm run build   # adapters resolve @restheart-cloud/kit from its built dist
npm test -w packages/kit-react -w packages/kit-vue -w packages/kit-ng
```

### 5. Local Development with Starter App

For developing against a local Angular app:

```bash
# Link packages locally
npm link -w packages/kit
cd packages/kit-ng/dist && npm link

# In your Angular starter app
npm link @restheart-cloud/kit @restheart-cloud/kit-ng
```

## Key Concepts

### Authentication Modes

The kit supports two authentication modes:

1. **Bearer Token** (default) — Token stored in `localStorage`, sent as `Authorization: Bearer <token>`. Works cross-origin.
2. **Cookie** — JWT managed by backend as HttpOnly cookie. Only works same-origin (app and API on same domain).

**Important**: RESTHeart Cloud services live on `*.restheart.com`, so cookie mode is not available for normal deployments. Use bearer mode unless you have a same-origin setup.

### Token Lifecycle

- Tokens expire after 15 minutes
- Proactive refresh at 80% of TTL (~12 minutes)
- Sessions survive page reloads but not browser sessions if token expires
- Automatic cleanup on 401 responses
- **Unverified accounts**: Users with the `$unauthenticated` role (registered but not email-verified) are rejected by `login()` (throws 403) and `checkSession()` (returns null). See [Core Kit — Login](packages/kit.md#login).

### Team Multi-tenancy

Users can belong to multiple teams:
- Switch active team with `switchTeam()`
- Team context included in JWT claims
- Team-scoped operations (members, invitations)

### Consents Gating

Applications can gate access behind a user's acceptance of terms of service, privacy policy, or any other consent. The pattern:

1. A guard rule blocks requests from users who have not accepted the current consent versions.
2. An ACL permission on `PATCH /users/{userId}` — scoped with `bson-request-whitelist` — exempts the one call that records the acceptance.
3. `acceptConsents()` calls `updateUser()` then `renewToken()` so the guard sees the updated claims.

**Key invariant**: the server decides which versions are stamped and when — the client body carries only the whitelisted key. See [Core Kit — Consents Gating](packages/kit.md#consents-gating) for the full API.

### Framework Adapter Pattern

The architecture follows a layered pattern:
- **Core** (`kit`): All network calls, token operations, business rules
- **Adapters** (`kit-ng`, `kit-react`, `kit-vue`): Reactive wrappers, framework-specific integration
- **SSR subpaths** (`kit-react/next`, `kit-vue/nuxt`): Server-side token management via pluggable token source/sink
- **Principle**: An adapter that reimplements an API call or token computation is a bug

See **[docs/ADAPTERS.md](https://github.com/SoftInstigate/restheart-cloud-kit/blob/main/docs/ADAPTERS.md)** for the full adapter contract and **[docs/ADAPTER_CONTRACT.md](https://github.com/SoftInstigate/restheart-cloud-kit/blob/main/docs/ADAPTER_CONTRACT.md)** for the shared test checklist.

## Common Workflows

### User Registration Flow

```typescript
import { register, verify, buildVerifyUrl } from '@restheart-cloud/kit';

// 1. Register
await register(config, { email, password, teamName: 'My Team' });

// 2. Build verification URL (sent via email)
const verifyUrl = buildVerifyUrl(config, email, token, 'fragment');

// 3. User clicks link, app reads token from URL hash
// 4. Store token
setToken(token);
```

### Angular Integration

```typescript
import { provideRhAuth } from '@restheart-cloud/kit-ng';

// In app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRhAuth({ apiBaseUrl: environment.apiUrl }),
  ],
};

// In component
@Component({
  template: `
    @if (auth.isAuthenticated()) {
      <span>{{ auth.user()?.profile?.name }}</span>
    }
  `
})
export class AppComponent {
  auth = inject(RhAuthService);
}
```

### React Integration

```tsx
import { RhAuthProvider, useAuth } from '@restheart-cloud/kit-react';

// Near app root
createRoot(document.getElementById('root')!).render(
  <RhAuthProvider config={{ apiBaseUrl: import.meta.env.VITE_API_URL }}>
    <App />
  </RhAuthProvider>
);

// In component
function Header() {
  const auth = useAuth();
  if (!auth.isAuthenticated) return null;
  return <span>{auth.user?.profile?.name}</span>;
}
```

### Vue Integration

```ts
import { createRhAuth, useAuth } from '@restheart-cloud/kit-vue';

// main.ts
const rhAuth = createRhAuth({ apiBaseUrl: import.meta.env.VITE_API_URL });
app.use(rhAuth);

// Component
const auth = useAuth();
// auth.isAuthenticated.value, auth.user.value, auth.teams.value
```

## Version Information

- **Current version**: 0.0.0 (development, tag-driven releases)
- **Required RESTHeart**: 9.6.0+ (for `delivery=body` support)
- **Node**: 22.22.3+ (required by Angular 22 CLI for `kit-ng` tests)
- **Angular**: 21+ (peer dependency for kit-ng)
- **TypeScript**: 5+ (kit, kit-react, kit-vue), 6+ (kit-ng, Angular 22 CLI requirement)
- **Vitest**: 4 (all adapter unit tests)

## Support

- **Issues**: [GitHub Issues](https://github.com/SoftInstigate/restheart-cloud-kit/issues)
- **Documentation**: [RESTHeart Cloud Docs](https://cloud.restheart.com)
- **Starter App**: [restheart-cloud-starter-ng](https://github.com/SoftInstigate/restheart-cloud-starter-ng)
