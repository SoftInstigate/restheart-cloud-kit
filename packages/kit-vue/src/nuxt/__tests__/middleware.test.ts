// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineEventHandler } from 'h3';
import { rhAuthServerMiddleware } from '../middleware';
import { call, setCookieHeader } from './server';

const config = { apiBaseUrl: 'https://x.restheart.com' };
const ok = defineEventHandler(() => 'ok');

/** A JWT (unsigned — only iat/exp matter) with a given age. */
function makeJwt(issuedSecondsAgo: number, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iat: now - issuedSecondsAgo, exp: now - issuedSecondsAgo + ttlSeconds })}.sig`;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { headers: { 'Auth-Token': 'NEW_TOKEN' } }))
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('proactive refresh', () => {
  it('D1 renews and rewrites the cookie once the token passes 80% TTL', async () => {
    const res = await call([rhAuthServerMiddleware(config), ok], {
      path: '/app',
      cookie: 'rh_session=' + makeJwt(810, 900),
    });
    expect(fetch).toHaveBeenCalledWith('https://x.restheart.com/token?renew', expect.anything());
    expect(setCookieHeader(res)).toContain('rh_session=NEW_TOKEN');
    expect(res.status).toBe(200);
  });

  it('D2 leaves a fresh token untouched', async () => {
    const res = await call([rhAuthServerMiddleware(config), ok], {
      path: '/app',
      cookie: 'rh_session=' + makeJwt(10, 900),
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(setCookieHeader(res)).not.toContain('rh_session=');
  });
});

describe('guards', () => {
  it('D3 redirects an unauthenticated request on a protected path', async () => {
    const res = await call(
      [rhAuthServerMiddleware(config, { isProtected: (p) => p.startsWith('/app') }), ok],
      { path: '/app/secret' }
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/login');
  });

  it('D4 redirects an authenticated request away from a public-only path', async () => {
    const res = await call(
      [rhAuthServerMiddleware(config, { isPublicOnly: (p) => p.startsWith('/auth') }), ok],
      { path: '/auth/login', cookie: 'rh_session=' + makeJwt(10, 900) }
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/');
  });
});
