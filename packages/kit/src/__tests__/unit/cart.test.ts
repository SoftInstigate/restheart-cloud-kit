import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addToCart,
  cartTotals,
  clearStoredCart,
  loadCart,
  removeFromCart,
  saveCart,
  setCartQuantity,
  toOrderItems,
  type CartLine,
} from '../../cart.js';

const tee: CartLine = {
  productId: 'tee-classic/yellow-l',
  quantity: 1,
  name: 'Classic T-shirt',
  unitAmount: 2500,
  currency: 'eur',
  options: { colour: 'yellow', size: 'L' },
};

const mug: CartLine = {
  productId: 'mug',
  quantity: 2,
  name: 'Enamel mug',
  unitAmount: 1450,
  currency: 'eur',
};

describe('addToCart', () => {
  it('adds a line', () => {
    const lines = addToCart([], { ...tee, quantity: undefined } as never);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(1);
  });

  it('increases the line already holding the item instead of adding a second', () => {
    const lines = addToCart(addToCart([], mug, 2), mug, 3);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(5);
  });

  it('keeps a variant apart from its siblings', () => {
    // The composite id is the whole point: yellow L and blue M are two lines.
    const lines = addToCart(addToCart([], tee), { ...tee, productId: 'tee-classic/blue-m' });
    expect(lines).toHaveLength(2);
  });

  it('does not modify the array it was given', () => {
    const before: CartLine[] = [];
    addToCart(before, mug);
    expect(before).toHaveLength(0);
  });

  it('refuses to add less than one', () => {
    expect(addToCart([], mug, 0)[0]?.quantity).toBe(1);
    expect(addToCart([], mug, -4)[0]?.quantity).toBe(1);
  });

  it('leaves out empty options rather than storing an empty object', () => {
    expect(addToCart([], { ...mug, options: {} })[0]).not.toHaveProperty('options');
  });
});

describe('setCartQuantity', () => {
  it('sets it', () => {
    expect(setCartQuantity([mug], 'mug', 7)[0]?.quantity).toBe(7);
  });

  it('removes the line at zero, because that is what a quantity box of 0 means', () => {
    expect(setCartQuantity([mug], 'mug', 0)).toHaveLength(0);
    expect(setCartQuantity([mug], 'mug', -1)).toHaveLength(0);
  });
});

describe('removeFromCart', () => {
  it('removes only the named line', () => {
    const lines = removeFromCart([tee, mug], 'mug');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.productId).toBe('tee-classic/yellow-l');
  });
});

describe('cartTotals', () => {
  it('counts units, not lines', () => {
    expect(cartTotals([tee, mug]).totalItems).toBe(3);
  });

  it('sums minor units', () => {
    expect(cartTotals([tee, mug]).subtotal).toBe(2500 + 1450 * 2);
  });

  it('answers eur for an empty cart', () => {
    expect(cartTotals([])).toEqual({ totalItems: 0, subtotal: 0, currency: 'eur' });
  });
});

describe('toOrderItems', () => {
  it('leaves names, prices and pictures behind', () => {
    expect(toOrderItems([mug])).toEqual([{ productId: 'mug', quantity: 2 }]);
  });

  it('sends the chosen options, which the service cannot work out for itself', () => {
    // Without this the order, the Stripe dashboard and the email all say
    // "Classic T-shirt" and never say which one.
    expect(toOrderItems([tee])).toEqual([
      {
        productId: 'tee-classic/yellow-l',
        quantity: 1,
        metadata: { colour: 'yellow', size: 'L' },
      },
    ]);
  });

  it('omits metadata entirely for a line with no options', () => {
    expect(toOrderItems([mug])[0]).not.toHaveProperty('metadata');
  });
});

/**
 * A `localStorage` in a variable.
 *
 * The unit suite runs on `node`, deliberately — it is the one that has to work
 * anywhere with nothing configured. Pulling in a DOM to exercise four calls
 * would cost the whole suite a dependency for one describe block.
 */
class MemoryStorage {
  private entries = new Map<string, string>();
  get length() { return this.entries.size; }
  key(i: number) { return [...this.entries.keys()][i] ?? null; }
  getItem(k: string) { return this.entries.get(k) ?? null; }
  setItem(k: string, v: string) { this.entries.set(k, String(v)); }
  removeItem(k: string) { this.entries.delete(k); }
  clear() { this.entries.clear(); }
}

describe('storage', () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage() as unknown as Storage;
  });

  it('round-trips a cart', () => {
    saveCart([tee, mug]);
    expect(loadCart()).toEqual([tee, mug]);
  });

  it('is empty when nothing was saved', () => {
    expect(loadCart()).toEqual([]);
  });

  it('drops a line that is not one, and keeps the rest', () => {
    // Storage is a place other code writes too, and survives a deploy that
    // changed this shape. A checkout is not where you find that out.
    localStorage.setItem('rh-cart', JSON.stringify([mug, { productId: 'x' }, null, 5]));
    expect(loadCart()).toEqual([mug]);
  });

  it('answers an empty cart for stored JSON that is not an array', () => {
    localStorage.setItem('rh-cart', '{"lines":[]}');
    expect(loadCart()).toEqual([]);
    localStorage.setItem('rh-cart', 'not json at all');
    expect(loadCart()).toEqual([]);
  });

  it('keeps two apps on one origin apart', () => {
    saveCart([mug], 'shop-a');
    saveCart([tee], 'shop-b');
    expect(loadCart('shop-a')).toEqual([mug]);
    expect(loadCart('shop-b')).toEqual([tee]);
  });

  it('forgets on request', () => {
    saveCart([mug]);
    clearStoredCart();
    expect(loadCart()).toEqual([]);
  });

  it('does not throw when storage refuses to write', () => {
    const spy = vi
      .spyOn(globalThis.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    expect(() => saveCart([mug])).not.toThrow();
    spy.mockRestore();
  });
});
