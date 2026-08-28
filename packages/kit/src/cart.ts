/**
 * A shopping cart: lines, quantities, totals, and somewhere to keep them.
 *
 * **Nothing here talks to a server.** A cart is a list the buyer is building,
 * and it becomes an order in one call — {@link toOrderItems} hands it to
 * `createOrder`, which is where the network starts. That is also why the prices
 * kept here are display-only: the service reads `unit_amount` from its own
 * catalog when it builds the Checkout session, so a tampered line changes what
 * the buyer *sees* and nothing about what they are charged.
 *
 * Every function below is pure and takes the lines it works on, so a cart can
 * live in React state, a Vue ref, an Angular signal, or a variable. The
 * framework packages wrap these; they do not reimplement them.
 */

import type { OrderItem } from './orders.js';

/** Where {@link loadCart} and {@link saveCart} keep the cart by default. */
export const DEFAULT_CART_STORAGE_KEY = 'rh-cart';

/** One line of a cart. */
export interface CartLine {
  /**
   * What the order will name: `tee-classic` for a plain product,
   * `tee-classic/yellow-l` for a variant. Two lines never share one.
   */
  productId: string;
  quantity: number;
  /** Display only — the service prices the order from its own catalog. */
  name: string;
  /** Display only. Minor units, as the catalog stores them. */
  unitAmount: number;
  currency: string;
  /**
   * What was chosen, for a variant: `{ colour: 'yellow', size: 'L' }`.
   *
   * The name stays the product's, because two variants of one thing are called
   * the same thing. Without this a cart holding a yellow L and a blue M shows
   * two identical lines, which is a cart nobody can check before paying.
   */
  options?: Record<string, string>;
  /** So the cart shows what is in it. A list of names is a receipt, not a cart. */
  image?: string;
}

/** What {@link addToCart} needs to make a line. */
export type CartItem = Omit<CartLine, 'quantity' | 'currency'> & { currency?: string };

/** Totals over a cart. */
export interface CartTotals {
  totalItems: number;
  /**
   * Minor units, and only meaningful when every line shares a currency —
   * see {@link CartTotals.currency}.
   */
  subtotal: number;
  /**
   * The first line's currency, or `'eur'` for an empty cart.
   *
   * A cart is not required to be single-currency and this does not enforce it;
   * the service refuses a mixed order at checkout, which is the only place the
   * rule can actually be applied.
   */
  currency: string;
}

/**
 * Adds an item, or increases the line already holding it.
 *
 * Returns a new array — the input is never modified, so this can be handed
 * straight to a state setter.
 */
export function addToCart(lines: CartLine[], item: CartItem, quantity = 1): CartLine[] {
  const wanted = Math.max(1, Math.trunc(quantity));
  const existing = lines.find(line => line.productId === item.productId);

  if (existing) {
    return lines.map(line =>
      line.productId === item.productId ? { ...line, quantity: line.quantity + wanted } : line
    );
  }

  return [
    ...lines,
    {
      productId: item.productId,
      quantity: wanted,
      name: item.name,
      unitAmount: item.unitAmount,
      currency: item.currency ?? 'eur',
      ...(item.options && Object.keys(item.options).length > 0 ? { options: item.options } : {}),
      ...(item.image ? { image: item.image } : {}),
    },
  ];
}

/** Sets a line's quantity. Zero or less removes it, which is what a quantity box of 0 means. */
export function setCartQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  const wanted = Math.trunc(quantity);

  if (wanted <= 0) {
    return lines.filter(line => line.productId !== productId);
  }

  return lines.map(line => (line.productId === productId ? { ...line, quantity: wanted } : line));
}

/** Removes a line. */
export function removeFromCart(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter(line => line.productId !== productId);
}

/** Counts and sums. */
export function cartTotals(lines: CartLine[]): CartTotals {
  return {
    totalItems: lines.reduce((n, line) => n + line.quantity, 0),
    subtotal: lines.reduce((n, line) => n + line.unitAmount * line.quantity, 0),
    currency: lines[0]?.currency ?? 'eur',
  };
}

/**
 * The cart as `createOrder` wants it.
 *
 * Names, prices and pictures stay behind: the service reads those from its own
 * catalog, and sending them would invite the belief that they matter.
 *
 * The chosen options do travel, as the line's `metadata`. They are the one
 * thing here the service cannot work out for itself — a reference like
 * `tee-classic/yellow-l` says which row of the catalog was bought, but the
 * seller reading the order wants "yellow, L" in fields, not decoded from an
 * id. Without this the order, the Stripe dashboard and the confirmation email
 * all say "Classic T-shirt" and leave out which one.
 */
export function toOrderItems(lines: CartLine[]): OrderItem[] {
  return lines.map(({ productId, quantity, options }) => ({
    productId,
    quantity,
    ...(options && Object.keys(options).length > 0 ? { metadata: options } : {}),
  }));
}

/**
 * Reads a saved cart.
 *
 * Returns `[]` for anything it cannot make sense of, and drops individual
 * lines that are malformed. `localStorage` is a place other code writes too,
 * survives a deploy that changed this shape, and can be edited by hand: a
 * checkout is not the place to find out that what came back was a number.
 */
export function loadCart(key: string = DEFAULT_CART_STORAGE_KEY): CartLine[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isCartLine);
  } catch {
    // Unreadable storage, or JSON that is not — and also the server, where
    // `localStorage` is not declared at all. Rendering a page on a server must
    // not throw over a cart, and an empty one is what that request has.
    return [];
  }
}

/** Saves a cart. Does nothing if storage is full or blocked — not worth failing a checkout over. */
export function saveCart(lines: CartLine[], key: string = DEFAULT_CART_STORAGE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(lines));
  } catch {
    // Private browsing, a quota, a browser set to block site data.
  }
}

/** Forgets the saved cart. */
export function clearStoredCart(key: string = DEFAULT_CART_STORAGE_KEY): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line['productId'] === 'string' &&
    line['productId'].length > 0 &&
    typeof line['quantity'] === 'number' &&
    Number.isFinite(line['quantity']) &&
    line['quantity'] > 0 &&
    typeof line['name'] === 'string' &&
    typeof line['unitAmount'] === 'number' &&
    Number.isFinite(line['unitAmount']) &&
    typeof line['currency'] === 'string'
  );
}
