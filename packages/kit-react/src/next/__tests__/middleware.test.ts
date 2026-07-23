// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rhAuthMiddleware } from '../middleware';

const config = { apiBaseUrl: 'https://x.restheart.com' };

/** A JWT (unsigned — only iat/exp matter to the middleware) with a given age. */
function makeJwt(issuedSecondsAgo: number, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const payload = { iat: now - issuedSecondsAgo, exp: now - issuedSecondsAgo + ttlSeconds };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

function request(path: string, token?: string): NextRequest {
  const req = new NextRequest(`https://app.example.com${path}`);
  if (token) req.cookies.set('rh_session', token);
  return req;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { headers: { 'Auth-Token': 'NEW_TOKEN' } }))
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('proactive refresh', () => {
  it('renews and rewrites the cookie once the token passes 80% of its TTL', async () => {
    const res = await rhAuthMiddleware(config)(request('/app', makeJwt(810, 900)));
    expect(fetch).toHaveBeenCalledWith('https://x.restheart.com/token?renew', expect.anything());
    expect(res.cookies.get('rh_session')?.value).toBe('NEW_TOKEN');
  });

  it('leaves a fresh token untouched', async () => {
    const res = await rhAuthMiddleware(config)(request('/app', makeJwt(10, 900)));
    expect(fetch).not.toHaveBeenCalled();
    expect(res.cookies.get('rh_session')).toBeUndefined();
  });
});

describe('guards', () => {
  it('redirects an unauthenticated request on a protected path', async () => {
    const res = await rhAuthMiddleware(config, { isProtected: (p) => p.startsWith('/app') })(
      request('/app/secret')
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/login');
  });

  it('lets an authenticated request through on a protected path', async () => {
    const res = await rhAuthMiddleware(config, { isProtected: (p) => p.startsWith('/app') })(
      request('/app', makeJwt(10, 900))
    );
    expect(res.status).toBe(200);
  });

  it('redirects an authenticated request away from a public-only path', async () => {
    const res = await rhAuthMiddleware(config, { isPublicOnly: (p) => p.startsWith('/auth') })(
      request('/auth/login', makeJwt(10, 900))
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/');
  });
});
