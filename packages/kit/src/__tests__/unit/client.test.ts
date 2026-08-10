import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, clearToken, getTokenClaims, setToken } from '../../index';
import type { ApiError, AuthConfig } from '../../types';

const apiBaseUrl = 'https://x.restheart.com';

/** A JWT with the given payload. Unsigned — nothing here verifies it. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

const inAnHour = Math.floor(Date.now() / 1000) + 3600;

afterEach(() => {
  clearToken();
});

describe('onError', () => {
  it('E1 reports a non-2xx and still throws it to the caller', async () => {
    const onError = vi.fn();
    const config: AuthConfig = {
      apiBaseUrl,
      onError,
      transport: async () =>
        new Response(JSON.stringify({ message: 'You must accept the terms' }), { status: 451 }),
    };

    await expect(apiFetch(config, '/demo')).rejects.toMatchObject({ status: 451 });

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0] as ApiError;
    expect(err.status).toBe(451);
    // The message comes from the body, not the status text — that is what makes
    // it worth surfacing.
    expect(err.message).toBe('You must accept the terms');
  });

  it('E2 reports a request that never reached the service as status 0', async () => {
    const onError = vi.fn();
    const config: AuthConfig = {
      apiBaseUrl,
      onError,
      transport: async () => {
        throw new TypeError('Failed to fetch');
      },
    };

    // An offline user is not a signed-out user; status 0 is how they are told
    // apart.
    await expect(apiFetch(config, '/demo')).rejects.toMatchObject({
      status: 0,
      message: 'Failed to fetch',
    });
    expect(onError).toHaveBeenCalledWith({ status: 0, message: 'Failed to fetch' });
  });

  it('E3 stays quiet on success', async () => {
    const onError = vi.fn();
    const config: AuthConfig = {
      apiBaseUrl,
      onError,
      transport: async () => new Response('{}', { status: 200 }),
    };

    await apiFetch(config, '/demo');
    expect(onError).not.toHaveBeenCalled();
  });

  it('E4 is optional — a config without it behaves as before', async () => {
    const config: AuthConfig = {
      apiBaseUrl,
      transport: async () => new Response('{}', { status: 500 }),
    };
    await expect(apiFetch(config, '/demo')).rejects.toMatchObject({ status: 500 });
  });
});

describe('getTokenClaims', () => {
  it('C1 reads the subject, which is the user id', () => {
    setToken(jwt({ sub: 'someone@example.com', exp: inAnHour }));
    expect(getTokenClaims()?.['sub']).toBe('someone@example.com');
  });

  it('C2 returns null with no token', () => {
    expect(getTokenClaims()).toBeNull();
  });

  it('C3 returns null rather than throwing on a malformed token', () => {
    setToken('not-a-jwt');
    expect(getTokenClaims()).toBeNull();
  });
});
