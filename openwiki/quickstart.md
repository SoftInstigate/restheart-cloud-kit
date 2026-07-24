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
- **[Adapter Contract & Roadmap](../docs/ADAPTERS.md)** — Framework adapter specifications
- **[Starter App](https://github.com/SoftInstigate/restheart-cloud-starter-ng)** — Angular starter template

## Getting Started

### 1. Prerequisites

- Node.js 18+ (recommended: 22)
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

### Framework Adapter Pattern

The architecture follows a layered pattern:
- **Core** (`kit`): All network calls, token operations, business rules
- **Adapters** (`kit-ng`, `kit-react`, `kit-vue`): Reactive wrappers, framework-specific integration
- **SSR subpaths** (`kit-react/next`, `kit-vue/nuxt`): Server-side token management via pluggable token source/sink
- **Principle**: An adapter that reimplements an API call or token computation is a bug

See **[docs/ADAPTERS.md](../docs/ADAPTERS.md)** for the full adapter contract and **[docs/ADAPTER_CONTRACT.md](../docs/ADAPTER_CONTRACT.md)** for the shared test checklist.

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
- **TypeScript**: 5+ (kit), 6+ (adapters)
- **Vitest**: 4 (all adapter unit tests)

## Support

- **Issues**: [GitHub Issues](https://github.com/SoftInstigate/restheart-cloud-kit/issues)
- **Documentation**: [RESTHeart Cloud Docs](https://cloud.restheart.com)
- **Starter App**: [restheart-cloud-starter-ng](https://github.com/SoftInstigate/restheart-cloud-starter-ng)
