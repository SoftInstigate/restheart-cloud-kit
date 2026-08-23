import { definePlan, step, type Plan } from '../plan.js';
import { fromEnv } from '../env.js';
import { isRedacted } from '../types.js';
import type { PluginConfig } from '../types.js';

export interface EcommerceOptions {
  /** Where the shop is served from, no trailing slash — `https://shop.example.com`. */
  appOrigin: string;
  /** `products.catalog-collection`. Change it here *and* in the app's environment. */
  catalogCollection?: string;
  /** `products.orders-collection`. */
  ordersCollection?: string;
  /**
   * The variable holding the Stripe secret key.
   *
   * Read only when the key is not already stored — a service configured once
   * re-runs without the secret in the environment at all.
   */
  secretKeyEnv?: string;
  /** The variable holding the Stripe webhook signing secret. */
  webhookSecretEnv?: string;
  /** `products.default-currency`. */
  currency?: string;
}

/**
 * The plan `restheart-cloud-starter-ecommerce` needs, as steps rather than as a
 * README checklist.
 *
 * The starter's Open points list three settings that "have to line up or the
 * flow breaks in ways that are not obvious from the client" — the `success-url`,
 * anonymous `GET /catalog`, anonymous `POST /orders`. There is a fourth the
 * checklist does not mention and the return page cannot work without: a guest
 * reading their own order back by `secret`. It is here because writing the
 * checklist as code is what exposed it.
 *
 * ```ts
 * const plan = ecommercePlan({ appOrigin: 'https://shop.example.com' });
 * await runPlan(plan, { admin, srvId });
 * ```
 */
export function ecommercePlan(opts: EcommerceOptions): Plan {
  const {
    appOrigin,
    catalogCollection = 'catalog',
    ordersCollection = 'orders',
    secretKeyEnv = 'STRIPE_SECRET_KEY',
    webhookSecretEnv = 'STRIPE_WEBHOOK_SECRET',
    currency = 'eur',
  } = opts;

  const origin = appOrigin.replace(/\/$/, '');

  // Stripe substitutes only {CHECKOUT_SESSION_ID}; RESTHeart's plugin also
  // interpolates {ORDER_ID} and {ORDER_SECRET}. They go in the **fragment** so
  // the secret never reaches a server log or a Referer header — OrderReturn.tsx
  // reads it with readOrderRef() and strips it from the address bar at once.
  const successUrl = `${origin}/shop/order#order={ORDER_ID}&secret={ORDER_SECRET}`;
  const cancelUrl = `${origin}/shop/cart`;

  /** A stored secret comes back as bullets; an unconfigured one comes back blank. */
  const configured = (value: unknown) =>
    isRedacted(value) || (typeof value === 'string' && value.length > 0);

  const products = (config: PluginConfig): PluginConfig =>
    (config['products'] as PluginConfig | undefined) ?? {};

  return definePlan('Ecommerce', [
    step('stripe plugin installed', {
      check: ({ admin, srvId }) => admin.isPluginInstalled(srvId, 'stripe'),
      apply: ({ admin, srvId }) => admin.installPlugin(srvId, 'stripe'),
    }),

    step('stripe products mode configured', {
      async check({ admin, srvId }) {
        const config = await admin.getPluginConfig(srvId, 'stripe');
        const p = products(config);
        return (
          p['enabled'] === true &&
          p['success-url'] === successUrl &&
          p['cancel-url'] === cancelUrl &&
          p['catalog-collection'] === catalogCollection &&
          p['orders-collection'] === ordersCollection &&
          configured(config['secret-key']) &&
          configured(config['webhook-secret'])
        );
      },
      async apply({ admin, srvId }) {
        const current = await admin.getPluginConfig(srvId, 'stripe');
        // Read-modify-write, placeholders passed straight back: the server
        // replaces the whole document and restores the stored value for any
        // field still holding one. Only a key that is *not* already stored is
        // read from the environment, so a re-run needs no secrets at all.
        await admin.updatePluginConfig(srvId, 'stripe', {
          ...current,
          enabled: true,
          'secret-key': configured(current['secret-key'])
            ? current['secret-key']
            : fromEnv(secretKeyEnv),
          'webhook-secret': configured(current['webhook-secret'])
            ? current['webhook-secret']
            : fromEnv(webhookSecretEnv),
          products: {
            ...products(current),
            enabled: true,
            'catalog-collection': catalogCollection,
            'orders-collection': ordersCollection,
            'default-currency': currency,
            'success-url': successUrl,
            'cancel-url': cancelUrl,
          },
        });
      },
    }),

    step('stripe collections and indexes initialised', {
      // The initializer creates catalog, orders, transactions, their indexes and
      // the order schema, and never overwrites what is already there. Asking
      // whether the collections exist is the honest check for "did it run".
      check: async ({ service }) =>
        (await service.collectionExists(ordersCollection)) &&
        (await service.collectionExists('transactions')),
      apply: ({ admin, srvId }) => admin.initPlugin(srvId, 'stripe', 'products'),
    }),

    step('guests may read the catalog', {
      // Missing, this shows up as an empty shop with no error — which is the
      // whole reason the starter's README had to warn about it.
      check: ({ service }) => service.permissionExists('catalog-read-anon'),
      apply: ({ service }) =>
        service.putPermission('catalog-read-anon', {
          predicate: `(path(/${catalogCollection}) or path-template('/${catalogCollection}/{docid}')) and method(GET)`,
          roles: ['$unauthenticated'],
          priority: 100,
          // Only what is for sale. A catalog document is public the moment this
          // rule exists, so a draft product must not be readable by omission.
          mongo: { readFilter: { purchasable: true } },
        }),
    }),

    step('guests may place an order', {
      check: ({ service }) => service.permissionExists('orders-create-anon'),
      apply: ({ service }) =>
        service.putPermission('orders-create-anon', {
          // POST only, deliberately: with PATCH a buyer could set their own
          // order to `status: "paid"`.
          predicate: `path(/${ordersCollection}) and method(POST)`,
          roles: ['$unauthenticated'],
          priority: 100,
        }),
    }),

    step('guests may read back the order they placed', {
      // The fourth setting, absent from the README's table of three. Without it
      // the buyer pays, lands on /shop/order, and is told 401 by a page whose
      // whole job is to reassure them the money went somewhere.
      check: ({ service }) => service.permissionExists('orders-read-anon'),
      apply: ({ service }) =>
        service.putPermission('orders-read-anon', {
          predicate: `path-template('/${ordersCollection}/{id}') and method(GET)`,
          roles: ['$unauthenticated'],
          priority: 100,
          // The secret createOrder returned is what proves ownership — a guest
          // has no session for the server to recognise them by.
          mongo: { readFilter: { secret: "@qparams['secret']" } },
        }),
    }),
  ]);
}
