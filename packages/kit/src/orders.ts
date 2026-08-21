import type { AuthConfig, CatalogItem, Order } from './types.js';
import { apiFetch } from './client.js';
import { WaitTimeoutError, sleep, type WaitOptions } from './payments.js';

/**
 * The catalog, orders and transactions collection names are all configured
 * per service (`stripeConfig.products.*-collection`), not fixed — the request
 * interceptors that create/checkout orders match on the *configured* name, so
 * the HTTP path really does change if a deployment renamed a collection. Every
 * function below takes the collection name as a parameter for this reason;
 * the default matches what the service uses when it hasn't been renamed, it
 * is not a kit-level constant.
 */
const DEFAULT_ORDERS_COLLECTION = 'orders';
const DEFAULT_CATALOG_COLLECTION = 'catalog';

// ── Catalog ──────────────────────────────────────────────────────────────────

/**
 * Reads the product catalog — a plain MongoDB collection read, not a
 * dedicated endpoint, so what this returns and what access it requires are
 * entirely the deployment's own ACL (a `readFilter` restricting to
 * `purchasable: true`, pagination, projections — none of that is the kit's to
 * decide).
 *
 * @param collection Defaults to `'catalog'` — pass the configured
 *                    `products.catalog-collection` if the service renamed it.
 */
export async function getCatalog(
  config: AuthConfig,
  opts?: { collection?: string; pagesize?: number; page?: number }
): Promise<CatalogItem[]> {
  const collection = opts?.collection ?? DEFAULT_CATALOG_COLLECTION;
  const params = new URLSearchParams();
  if (opts?.pagesize !== undefined) params.set('pagesize', String(opts.pagesize));
  if (opts?.page !== undefined) params.set('page', String(opts.page));
  const qs = params.toString();

  const res = await apiFetch(config, `/${collection}${qs ? `?${qs}` : ''}`);
  return res.json() as Promise<CatalogItem[]>;
}

// ── Orders ───────────────────────────────────────────────────────────────────

/**
 * Creates an order and starts Checkout for it — `window.location.href =
 * checkout_url`, same as {@link createCheckoutSession} for subscriptions.
 *
 * Prices come from `catalogItem.unitAmount` on the server, resolved from
 * `productId` at the moment of the call — never from anything this function
 * is passed, so there is no client-suppliable price to tamper with.
 *
 * @param email      Required for a guest checkout; the deployment's ACL
 *                    decides whether an unauthenticated request is allowed at
 *                    all (see the products guide's guest-checkout example).
 *                    Omit when the caller is authenticated.
 * @param collection Defaults to `'orders'` — pass the configured
 *                    `products.orders-collection` if the service renamed it.
 */
export async function createOrder(
  config: AuthConfig,
  items: { productId: string; quantity: number }[],
  email?: string,
  collection: string = DEFAULT_ORDERS_COLLECTION
): Promise<{ _id: { $oid: string }; checkout_url: string; secret: string }> {
  const body: Record<string, unknown> = { items };
  if (email) body['email'] = email;

  const res = await apiFetch(config, `/${collection}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ _id: { $oid: string }; checkout_url: string; secret: string }>;
}

/**
 * Reads an order back.
 *
 * @param secret     The guest checkout path: no session, the secret
 *                    {@link createOrder} returned proves ownership instead.
 *                    Harmless to pass alongside a session too — `apiFetch`
 *                    still attaches the bearer token if there is one.
 * @param collection Defaults to `'orders'` — pass the configured
 *                    `products.orders-collection` if the service renamed it.
 */
export async function getOrder(
  config: AuthConfig,
  id: string,
  secret?: string,
  collection: string = DEFAULT_ORDERS_COLLECTION
): Promise<Order> {
  const qs = secret ? `?secret=${encodeURIComponent(secret)}` : '';
  const res = await apiFetch(config, `/${collection}/${encodeURIComponent(id)}${qs}`);
  return res.json() as Promise<Order>;
}

/**
 * Polls {@link getOrder} until it leaves `'pending_payment'` — the products
 * counterpart of `waitForSubscription`, for the same reason: the redirect
 * back from Checkout races Stripe's webhook, so a success page that reads the
 * order the moment it mounts can still see `'pending_payment'` on an order
 * that already succeeded.
 *
 * The first check runs immediately, before any wait — see
 * `waitForSubscription`'s doc for why.
 *
 * **Timing out is not a failed payment.** Same distinction as
 * `waitForSubscription`: this rejects with a {@link WaitTimeoutError}, kept
 * separate from `ApiError` so "the order failed" and "we haven't heard back
 * yet" never collapse into the same error screen.
 *
 * ```ts
 * // on the order success page
 * const order = await waitForOrder(config, orderId, secret);
 * if (order.status === 'paid') showConfirmation(order);
 * ```
 */
export async function waitForOrder(
  config: AuthConfig,
  id: string,
  secret?: string,
  opts: WaitOptions & { collection?: string } = {}
): Promise<Order> {
  const { timeoutMs = 30_000, intervalMs = 1_000, signal, collection } = opts;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    signal?.throwIfAborted();
    const order = await getOrder(config, id, secret, collection);
    if (order.status !== 'pending_payment') return order;

    if (Date.now() >= deadline) {
      throw new WaitTimeoutError(
        `waitForOrder: order ${id} still pending_payment after ${timeoutMs}ms — the payment may have succeeded; the webhook may just be late`
      );
    }
    await sleep(intervalMs, signal);
  }
}
