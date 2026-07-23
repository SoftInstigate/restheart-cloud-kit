import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as kit from '@restheart-cloud/kit';
import { createRhAuthStore } from '../store';

// The core is separately integration-tested against a live instance; here we
// mock it and assert only the store's reactive wiring.
vi.mock('@restheart-cloud/kit');

const config = { apiBaseUrl: 'https://x.restheart.com' };
const user = { _id: 'a@b.com', roles: ['user'] } as kit.UserInfo;

function signedIn(teams: unknown[] = [{ id: { $oid: '1' }, role: 'owner' }]) {
  vi.mocked(kit.getToken).mockReturnValue('tok');
  vi.mocked(kit.checkSession).mockResolvedValue(user);
  vi.mocked(kit.getTeams).mockResolvedValue(teams as kit.TeamMembership[]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(kit.getToken).mockReturnValue(null); // signed-out by default
});

describe('bootstrap', () => {
  it('A1 starts unauthenticated with NO HTTP call when there is no token', async () => {
    const s = createRhAuthStore(config);
    await vi.waitFor(() => expect(s.initializing.value).toBe(false));
    expect(s.user.value).toBeNull();
    expect(s.isAuthenticated.value).toBe(false);
    expect(kit.checkSession).not.toHaveBeenCalled();
  });

  it('A2 loads user and teams when a token exists', async () => {
    signedIn();
    const s = createRhAuthStore(config);
    await vi.waitFor(() => expect(s.isAuthenticated.value).toBe(true));
    expect(s.user.value?._id).toBe('a@b.com');
    expect(s.teams.value).toHaveLength(1);
  });
});

describe('methods update state', () => {
  it('A3 login sets the user and also loads teams', async () => {
    vi.mocked(kit.login).mockResolvedValue(user);
    vi.mocked(kit.getTeams).mockResolvedValue([
      { id: { $oid: '1' }, role: 'owner' },
      { id: { $oid: '2' }, role: 'member' },
    ] as kit.TeamMembership[]);

    const s = createRhAuthStore(config);
    await vi.waitFor(() => expect(s.initializing.value).toBe(false));
    await s.login('a@b.com', 'pw');

    expect(s.user.value?._id).toBe('a@b.com');
    expect(s.teams.value).toHaveLength(2);
    expect(s.hasMultipleTeams.value).toBe(true);
    expect(kit.login).toHaveBeenCalledWith(config, 'a@b.com', 'pw', 'bearer');
  });

  it('A4 logout clears user and teams', async () => {
    signedIn();
    vi.mocked(kit.logout).mockResolvedValue(undefined);
    const s = createRhAuthStore(config);
    await vi.waitFor(() => expect(s.isAuthenticated.value).toBe(true));
    await s.logout();
    expect(s.user.value).toBeNull();
    expect(s.teams.value).toHaveLength(0);
  });

  it('A5 switchTeam re-checks the session', async () => {
    signedIn();
    vi.mocked(kit.switchTeam).mockResolvedValue('newtok');
    const s = createRhAuthStore(config);
    await vi.waitFor(() => expect(s.isAuthenticated.value).toBe(true));
    vi.mocked(kit.checkSession).mockClear();
    await s.switchTeam({ $oid: '2' });
    expect(kit.switchTeam).toHaveBeenCalledWith(config, { $oid: '2' }, 'bearer');
    expect(kit.checkSession).toHaveBeenCalledOnce();
  });

  it('A7 acceptInvite reloads teams', async () => {
    signedIn([{ id: { $oid: '1' }, role: 'owner' }]);
    vi.mocked(kit.acceptInvite).mockResolvedValue(undefined);
    const s = createRhAuthStore(config);
    await vi.waitFor(() => expect(s.isAuthenticated.value).toBe(true));
    vi.mocked(kit.getTeams).mockResolvedValue([
      { id: { $oid: '1' }, role: 'owner' },
      { id: { $oid: '2' }, role: 'member' },
    ] as kit.TeamMembership[]);
    await s.acceptInvite('invite-token');
    expect(s.teams.value).toHaveLength(2);
  });

  it('A8 clearSession wipes state and the token', async () => {
    signedIn();
    const s = createRhAuthStore(config);
    await vi.waitFor(() => expect(s.isAuthenticated.value).toBe(true));
    s.clearSession();
    expect(kit.clearToken).toHaveBeenCalledOnce();
    expect(kit.cancelRefresh).toHaveBeenCalledOnce();
    expect(s.user.value).toBeNull();
    expect(s.teams.value).toHaveLength(0);
  });
});
