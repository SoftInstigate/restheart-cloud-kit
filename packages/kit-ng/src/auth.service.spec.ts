import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import * as kit from '@restheart-cloud/kit';
import { RhAuthService } from './auth.service';
import { RH_AUTH_CONFIG } from './tokens';

// The core is integration-tested against a live instance; here we mock it and
// assert only the service's signal wiring.
vi.mock('@restheart-cloud/kit');

const config = { apiBaseUrl: 'https://x.restheart.com' };
const user = { _id: 'a@b.com', roles: ['user'] } as kit.UserInfo;

function service(): RhAuthService {
  TestBed.configureTestingModule({
    providers: [RhAuthService, { provide: RH_AUTH_CONFIG, useValue: config }],
  });
  return TestBed.inject(RhAuthService);
}

function signedIn(teams: unknown[] = [{ id: { $oid: '1' }, role: 'owner' }]) {
  vi.mocked(kit.getToken).mockReturnValue('tok');
  vi.mocked(kit.checkSession).mockResolvedValue(user);
  vi.mocked(kit.getTeams).mockResolvedValue(teams as kit.TeamMembership[]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(kit.getToken).mockReturnValue(null);
});
afterEach(() => TestBed.resetTestingModule());

describe('RhAuthService', () => {
  it('A1 checkSession short-circuits (no HTTP) when there is no token', async () => {
    const svc = service();
    const u = await firstValueFrom(svc.checkSession());
    expect(u).toBeNull();
    expect(svc.isAuthenticated()).toBe(false);
    expect(kit.checkSession).not.toHaveBeenCalled();
  });

  it('A2 checkSession loads the user AND the teams', async () => {
    signedIn();
    const svc = service();
    await firstValueFrom(svc.checkSession());
    expect(svc.user()?._id).toBe('a@b.com');
    expect(svc.teams()).toHaveLength(1);
  });

  it('A3 login sets the user and also loads teams', async () => {
    vi.mocked(kit.login).mockResolvedValue(user);
    vi.mocked(kit.getTeams).mockResolvedValue([
      { id: { $oid: '1' }, role: 'owner' },
      { id: { $oid: '2' }, role: 'member' },
    ] as kit.TeamMembership[]);
    const svc = service();
    await firstValueFrom(svc.login('a@b.com', 'pw'));
    expect(svc.user()?._id).toBe('a@b.com');
    expect(svc.teams()).toHaveLength(2);
    expect(svc.hasMultipleTeams()).toBe(true);
    expect(kit.login).toHaveBeenCalledWith(config, 'a@b.com', 'pw', 'bearer');
  });

  it('A4 logout clears user and teams', async () => {
    signedIn();
    vi.mocked(kit.logout).mockResolvedValue(undefined);
    const svc = service();
    await firstValueFrom(svc.checkSession());
    await firstValueFrom(svc.logout());
    expect(svc.user()).toBeNull();
    expect(svc.teams()).toHaveLength(0);
  });

  it('A5 switchTeam re-checks the session', async () => {
    signedIn();
    vi.mocked(kit.switchTeam).mockResolvedValue('newtok');
    const svc = service();
    await firstValueFrom(svc.checkSession());
    vi.mocked(kit.checkSession).mockClear();
    await firstValueFrom(svc.switchTeam({ $oid: '2' }));
    expect(kit.switchTeam).toHaveBeenCalledWith(config, { $oid: '2' }, 'bearer');
    expect(kit.checkSession).toHaveBeenCalledOnce();
  });

  it('A7 acceptInvite reloads teams', async () => {
    signedIn([{ id: { $oid: '1' }, role: 'owner' }]);
    vi.mocked(kit.acceptInvite).mockResolvedValue(undefined);
    const svc = service();
    await firstValueFrom(svc.checkSession());
    vi.mocked(kit.getTeams).mockResolvedValue([
      { id: { $oid: '1' }, role: 'owner' },
      { id: { $oid: '2' }, role: 'member' },
    ] as kit.TeamMembership[]);
    await firstValueFrom(svc.acceptInvite('invite-token'));
    expect(svc.teams()).toHaveLength(2);
  });

  it('A8 clearSession wipes state and the token', async () => {
    signedIn();
    const svc = service();
    await firstValueFrom(svc.checkSession());
    svc.clearSession();
    expect(kit.clearToken).toHaveBeenCalledOnce();
    expect(kit.cancelRefresh).toHaveBeenCalledOnce();
    expect(svc.user()).toBeNull();
    expect(svc.teams()).toHaveLength(0);
  });
});
