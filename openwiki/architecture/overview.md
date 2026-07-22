---
type: Architecture
title: Architecture Overview
description: Technical architecture of the RESTHeart Cloud Kit monorepo, including package structure, layering, and design principles.
tags: [architecture, monorepo, design, layering]
---

# Architecture Overview

This document explains the technical architecture of the RESTHeart Cloud Kit monorepo, its package structure, and the design principles that guide development.

## Repository Structure

```
restheart-cloud-kit/
├── packages/
│   ├── kit/                    # @restheart-cloud/kit (core)
│   │   ├── src/
│   │   │   ├── auth.ts         # Authentication flows
│   │   │   ├── client.ts       # Token management, API fetch
│   │   │   ├── invite.ts       # Invitation operations
│   │   │   ├── password.ts     # Password reset flows
│   │   │   ├── profile.ts      # User profile updates
│   │   │   ├── team.ts         # Team management
│   │   │   ├── types.ts        # TypeScript interfaces
│   │   │   └── index.ts        # Public API exports
│   │   └── __tests__/
│   │       └── integration/    # Integration tests
│   │
│   └── kit-ng/                 # @restheart-cloud/kit-ng (Angular)
│       ├── src/
│       │   ├── auth.service.ts # Angular service
│       │   ├── auth.guard.ts   # Route guards
│       │   ├── auth.interceptor.ts # HTTP interceptor
│       │   ├── provide-rh-auth.ts  # DI setup
│       │   ├── tokens.ts       # Injection tokens
│       │   └── index.ts        # Public API
│       └── ng-package.json     # Angular packaging config
│
├── docs/
│   └── ADAPTERS.md             # Framework adapter contract
│
├── .github/workflows/
│   ├── release.yml             # Tag-driven release pipeline
│   ├── integration-test.yml    # Manual test trigger
│   └── openwiki-update.yml     # Documentation updates
│
└── rebuild-kit-ng.sh           # Local development helper
```

## Package Layering

The monorepo follows a strict layered architecture:

### Layer 1: Core (`@restheart-cloud/kit`)

**Purpose**: Framework-agnostic authentication logic

**Characteristics**:
- Zero dependencies (pure TypeScript)
- Promise-based API
- All network calls, token operations, and business rules
- Works with any framework or vanilla JavaScript

**Exports**:
- Auth flows: `register`, `login`, `logout`, `verify`, `checkSession`
- Token management: `setToken`, `getToken`, `clearToken`, `scheduleRefresh`
- Team operations: `getTeams`, `switchTeam`, `listTeamMembers`, `createTeam`
- Invitation flows: `invite`, `activate`, `acceptInvite`, `listInvitations`
- Password management: `forgotPassword`, `resetPassword`
- Profile updates: `updateProfile`, `changePassword`

### Layer 2: Framework Adapters

**Purpose**: Reactive wrappers for specific frameworks

**Current Adapter**: `@restheart-cloud/kit-ng` (Angular)

**Characteristics**:
- Depends on Layer 1 (kit)
- Adds framework-specific patterns (signals, guards, interceptors)
- Manages reactive state
- Never reimplements API calls or token logic

**Future Adapters**:
- `@restheart-cloud/kit-react` — React hooks and context
- `@restheart-cloud/kit-vue` — Vue composables

## Design Principles

### 1. Separation of Concerns

**Core (kit)**: Owns all business logic and network communication
- API calls
- Token storage and refresh
- Validation
- Error handling

**Adapters**: Own framework integration
- Reactive state management
- Framework-specific patterns (Angular signals, React hooks)
- Route protection
- HTTP interceptors

**Rule**: An adapter that reimplements an API call or token computation is a bug.

### 2. Token Delivery Parity

Both authentication modes (bearer and cookie) must be supported consistently:

- **Bearer mode** (default): Token in localStorage, `Authorization: Bearer <token>` header
- **Cookie mode**: HttpOnly JWT cookie, same-origin only

Every auto-login endpoint (`login`, `activate`, `resetPassword`, `switchTeam`) accepts a `mode` parameter that controls token delivery via the `delivery` query parameter (`body` for bearer, `cookie` for cookie mode).

### 3. Proactive Token Refresh

Tokens are refreshed transparently:
- 15-minute TTL
- Refresh scheduled at 80% of TTL (~12 minutes)
- Automatic rescheduling after successful refresh
- Graceful degradation on refresh failure (token expires naturally)

### 4. Error Handling

All API errors are thrown as `{ status: number; message: string }` (ApiError type).

Special handling:
- 401 responses clear session automatically
- Browser Basic Auth popup suppressed via `No-Auth-Challenge` header
- localStorage failures fall back to in-memory token storage

## Dependency Graph

```
@restheart-cloud/kit-ng
        │
        ▼
@restheart-cloud/kit
        │
        ▼
    (none)
```

**Workspace Configuration**:
- `kit-ng` depends on `kit` at exact version `0.0.0` in development
- This prevents npm from resolving `kit` from the registry instead of the workspace
- Release workflow rewrites this to the tag version before publishing

## Authentication Flow Architecture

### Registration Flow

```
User ─── register() ───▶ POST /auth/register
                               │
                               ▼
                    User created with roles: ["user"]
                               │
                               ▼
                    Verification email sent
                               │
                               ▼
User ─── verify() ───▶ GET /auth/verify?email=...&token=...&delivery=...
                               │
                               ▼
                    Backend promotes user, 302 redirects
                               │
                               ▼
                    Token delivered via fragment or cookie
```

### Login Flow

```
User ─── login() ───▶ POST /token (bearer) or POST /token/cookie (cookie)
                              │
                              ▼
                    Token returned in body (bearer) or Set-Cookie (cookie)
                              │
                              ▼
                    Token stored in localStorage (bearer) or memory (cookie)
                              │
                              ▼
                    Schedule proactive refresh at 80% TTL
```

### Team Switching Flow

```
User ─── switchTeam() ───▶ POST /auth/switch-team?delivery=...
                                    │
                                    ▼
                          New token with updated team claim
                                    │
                                    ▼
                          Token replaced in localStorage
                                    │
                                    ▼
                          Session refreshed (user info + teams)
```

## Token Storage Architecture

### Bearer Mode

```
┌─────────────────────────────────────────────────────────┐
│                    Browser                               │
├─────────────────────────────────────────────────────────┤
│  localStorage                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  rh_access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6I  │  │
│  │  kpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6I..."│  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Memory fallback (when localStorage unavailable)        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  _memoryToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6I..." │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Cookie Mode

```
┌─────────────────────────────────────────────────────────┐
│                    Browser                               │
├─────────────────────────────────────────────────────────┤
│  HttpOnly Cookie (managed by backend)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Name: (RESTHeart default)                        │  │
│  │  Value: JWT                                       │  │
│  │  HttpOnly: true                                   │  │
│  │  Secure: true (production)                        │  │
│  │  SameSite: Strict                                 │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Angular Integration Architecture

### Service Layer (`RhAuthService`)

```typescript
@Injectable({ providedIn: 'root' })
export class RhAuthService {
  // Signals for reactive state
  private readonly _user = signal<UserInfo | null>(null);
  private readonly _teams = signal<TeamMembership[]>([]);

  // Computed values
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly hasMultipleTeams = computed(() => this._teams().length > 1);

  // Methods return Observables
  login(...): Observable<UserInfo> { ... }
  logout(): Observable<void> { ... }
  checkSession(): Observable<UserInfo | null> { ... }
}
```

### Guard Pattern

```typescript
export const authGuard: CanActivateFn = () => {
  const auth = inject(RhAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return auth.checkSession().pipe(
    map(user => user !== null),
    tap(ok => { if (!ok) router.navigate(['/auth/login']); })
  );
};
```

### Interceptor Pattern

```typescript
export const rhAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(RhAuthService);

  return next(req).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        clearToken();
        cancelRefresh();
        auth.clearSession();
      }
      return throwError(() => err);
    })
  );
};
```

## Testing Architecture

### Integration Test Strategy

Tests run against a real RESTHeart Cloud instance:

1. **Global Setup**: Clean all test data before/after suite
2. **Test Isolation**: Each test uses unique email addresses with run ID
3. **Admin Access**: Tests use Basic Auth with admin credentials
4. **Cleanup**: Automatic removal of test users, teams, and invitations

### Test Structure

```
packages/kit/src/__tests__/integration/
├── global-setup.ts        # Pre/post suite cleanup
├── helpers.ts             # Test utilities, admin fetch
├── auth.test.ts           # Registration, login, verify flows
├── team.test.ts           # Team switching, multi-team
├── team-management.test.ts # Team CRUD, member management
├── invite.test.ts         # Invitation flows
├── password.test.ts       # Password reset
└── profile.test.ts        # Profile updates
```

## Release Architecture

### Tag-Driven Releases

```
git tag 1.2.3
git push origin 1.2.3
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                        │
├─────────────────────────────────────────────────────────┤
│  1. Checkout code                                       │
│  2. Set version from tag                                │
│     • kit: version=1.2.3                                │
│     • kit-ng: version=1.2.3                             │
│     • kit-ng dependencies: kit=1.2.3                    │
│  3. npm install (reify workspace)                       │
│  4. Build both packages                                 │
│  5. Run integration tests                               │
│  6. Publish to npm (both packages)                      │
└─────────────────────────────────────────────────────────┘
```

### Version Management

- Both packages share the same version
- `kit-ng` depends on `kit` at exact version
- Workspace uses `0.0.0` in development
- Release workflow rewrites versions before publishing
- Single changelog for both packages

## Future Architecture Considerations

### Additional Framework Adapters

The adapter pattern is designed for extension:

```
@restheart-cloud/kit
        │
        ├── @restheart-cloud/kit-ng     (Angular - shipped)
        ├── @restheart-cloud/kit-react  (React - planned)
        │       └── /next               (Next.js - planned)
        └── @restheart-cloud/kit-vue    (Vue - planned)
                └── /nuxt               (Nuxt - planned)
```

### Subpath Strategy

For SSR frameworks (Next.js, Nuxt), use subpaths instead of separate packages:

```typescript
import { useAuth } from '@restheart-cloud/kit-react';
import { rhAuthMiddleware } from '@restheart-cloud/kit-react/next';
```

**Benefits**:
- One version, one changelog, one release
- SSR-specific code never bundled into SPA builds
- Optional peer dependencies for SSR frameworks

### Token Delivery Evolution

Current: Two modes (bearer, cookie)

Future considerations:
- HTTP-only cookie with CSRF protection
- Refresh token rotation
- Device-specific tokens
- OAuth2/OIDC integration
