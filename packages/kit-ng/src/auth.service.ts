import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, tap } from 'rxjs';
import type { UserInfo, TeamMembership, AuthConfig, LoginMode } from '@restheart-cloud/kit';
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

  /**
   * Check the current session state.
   *
   * Reads the token from localStorage — if present and not expired,
   * returns user info from the server. Otherwise returns null.
   */
  checkSession(): Observable<UserInfo | null> {
    // If no valid token in localStorage, we're logged out — no HTTP call needed
    if (!kit.getToken()) {
      this._user.set(null);
      this._teams.set([]);
      return of(null);
    }

    return from(kit.checkSession(this.config)).pipe(
      tap(u => {
        this._user.set(u);
        if (!u) {
          this._teams.set([]);
        }
      }),
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

  verify(email: string, token: string, delivery: 'cookie' | 'fragment' = 'fragment'): Observable<string> {
    return from(kit.verify(this.config, email, token, delivery));
  }

  login(email: string, password: string, mode: LoginMode = 'bearer'): Observable<UserInfo> {
    return from(kit.login(this.config, email, password, mode)).pipe(
      tap(u => this._user.set(u)),
      switchMap(u =>
        from(kit.getTeams(this.config)).pipe(
          catchError(() => of([])),
          tap(ts => this._teams.set(ts)),
          map(() => u)
        )
      )
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

  activate(payload: { email: string; token: string; password: string }, mode: LoginMode = 'bearer'): Observable<void> {
    return from(kit.activate(this.config, payload, mode));
  }

  acceptInvite(token: string): Observable<void> {
    return from(kit.acceptInvite(this.config, token)).pipe(
      switchMap(() =>
        from(kit.getTeams(this.config)).pipe(
          catchError(() => of([])),
          tap(ts => this._teams.set(ts))
        )
      ),
      map(() => undefined)
    );
  }

  resendInvite(email: string): Observable<void> {
    return from(kit.resendInvite(this.config, email));
  }

  switchTeam(teamId: { $oid: string }, mode: LoginMode = 'bearer'): Observable<void> {
    return from(kit.switchTeam(this.config, teamId, mode)).pipe(
      switchMap(() => this.checkSession()),
      map(() => undefined)
    );
  }

  clearSession(): void {
    kit.clearToken();
    kit.cancelRefresh();
    this._user.set(null);
    this._teams.set([]);
  }

  forgotPassword(email: string): Observable<void> {
    return from(kit.forgotPassword(this.config, email));
  }

  resetPassword(payload: { email: string; token: string; password: string }, mode: LoginMode = 'bearer'): Observable<void> {
    return from(kit.resetPassword(this.config, payload, mode));
  }
}
