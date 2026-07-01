import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, tap } from 'rxjs';
import type { UserInfo, TeamMembership, AuthConfig } from '@restheart-cloud/kit';
import * as kit from '@restheart-cloud/kit';
import { RH_AUTH_CONFIG } from './tokens.js';

@Injectable({ providedIn: 'root' })
export class RhAuthService {
  private readonly config: AuthConfig = inject(RH_AUTH_CONFIG);

  private readonly _user = signal<UserInfo | null>(null);
  private readonly _teams = signal<TeamMembership[]>([]);

  readonly user = this._user.asReadonly();
  readonly teams = this._teams.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly hasMultipleTeams = computed(() => this._teams().length > 1);

  checkSession(): Observable<UserInfo | null> {
    return from(kit.checkSession(this.config)).pipe(
      tap(u => this._user.set(u)),
      // Team invitations is an optional, toggleable feature — /auth/teams
      // returns 403 when it's disabled for the service. checkSession() is
      // a foundational flow (every guarded route depends on it), so it
      // must not fail just because that feature is off, or the user isn't
      // logged in yet.
      switchMap(u =>
        u === null
          ? of([])
          : from(kit.getTeams(this.config)).pipe(catchError(() => of([])))
      ),
      tap(ts => this._teams.set(ts)),
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
        this._teams.set([]);
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

  switchTeam(teamId: { $oid: string }): Observable<void> {
    return from(kit.switchTeam(this.config, teamId)).pipe(
      switchMap(() => this.checkSession()),
      map(() => undefined)
    );
  }

  clearSession(): void {
    this._user.set(null);
    this._teams.set([]);
  }

  forgotPassword(email: string): Observable<void> {
    return from(kit.forgotPassword(this.config, email));
  }

  resetPassword(payload: { email: string; token: string; password: string }): Observable<void> {
    return from(kit.resetPassword(this.config, payload));
  }
}
