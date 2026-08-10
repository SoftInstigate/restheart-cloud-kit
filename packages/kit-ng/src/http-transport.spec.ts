import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { httpClientTransport } from './http-transport';

const URL = 'https://x.restheart.com/demo';

let send: (url: string, init?: RequestInit) => Promise<Response>;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  send = httpClientTransport(TestBed.inject(HttpClient));
});
afterEach(() => {
  TestBed.inject(HttpTestingController).verify();
  TestBed.resetTestingModule();
});

describe('httpClientTransport', () => {
  it('T1 resolves a 2xx into a Response the core can read', async () => {
    const pending = send(URL);
    TestBed.inject(HttpTestingController)
      .expectOne(URL)
      .flush(JSON.stringify({ hello: 'world' }), { status: 200, statusText: 'OK' });

    const res = await pending;
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ hello: 'world' });
  });

  it('T2 resolves — not rejects — on a non-2xx, so the core reads the status itself', async () => {
    const pending = send(URL);
    TestBed.inject(HttpTestingController)
      .expectOne(URL)
      .flush(JSON.stringify({ message: 'nope' }), { status: 451, statusText: 'Unavailable' });

    const res = await pending;
    expect(res.ok).toBe(false);
    expect(res.status).toBe(451);
    // The core pulls its ApiError message out of this body.
    await expect(res.json()).resolves.toEqual({ message: 'nope' });
  });

  it('T3 rejects when there is no response at all', async () => {
    const pending = send(URL);
    TestBed.inject(HttpTestingController)
      .expectOne(URL)
      .error(new ProgressEvent('network error'));

    await expect(pending).rejects.toBeDefined();
  });

  it('T4 exposes response headers — the token arrives in one', async () => {
    const pending = send(URL);
    TestBed.inject(HttpTestingController)
      .expectOne(URL)
      .flush('{}', { status: 200, statusText: 'OK', headers: { 'Auth-Token': 'tok' } });

    const res = await pending;
    expect(res.headers.get('Auth-Token')).toBe('tok');
  });

  it('T5 survives clone() — the core reads some bodies twice', async () => {
    const pending = send(URL);
    TestBed.inject(HttpTestingController)
      .expectOne(URL)
      .flush(JSON.stringify({ access_token: 'tok' }), { status: 200, statusText: 'OK' });

    const res = await pending;
    await expect(res.clone().json()).resolves.toEqual({ access_token: 'tok' });
    await expect(res.json()).resolves.toEqual({ access_token: 'tok' });
  });

  it('T6 carries method, body and request headers through', async () => {
    const pending = send(URL, {
      method: 'PATCH',
      body: JSON.stringify({ consents: [] }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
    });
    const req = TestBed.inject(HttpTestingController).expectOne(URL);

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toBe(JSON.stringify({ consents: [] }));
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    expect(req.request.withCredentials).toBe(true);

    req.flush('{}');
    await pending;
  });

  it('T7 does not choke on a 204, which may not carry a body', async () => {
    const pending = send(URL, { method: 'DELETE' });
    TestBed.inject(HttpTestingController)
      .expectOne(URL)
      .flush(null, { status: 204, statusText: 'No Content' });

    const res = await pending;
    expect(res.status).toBe(204);
    expect(res.ok).toBe(true);
  });
});
