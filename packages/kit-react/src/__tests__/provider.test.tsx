import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as kit from '@restheart-cloud/kit';
import { RhAuthProvider, useAuth } from '../index';

// The core is separately integration-tested against a live RESTHeart Cloud
// instance. Here we mock it entirely and assert only the adapter's wiring:
// which core calls fire, and how the reactive state reacts.
vi.mock('@restheart-cloud/kit');

const config = { apiBaseUrl: 'https://x.restheart.com' };
const user = { _id: 'a@b.com', roles: ['user'] } as kit.UserInfo;

const wrapper = ({ children }: { children: ReactNode }) => (
  <RhAuthProvider config={config}>{children}</RhAuthProvider>
);

/** Mock a signed-in bootstrap: token present, session and teams resolve. */
function signedIn(teams: unknown[] = [{ id: { $oid: '1' }, role: 'owner' }]) {
  vi.mocked(kit.getToken).mockReturnValue('tok');
  vi.mocked(kit.checkSession).mockResolvedValue(user);
  vi.mocked(kit.getTeams).mockResolvedValue(teams as kit.TeamMembership[]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(kit.getToken).mockReturnValue(null); // signed-out by default
});

describe('RhAuthProvider bootstrap', () => {
  it('starts unauthenticated and makes NO HTTP call when there is no token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    // The short-circuit: checkSession() returns null without hitting the server.
    expect(kit.checkSession).not.toHaveBeenCalled();
    expect(kit.getTeams).not.toHaveBeenCalled();
  });

  it('checkSession loads BOTH the user and the teams when a token exists', async () => {
    signedIn();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?._id).toBe('a@b.com');
    expect(result.current.teams).toHaveLength(1);
    expect(kit.getTeams).toHaveBeenCalledOnce();
  });
});

describe('methods update the shared state', () => {
  it('login sets the user and also loads teams in the same flow', async () => {
    vi.mocked(kit.login).mockResolvedValue(user);
    vi.mocked(kit.getTeams).mockResolvedValue([
      { id: { $oid: '1' }, role: 'owner' },
      { id: { $oid: '2' }, role: 'member' },
    ] as kit.TeamMembership[]);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.initializing).toBe(false));

    await act(async () => {
      await result.current.login('a@b.com', 'pw');
    });

    expect(result.current.user?._id).toBe('a@b.com');
    expect(result.current.teams).toHaveLength(2);
    expect(result.current.hasMultipleTeams).toBe(true);
    expect(kit.login).toHaveBeenCalledWith(config, 'a@b.com', 'pw', 'bearer');
  });

  it('logout clears user and teams', async () => {
    signedIn();
    vi.mocked(kit.logout).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.teams).toHaveLength(0);
  });

  it('switchTeam re-checks the session (fresh team claim)', async () => {
    signedIn();
    vi.mocked(kit.switchTeam).mockResolvedValue('newtok');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    vi.mocked(kit.checkSession).mockClear();

    await act(async () => {
      await result.current.switchTeam({ $oid: '2' });
    });

    expect(kit.switchTeam).toHaveBeenCalledWith(config, { $oid: '2' }, 'bearer');
    expect(kit.checkSession).toHaveBeenCalledOnce(); // re-check after switch
  });

  it('acceptInvite reloads teams', async () => {
    signedIn([{ id: { $oid: '1' }, role: 'owner' }]);
    vi.mocked(kit.acceptInvite).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    vi.mocked(kit.getTeams).mockResolvedValue([
      { id: { $oid: '1' }, role: 'owner' },
      { id: { $oid: '2' }, role: 'member' },
    ] as kit.TeamMembership[]);

    await act(async () => {
      await result.current.acceptInvite('invite-token');
    });

    expect(kit.acceptInvite).toHaveBeenCalledWith(config, 'invite-token');
    expect(result.current.teams).toHaveLength(2);
  });

  it('clearSession wipes state and the token', async () => {
    signedIn();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    act(() => {
      result.current.clearSession();
    });

    expect(kit.clearToken).toHaveBeenCalledOnce();
    expect(kit.cancelRefresh).toHaveBeenCalledOnce();
    expect(result.current.user).toBeNull();
    expect(result.current.teams).toHaveLength(0);
  });
});
