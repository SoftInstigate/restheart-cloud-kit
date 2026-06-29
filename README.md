# RESTHeart Cloud Kit

[RESTHeart Cloud](https://restheart.org/cloud) gives you a production-ready backend in minutes — MongoDB, REST API, authentication, multi-tenancy, all managed.

This kit gives you the same speed on the frontend.

Two packages, one purpose: wire your app to RESTHeart Cloud without writing auth plumbing from scratch.

---

## Packages

### `@restheart-cloud/kit` — TypeScript core

Zero dependencies. Works with Angular, React, Vue, or vanilla JS.

Covers every [`restheart-accounts`](https://restheart.org/docs/accounts) flow:

| Function | Description |
|---|---|
| `checkSession(config)` | Returns `UserInfo` from the active JWT cookie, or `null` |
| `register(config, payload)` | Sign up — creates user and team |
| `login(config, email, password)` | Email/password login |
| `logout(config)` | Invalidates the cookie |
| `invite(config, email, role)` | Invite a user to the current team |
| `getInvitation(config, email, token)` | Invitation metadata (org name, role, isNewUser) |
| `activate(config, payload)` | Activate account for a new invited user |
| `acceptInvite(config, token)` | Accept invitation for an existing user |
| `resendInvite(config, email)` | Resend an expired invitation |
| `forgotPassword(config, email)` | Request a reset link (always returns 202) |
| `resetPassword(config, payload)` | Apply the reset token |
| `getTenants(config)` | List teams the authenticated user belongs to |
| `switchTenant(config, tenantId)` | Switch active team, re-issues JWT cookie |

**Install**

```bash
npm install @restheart-cloud/kit
```

**Usage**

```typescript
import { checkSession, login, logout } from '@restheart-cloud/kit';

const config = { apiBaseUrl: 'https://api.example.com' };

const user = await checkSession(config);  // UserInfo | null
await login(config, 'user@example.com', 'secret');
await logout(config);
```

**Types**

```typescript
interface AuthConfig {
  apiBaseUrl: string;
}

interface UserInfo {
  _id: string;
  roles: string[];
  tenant: string;
  tenants?: TenantMembership[];
  profile?: { firstName?: string; lastName?: string; avatarUrl?: string };
}

interface TenantMembership {
  id: { $oid: string };
  name?: string;
  role: 'owner' | 'member';
  active?: boolean;
}

interface Invitation {
  email: string;
  orgName: string;
  role: 'owner' | 'member';
  isNewUser: boolean;
  expiresAt: string;
}
```

Errors are thrown as `{ status: number; message: string }`.

---

### `@restheart-cloud/kit-ng` — Angular adapter

Wraps `@restheart-cloud/kit` in an Angular service with signals, route guards, and an HTTP interceptor.

**Install**

```bash
npm install @restheart-cloud/kit-ng @restheart-cloud/kit
```

**Setup** — `app.config.ts`

```typescript
import { provideRhAuth } from '@restheart-cloud/kit-ng';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRhAuth({ apiBaseUrl: environment.apiUrl }),
  ],
};
```

That one call registers `RhAuthService`, adds `withCredentials` to all HTTP requests, and handles 401 responses automatically.

**`RhAuthService`**

```typescript
@Component({ ... })
export class AppComponent {
  private auth = inject(RhAuthService);

  user             = this.auth.user;             // Signal<UserInfo | null>
  isAuthenticated  = this.auth.isAuthenticated;  // Signal<boolean>
  tenants          = this.auth.tenants;          // Signal<TenantMembership[]>
  hasMultipleTeams = this.auth.hasMultipleTeams; // Signal<boolean>
}
```

All methods return `Observable`:

```typescript
auth.checkSession()                // Observable<UserInfo | null>
auth.login(email, password)        // Observable<UserInfo>
auth.logout()                      // Observable<void>
auth.register(payload)             // Observable<void>
auth.invite(email, role)           // Observable<void>
auth.getInvitation(email, token)   // Observable<Invitation>
auth.activate(payload)             // Observable<void>
auth.acceptInvite(token)           // Observable<void>
auth.switchTenant(tenantId)        // Observable<void> — refreshes session
auth.forgotPassword(email)         // Observable<void>
auth.resetPassword(payload)        // Observable<void>
```

**Guards**

```typescript
import { authGuard, publicGuard } from '@restheart-cloud/kit-ng';

export const routes: Routes = [
  {
    path: 'app',
    canActivate: [authGuard],    // redirects to /auth/login if not authenticated
    loadComponent: () => import('./shell/shell.component'),
  },
  {
    path: 'auth/login',
    canActivate: [publicGuard],  // redirects to /app if already authenticated
    loadComponent: () => import('./pages/login/login.component'),
  },
];
```

---

## Quickstart

The fastest path to a working Angular app:

1. Create a service on [RESTHeart Cloud](https://restheart.org/cloud)
2. Fork [`restheart-cloud-starter-ng`](https://github.com/SoftInstigate/restheart-cloud-starter-ng)
3. Set `apiBaseUrl` in `environment.ts`
4. `ng serve`

You get login, signup, email verification, invitations, password reset, and multi-team switching — all wired up.

---

## Contributing

```bash
npm install        # install all workspace dependencies
npm run build      # build kit, then kit-ng
npm run changeset  # describe your change before opening a PR
```

Releases are automated via [changesets](https://github.com/changesets/changesets). Merge a PR with a changeset → CI opens a version PR → merge it → packages publish to npm.
