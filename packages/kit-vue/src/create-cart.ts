import type { App } from 'vue';
import { createRhCartStore, type RhCartStore } from './cart-store.js';
import { RH_CART_KEY } from './keys.js';

export interface RhCart {
  /** The reactive cart store, also reachable anywhere via `useCart()`. */
  store: RhCartStore;
  /** Vue plugin install hook — registers the store for `useCart()`. */
  install(app: App): void;
}

/**
 * Create the cart plugin.
 *
 * Takes no config, unlike {@link import('./create.js').createRhAuth | createRhAuth}
 * and `createRhPayments`: nothing here talks to a service. It needs no auth
 * plugin either — a cart is the browser's, and a shop that requires a session
 * before a basket loses most of its visitors at that door.
 *
 * ```ts
 * // main.ts
 * const rhCart = createRhCart();
 * app.use(rhCart);
 * ```
 *
 * @param storageKey Where the cart is kept in `localStorage`. Defaults to
 *                   `'rh-cart'`; set it when two of your apps share an origin.
 */
export function createRhCart(storageKey?: string): RhCart {
  const store = createRhCartStore(storageKey);

  return {
    store,
    install(app: App): void {
      app.provide(RH_CART_KEY, store);
    },
  };
}
