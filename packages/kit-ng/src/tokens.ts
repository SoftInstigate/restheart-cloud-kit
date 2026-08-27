import { InjectionToken } from '@angular/core';
import { HttpContextToken } from '@angular/common/http';
import type { AuthConfig } from '@restheart-cloud/kit';
import { DEFAULT_CART_STORAGE_KEY } from '@restheart-cloud/kit';

export const RH_AUTH_CONFIG = new InjectionToken<AuthConfig>('RH_AUTH_CONFIG');

/**
 * Where {@link import('./cart.service.js').RhCartService | RhCartService} keeps
 * the cart in `localStorage`. Defaults to `'rh-cart'`.
 *
 * Worth providing when two of your apps share an origin, which is one
 * deployment decision away from happening by accident.
 */
export const RH_CART_STORAGE_KEY = new InjectionToken<string>('RH_CART_STORAGE_KEY', {
  providedIn: 'root',
  factory: () => DEFAULT_CART_STORAGE_KEY,
});

/**
 * Marks a request as originating from the kit rather than from application
 * code. Set by `httpClientTransport`, read by `rhAuthInterceptor`.
 *
 * The kit owns the meaning of a 401 on its own endpoints, and that meaning is
 * not always "the session is dead": `PATCH /auth/change-password` answers 401
 * when the *current password* is wrong, and `GET /token` when the credentials
 * are. Letting the interceptor clear the session on those would sign a user
 * out for mistyping their old password.
 */
export const RH_KIT_REQUEST = new HttpContextToken<boolean>(() => false);
