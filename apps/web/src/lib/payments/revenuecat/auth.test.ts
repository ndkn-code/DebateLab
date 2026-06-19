import assert from "node:assert/strict";
import { isAuthorizedRevenueCat, safeEqual } from "./auth";

assert.equal(safeEqual("abc", "abc"), true);
assert.equal(safeEqual("abc", "abd"), false);
assert.equal(safeEqual("abc", "abcd"), false); // length mismatch, no throw

const secret = "rc_secret_value";
assert.equal(isAuthorizedRevenueCat(secret, secret), true); // bare
assert.equal(isAuthorizedRevenueCat(`Bearer ${secret}`, secret), true); // prefixed
assert.equal(isAuthorizedRevenueCat("Bearer wrong", secret), false);
assert.equal(isAuthorizedRevenueCat(null, secret), false); // missing header
assert.equal(isAuthorizedRevenueCat(secret, undefined), false); // fail-closed: no secret
assert.equal(isAuthorizedRevenueCat(secret, ""), false);

console.log("payments/revenuecat/auth tests passed");
