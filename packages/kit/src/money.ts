/**
 * Formats `amountMinorUnits` — a Stripe amount, always in the currency's
 * *minor* unit (cents for EUR/USD) — as a localized price string.
 *
 * `amount / 100` is the bug this function exists to prevent: not every
 * currency has 2 decimal digits. JPY has 0 (`¥500`, not `¥5.00`), BHD has 3
 * (`19.900`, not `19.90`). `Intl.NumberFormat`'s `currency` style already
 * knows each currency's own digit count — it is platform, not a dependency —
 * so this delegates to it instead of hand-rolling the division.
 *
 * ```ts
 * formatPrice(1990, 'eur')        // "19,90 €" (browser default locale)
 * formatPrice(500, 'jpy', 'ja-JP') // "¥500"
 * formatPrice(19900, 'bhd', 'en-BH') // "BHD 19.900"
 * ```
 *
 * @param currency ISO 4217 code, case-insensitive (Stripe sends lowercase).
 * @param locale   Defaults to the runtime's locale. Pass one explicitly on the
 *                 server, where there is no browser to default to — Node
 *                 falls back to `'en-US'` with no locale data of its own.
 */
export function formatPrice(amountMinorUnits: number, currency: string, locale?: string): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  });

  // NumberFormat's currency digits, not a hardcoded /100 — see module doc.
  // The type is broader than reality: style:'currency' always resolves it —
  // the fallback exists to satisfy strict null checks, not because it fires.
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const amount = amountMinorUnits / 10 ** digits;

  return formatter.format(amount);
}
