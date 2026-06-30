import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, from, map, switchMap, tap } from 'rxjs';
import type { UserInfo, TenantMembership, AuthConfig } from '@restheart-cloud/kit';
import * as kit from '@restheart-cloud/kit';
import { RH_AUTH_CONFIG } from './tokens.js';

@Injectable({ providedIn: 'root' })
export class RhAuthService {
  private readonly config: AuthConfig = inject(RH_AUTH_CONFIG);

  private readonly _user = signal<UserInfo | null>(null);
  private readonly _tenants = signal<TenantMembership[]>([]);

  readonly user = this._user.asReadonly();
  readonly tenants = this._tenants.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly hasMultipleTeams = computed(() => this._tenants().length > 1);

  checkSession(): Observable<UserInfo | null> {
    return from(kit.checkSession(this.config)).pipe(
      tap(u => this._user.set(u)),
      switchMap(() => from(kit.getTenants(this.config))),
      tap(ts => this._tenants.set(ts)),
      map(() => this._user())
    );
  }

  register(payload: {
    email: string;
    password: string;
    teamName: string;
    firstName?: string;
    lastName?: string;
  }): Observable<void> {
    return from(kit.register(this.config, payload));
  }

  verify(email: string, token: string): Observable<void> {
    return from(kit.verify(this.config, email, token));
  }

  login(email: string, password: string): Observable<UserInfo> {
    return from(kit.login(this.config, email, password)).pipe(
      tap(u => this._user.set(u))
    );
  }

  logout(): Observable<void> {
    return from(kit.logout(this.config)).pipe(
      tap(() => {
        this._user.set(null);
        this._tenants.set([]);
      })
    );
  }

  invite(email: string, role: 'owner' | 'member'): Observable<void> {
    return from(kit.invite(this.config, email, role));
  }

  getInvitation(email: string, token: string) {
    return from(kit.getInvitation(this.config, email, token));
  }

  activate(payload: { email: string; token: string; password: string }): Observable<void> {
    return from(kit.activate(this.config, payload));
  }

  acceptInvite(token: string): Observable<void> {
    return from(kit.acceptInvite(this.config, token));
  }

  resendInvite(email: string): Observable<void> {
    return from(kit.resendInvite(this.config, email));
  }

  switchTenant(tenantId: { $oid: string }): Observable<void> {
    return from(kit.switchTenant(this.config, tenantId)).pipe(
      switchMap(() => this.checkSession()),
      map(() => undefined)
    );
  }

  clearSession(): void {
    this._user.set(null);
    this._tenants.set([]);
  }

  forgotPassword(email: string): Observable<void> {
    return from(kit.forgotPassword(this.config, email));
  }

  resetPassword(payload: { email: string; token: string; password: string }): Observable<void> {
    return from(kit.resetPassword(this.config, payload));
  }
}
