import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as kit from '@restheart-cloud/kit';
import { RhAuthService } from './auth.service';
import { rhAuthInterceptor } from './auth.interceptor';
import { RH_AUTH_CONFIG } from './tokens';

vi.mock('@restheart-cloud/kit');

const config = { apiBaseUrl: 'https://x.restheart.com' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(kit.getToken).mockReturnValue(null);
  TestBed.configureTestingModule({
    providers: [
      RhAuthService,
      { provide: RH_AUTH_CONFIG, useValue: config },
      provideHttpClient(withInterceptors([rhAuthInterceptor])),
      provideHttpClientTesting(),
    ],
  });
});
afterEach(() => {
  TestBed.inject(HttpTestingController).verify();
  TestBed.resetTestingModule();
});

/** Fire a request and resolve once the observable settles (it errors here). */
function fire(path: string): Promise<void> {
  const http = TestBed.inject(HttpClient);
  return new Promise<void>((resolve) => {
    http.get(path).subscribe({ next: () => resolve(), error: () => resolve() });
  });
}

describe('rhAuthInterceptor', () => {
  it('C1 clears the session on a 401 response', async () => {
    const auth = TestBed.inject(RhAuthService);
    const clearSpy = vi.spyOn(auth, 'clearSession');
    const done = fire('/x');
    TestBed.inject(HttpTestingController)
      .expectOne('/x')
      .flush('nope', { status: 401, statusText: 'Unauthorized' });
    await done;

    expect(kit.clearToken).toHaveBeenCalled();
    expect(kit.cancelRefresh).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('C1 leaves the session alone on a non-401 error', async () => {
    const auth = TestBed.inject(RhAuthService);
    const clearSpy = vi.spyOn(auth, 'clearSession');
    const done = fire('/y');
    TestBed.inject(HttpTestingController)
      .expectOne('/y')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await done;

    expect(clearSpy).not.toHaveBeenCalled();
  });
});
