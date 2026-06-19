import assert from "node:assert/strict";
import {
  fromProviderAmount,
  isZeroDecimal,
  toProviderAmount,
} from "./currency";

// Zero-decimal detection (case-insensitive).
assert.equal(isZeroDecimal("VND"), true);
assert.equal(isZeroDecimal("vnd"), true);
assert.equal(isZeroDecimal("JPY"), true);
assert.equal(isZeroDecimal("KRW"), true);
assert.equal(isZeroDecimal("USD"), false);
assert.equal(isZeroDecimal("EUR"), false);

// From provider amount: VND is NOT divided by 100; USD is.
assert.equal(fromProviderAmount(197000, "VND"), 197000);
assert.equal(fromProviderAmount(2500, "USD"), 25);
assert.equal(fromProviderAmount(2599, "usd"), 25.99);

// To provider amount: round-trips.
assert.equal(toProviderAmount(197000, "VND"), 197000);
assert.equal(toProviderAmount(25, "USD"), 2500);
assert.equal(toProviderAmount(25.99, "USD"), 2599);

assert.throws(() => fromProviderAmount(Number.NaN, "USD"), /finite/);
assert.throws(() => toProviderAmount(Number.POSITIVE_INFINITY, "USD"), /finite/);

console.log("payments/currency tests passed");
