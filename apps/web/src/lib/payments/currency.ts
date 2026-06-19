/**
 * Zero-decimal currency handling (Stripe parity).
 *
 * Most currencies are charged in minor units (USD cents → divide by 100), but
 * "zero-decimal" currencies (VND, JPY, KRW, …) are charged in whole units and
 * must NOT be divided. Getting this wrong is a 100x money bug — Lumist tests it
 * explicitly, so we port the rule exactly.
 */

export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
}

/** Provider "smallest unit" amount → decimal major-unit number (for storage). */
export function fromProviderAmount(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) {
    throw new Error("fromProviderAmount: amount must be finite");
  }
  return isZeroDecimal(currency) ? amount : amount / 100;
}

/** Decimal major-unit amount → provider "smallest unit" integer (for charging). */
export function toProviderAmount(major: number, currency: string): number {
  if (!Number.isFinite(major)) {
    throw new Error("toProviderAmount: amount must be finite");
  }
  return isZeroDecimal(currency)
    ? Math.round(major)
    : Math.round(major * 100);
}
