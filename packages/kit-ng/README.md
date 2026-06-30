# @restheart-cloud/kit-ng

[RESTHeart Cloud](https://restheart.org/cloud) gives you a production-ready backend — MongoDB, REST API, authentication, multi-tenancy, all managed.

This package gives you the same speed on the Angular frontend. Wraps [`@restheart-cloud/kit`](https://www.npmjs.com/package/@restheart-cloud/kit) in an Angular service with signals, route guards, and an HTTP interceptor.

## Installation

```bash
npm install @restheart-cloud/kit-ng @restheart-cloud/kit
```

## Setup

In `app.config.ts`:

```typescript
import { provideRhAuth } from '@restheart-cloud/kit-ng';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRhAuth({ apiBaseUrl: environment.apiUrl }),
  ],
};
```

That one call registers `RhAuthService`, adds `withCredentials` to all HTTP requests, and handles 401 responses automatically.

## `RhAuthService`

Inject it anywhere and use signals directly in templates:

```typescript
@Component({
  template: `
    @if (auth.isAuthenticated()) {
      <span>{{ auth.user()?.profile?.firstName }}</span>
      @if (auth.hasMultipleTeams()) {
        <team-switcher [teams]="auth.teams()" />
      }
    }
  `
})
export class AppComponent {
  auth = inject(RhAuthService);
}
```

### Signals

| Signal | Type | Description |
|---|---|---|
| `user` | `Signal<UserInfo \| null>` | Authenticated user, or `null` |
| `isAuthenticated` | `Signal<boolean>` | Derived from `user` |
| `teams` | `Signal<TeamMembership[]>` | Teams the user belongs to |
| `hasMultipleTeams` | `Signal<boolean>` | `true` when user has more than one team |

### Methods

All methods return `Observable`:

```typescript
auth.checkSession()                // Observable<UserInfo | null>
auth.login(email, password)        // Observable<UserInfo>
auth.logout()                      // Observable<void>
auth.register(payload)             // Observable<void>
auth.verify(email, token)          // Observable<void>
auth.invite(email, role)           // Observable<void>
auth.getInvitation(email, token)   // Observable<Invitation>
auth.activate(payload)             // Observable<void>
auth.acceptInvite(token)           // Observable<void>
auth.switchTeam(teamId)            // Observable<void> — re-fetches session
auth.forgotPassword(email)         // Observable<void>
auth.resetPassword(payload)        // Observable<void>
```

## Guards

```typescript
import { authGuard, publicGuard } from '@restheart-cloud/kit-ng';

export const routes: Routes = [
  {
    path: 'app',
    canActivate: [authGuard],     // redirects to /auth/login if not authenticated
    loadComponent: () => import('./shell/shell.component'),
  },
  {
    path: 'auth/login',
    canActivate: [publicGuard],   // redirects to /app if already authenticated
    loadComponent: () => import('./pages/login/login.component'),
  },
];
```

## Quickstart

The fastest path to a working app:

1. Create a service on [RESTHeart Cloud](https://restheart.org/cloud)
2. Fork [`restheart-cloud-starter-ng`](https://github.com/SoftInstigate/restheart-cloud-starter-ng)
3. Set `apiBaseUrl` in `environment.ts`
4. `ng serve`

You get login, signup, email verification, invitations, password reset, and multi-team switching — all wired up.
