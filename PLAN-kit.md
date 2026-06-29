# Implementation Plan — RESTHeart Cloud Kit

Creation of the two npm packages (`@restheart-cloud/kit` and `@restheart-cloud/kit-ng`) and the Angular example app.

---

## Repos

| Repo | Contents |
|---|---|
| `restheart-cloud-kit` | Monorepo: `@restheart-cloud/kit` + `@restheart-cloud/kit-ng` |
| `restheart-cloud-starter-ng` | Full Angular app using the packages (demo + starting point) |

---

## Execution order

```
KIT-1 (monorepo setup) → KIT-2 (@restheart-cloud/kit) → KIT-3 (@restheart-cloud/kit-ng)
  → KIT-4 (restheart-cloud-starter-ng app)
```

---

## TASK KIT-1 — Monorepo setup

**Dependencies:** none

### Structure

```
restheart-cloud-kit/
  packages/
    kit/           ← @restheart-cloud/kit
    kit-ng/        ← @restheart-cloud/kit-ng
  package.json     ← npm workspaces
  tsconfig.base.json
  LICENSE          ← MIT
```

### `package.json` root

```json
{
  "name": "restheart-cloud-kit-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build -w packages/kit && npm run build -w packages/kit-ng"
  }
}
```

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### Done when
`npm install` at the root installs dependencies for both packages.

---

## TASK KIT-2 — `@restheart-cloud/kit`

**Package:** `packages/kit`
**Dependencies:** KIT-1

### Purpose

Pure TypeScript, zero framework dependencies. Contains all `restheart-accounts` flow logic: HTTP calls, types, session management. Shared base for all framework adapters.

### `packages/kit/package.json`

```json
{
  "name": "@restheart-cloud/kit",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": "./dist/index.js" },
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "test": "node --test"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

### `src/` structure

```
packages/kit/src/
  types.ts          ← UserInfo, TenantMembership, Invitation, AuthConfig
  client.ts         ← fetch wrapper (base URL, credentials: 'include')
  auth.ts           ← register, verify, login, logout, checkSession
  invite.ts         ← invite, getInvitation, activate, acceptInvite, resendInvite
  tenant.ts         ← getTenants, switchTenant
  password.ts       ← forgotPassword, resetPassword
  index.ts          ← re-exports everything
```

### Types (`types.ts`)

```typescript
export interface AuthConfig {
  apiBaseUrl: string;
}

export interface UserInfo {
  _id: string;
  roles: string[];
  tenant: string;
  tenants?: TenantMembership[];
  profile?: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  };
}

export interface TenantMembership {
  id: { $oid: string };
  name?: string;
  role: 'owner' | 'member';
  active?: boolean;
}

export interface Invitation {
  email: string;
  orgName: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  expiresAt: string;
}
```

### Conventions

- Native `fetch`, `credentials: 'include'` on all calls (httpOnly JWT cookie).
- All methods return `Promise<T>` — adapters wrap them in framework-specific reactive primitives.
- Errors: throw `{ status: number; message: string }`.

### Public API

```typescript
// auth.ts
export async function register(config: AuthConfig, payload: {
  email: string; password: string; orgName: string;
  firstName?: string; lastName?: string;
}): Promise<void>

export async function checkSession(config: AuthConfig): Promise<UserInfo | null>

export async function logout(config: AuthConfig): Promise<void>

// invite.ts
export async function invite(config: AuthConfig, email: string, role: 'owner' | 'member'): Promise<void>

export async function getInvitation(config: AuthConfig, email: string, token: string): Promise<Invitation>

export async function activate(config: AuthConfig, payload: {
  email: string; token: string; password: string;
}): Promise<void>

export async function acceptInvite(config: AuthConfig, token: string): Promise<void>

export async function resendInvite(config: AuthConfig, email: string): Promise<void>

// tenant.ts
export async function getTenants(config: AuthConfig): Promise<TenantMembership[]>

export async function switchTenant(config: AuthConfig, tenantId: { $oid: string }): Promise<void>

// password.ts
export async function forgotPassword(config: AuthConfig, email: string): Promise<void>

export async function resetPassword(config: AuthConfig, payload: {
  email: string; token: string; password: string;
}): Promise<void>
```

### Done when
- `npm run build` produces `dist/index.js` and `dist/index.d.ts`.
- Node.js test: call `checkSession` against local RESTHeart, verify returned type.

---

## TASK KIT-3 — `@restheart-cloud/kit-ng`

**Package:** `packages/kit-ng`
**Dependencies:** KIT-2

### Purpose

Thin Angular adapter. Wraps `@restheart-cloud/kit` in an Angular service with signals, a guard, and an interceptor. ~150 lines total.

### `packages/kit-ng/package.json`

```json
{
  "name": "@restheart-cloud/kit-ng",
  "version": "0.1.0",
  "license": "MIT",
  "peerDependencies": {
    "@angular/core": ">=21",
    "@angular/common": ">=21"
  },
  "dependencies": {
    "@restheart-cloud/kit": "workspace:*"
  }
}
```

### `src/` structure

```
packages/kit-ng/src/
  auth.service.ts       ← RhAuthService (signals, delegates to @restheart-cloud/kit)
  auth.guard.ts         ← authGuard, publicGuard
  auth.interceptor.ts   ← RhAuthInterceptor
  provide-rh-auth.ts    ← provideRhAuth(config) — DI setup
  index.ts              ← public re-exports
```

### `RhAuthService`

```typescript
@Injectable({ providedIn: 'root' })
export class RhAuthService {
  private readonly config = inject(RH_AUTH_CONFIG);

  private readonly _user    = signal<UserInfo | null>(null);
  private readonly _tenants = signal<TenantMembership[]>([]);

  readonly user             = this._user.asReadonly();
  readonly tenants          = this._tenants.asReadonly();
  readonly isAuthenticated  = computed(() => this._user() !== null);
  readonly hasMultipleTeams = computed(() => this._tenants().length > 1);

  checkSession(): Observable<UserInfo | null> {
    return from(kit.checkSession(this.config)).pipe(
      tap(u  => this._user.set(u)),
      switchMap(() => from(kit.getTenants(this.config))),
      tap(ts => this._tenants.set(ts)),
      map(() => this._user())
    );
  }

  // register, login, logout, invite, switchTenant, forgotPassword, resetPassword
  // — all delegate to @restheart-cloud/kit
}
```

### `provideRhAuth(config)`

```typescript
export function provideRhAuth(config: AuthConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RH_AUTH_CONFIG, useValue: config },
    { provide: HTTP_INTERCEPTORS, useClass: RhAuthInterceptor, multi: true },
  ]);
}
```

Used in `app.config.ts`:
```typescript
providers: [provideRhAuth({ apiBaseUrl: environment.apiUrl })]
```

### Done when
- `ng build` of the package produces no errors.
- When imported in an Angular app: `inject(RhAuthService).checkSession()` populates the `user` signal.

---

## TASK KIT-4 — `restheart-cloud-starter-ng` app

**Repo:** `restheart-cloud-starter-ng`
**Dependencies:** KIT-3

### Purpose

A complete, working Angular app using `@restheart-cloud/kit-ng`. Clone it, set the backend URL, and start building — no auth to implement from scratch.

### Contents

- Full routing: login, signup, verify, activate, forgot-password, reset-password, `/invitations/accept`
- Authenticated shell with avatar menu and team switcher (shown only when >1 team)
- All auth pages styled (UnoCSS, dark design system)
- `provideRhAuth()` configured in `app.config.ts`
- `environment.ts` with `apiBaseUrl`
- SSR for public routes, CSR for the authenticated shell

### Done when
- `ng serve` → complete signup flow works against local RESTHeart.
- `ng build` → no TypeScript errors.
- Full invitation flow: new user (`/auth/activate`) and existing user (`/invitations/accept`).
- Team switcher works after accepting a second invitation.
