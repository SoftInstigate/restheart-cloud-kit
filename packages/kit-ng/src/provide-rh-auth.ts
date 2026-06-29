import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { AuthConfig } from '@restheart-cloud/kit';
import { RH_AUTH_CONFIG } from './tokens.js';
import { rhAuthInterceptor } from './auth.interceptor.js';

export function provideRhAuth(config: AuthConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: RH_AUTH_CONFIG, useValue: config },
    provideHttpClient(withInterceptors([rhAuthInterceptor])),
  ]);
}
