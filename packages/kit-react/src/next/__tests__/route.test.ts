// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { createSessionRoute } from '../route';

const { POST, DELETE } = createSessionRoute();

function post(body: unknown): NextRequest {
  return new NextRequest('https://app.example.com/api/rh/session', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('session route', () => {
  it('POST writes the session cookie from accessToken', async () => {
    const res = await POST(post({ accessToken: 'TOK' }));
    expect(res.cookies.get('rh_session')?.value).toBe('TOK');
  });

  it('POST rejects a missing token with 400', async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
  });

  it('DELETE clears the session cookie', async () => {
    const res = await DELETE();
    expect(res.headers.get('set-cookie')).toMatch(/rh_session=;/);
  });
});
