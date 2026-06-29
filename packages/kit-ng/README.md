# @restheart-cloud/kit-ng

Angular adapter for [`@restheart-cloud/kit`](../kit). Provides `RhAuthService` with signals, `authGuard`, `publicGuard`, and `RhAuthInterceptor`.

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
    // ...
  ],
};
```

## RhAuthService

```typescript
@Component({ ... })
export class MyComponent {
  private auth = inject(RhAuthService);

  user             = this.auth.user;             // Signal<UserInfo | null>
  isAuthenticated  = this.auth.isAuthenticated;  // Signal<boolean>
  tenants          = this.auth.tenants;          // Signal<TenantMembership[]>
  hasMultipleTeams = this.auth.hasMultipleTeams; // Signal<boolean>
}
```

### Methods

```typescript
auth.checkSession()                // Observable<UserInfo | null>
auth.register(payload)             // Observable<void>
auth.login(email, password)        // Observable<UserInfo>
auth.logout()                      // Observable<void>
auth.invite(email, role)           // Observable<void>
auth.getInvitation(email, token)   // Observable<Invitation>
auth.activate(payload)             // Observable<void>
auth.acceptInvite(token)           // Observable<void>
auth.switchTenant(tenantId)        // Observable<void>
auth.forgotPassword(email)         // Observable<void>
auth.resetPassword(payload)        // Observable<void>
```

## Guards

```typescript
export const routes: Routes = [
  {
    path: 'app',
    canActivate: [authGuard],     // redirects to /login if not authenticated
    loadComponent: () => import('./shell/shell.component'),
  },
  {
    path: 'login',
    canActivate: [publicGuard],   // redirects to /app if already authenticated
    loadComponent: () => import('./pages/auth/login/login.component'),
  },
];
```

## Example app

See [`restheart-cloud-starter-ng`](../../restheart-cloud-starter-ng) for a full Angular app using this package.
