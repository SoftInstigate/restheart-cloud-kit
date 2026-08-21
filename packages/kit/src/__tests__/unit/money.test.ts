import { describe, expect, it } from 'vitest';
import { formatPrice } from '../../index';

describe('formatPrice', () => {
  it('divides a 2-decimal currency by 100', () => {
    expect(formatPrice(1990, 'eur', 'en-US')).toBe('€19.90');
    expect(formatPrice(100, 'usd', 'en-US')).toBe('$1.00');
  });

  it('does not divide a 0-decimal currency', () => {
    // JPY amounts are already whole yen — dividing by 100 would be wrong.
    expect(formatPrice(500, 'jpy', 'ja-JP')).toBe('￥500'); // fullwidth yen sign
  });

  it('divides a 3-decimal currency by 1000', () => {
    // BHD (Bahraini dinar) — the case a naive amount/100 silently misrenders.
    // The space between "BHD" and the amount is U+00A0 (non-breaking), not U+0020.
    expect(formatPrice(19900, 'bhd', 'en-BH')).toBe('BHD 19.900');
  });

  it('accepts a lowercase currency code, as Stripe sends it', () => {
    expect(formatPrice(1990, 'eur', 'en-US')).toBe(formatPrice(1990, 'EUR', 'en-US'));
  });
});
