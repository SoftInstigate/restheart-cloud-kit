// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createSessionHandler } from '../handler';
import { call, setCookieHeader } from './server';

const handler = createSessionHandler();

describe('session handler', () => {
  it('D5 POST writes the session cookie from accessToken', async () => {
    const res = await call([handler], { method: 'POST', body: { accessToken: 'TOK' } });
    expect(setCookieHeader(res)).toContain('rh_session=TOK');
  });

  it('D6 POST without a token returns 400', async () => {
    const res = await call([handler], { method: 'POST', body: {} });
    expect(res.status).toBe(400);
  });

  it('D7 DELETE clears the session cookie', async () => {
    const res = await call([handler], { method: 'DELETE' });
    expect(setCookieHeader(res)).toMatch(/rh_session=;/);
  });
});
