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

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Frontend App                         │
├─────────────────────────────────────────────────────────────┤
│  @restheart-cloud/kit-ng (Angular)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  RhAuthService                                        │  │
│  │  • Signals (user, teams, isAuthenticated)             │  │
│  │  • Route Guards (authGuard, publicGuard)              │  │
│  │  • HTTP Interceptor (Bearer token, 401 handling)      │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  @restheart-cloud/kit (Core)                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  • Auth flows (register, login, verify, logout)       │  │
│  │  • Token management (localStorage, proactive refresh) │  │
│  │  • Team operations (switch, create, manage members)   │  │
│  │  • Password reset & profile updates                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              RESTHeart Cloud Backend                         │
│  • MongoDB database                                         │
│  • REST API                                                 │
│  • Authentication & multi-tenancy                           │
│  • Managed infrastructure                                   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Navigation

### Architecture & Design
- **[Architecture Overview](architecture/overview.md)** — Monorepo structure, package layering, design principles
- **[Token Delivery](architecture/token-delivery.md)** — Bearer vs cookie modes, SSR considerations

### Packages
- **[Core Kit](packages/kit.md)** — API reference, configuration, authentication flows
- **[Angular Adapter](packages/kit-ng.md)** — RhAuthService, signals, guards, interceptor

### Development
- **[Testing Guide](testing/guide.md)** — Integration tests, environment setup, running tests
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
# Build both packages (kit first, then kit-ng)
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

### Team Multi-tenancy

Users can belong to multiple teams:
- Switch active team with `switchTeam()`
- Team context included in JWT claims
- Team-scoped operations (members, invitations)

### Framework Adapter Pattern

The architecture follows a layered pattern:
- **Core** (`kit`): All network calls, token operations, business rules
- **Adapters** (`kit-ng`): Reactive wrappers, framework-specific integration
- **Principle**: An adapter that reimplements an API call or token computation is a bug

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

## Version Information

- **Current version**: 0.0.0 (development)
- **Required RESTHeart**: 9.6.0+ (for `delivery=body` support)
- **Angular**: 21+ (peer dependency for kit-ng)
- **TypeScript**: 5+ (kit), 6+ (kit-ng)

## Backlog

- **React Adapter** (`@restheart-cloud/kit-react`) — Hooks, context, guard component
- **Vue Adapter** (`@restheart-cloud/kit-vue`) — Composables, navigation guards
- **Next.js Integration** — Middleware, route handlers, token refresh
- **Nuxt Integration** — Server middleware, route rules

## Support

- **Issues**: [GitHub Issues](https://github.com/SoftInstigate/restheart-cloud-kit/issues)
- **Documentation**: [RESTHeart Cloud Docs](https://cloud.restheart.com)
- **Starter App**: [restheart-cloud-starter-ng](https://github.com/SoftInstigate/restheart-cloud-starter-ng)
