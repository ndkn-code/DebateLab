import assert from "node:assert/strict";
import {
  interpretClaim,
  isEventStale,
  stripeActivationRef,
  stripeRenewalRef,
} from "./idempotency";

assert.deepEqual(interpretClaim("claimed"), {
  proceed: true,
  alreadyDone: false,
  retry: false,
});
assert.deepEqual(interpretClaim("duplicate_done"), {
  proceed: false,
  alreadyDone: true,
  retry: false,
});
assert.deepEqual(interpretClaim("in_flight"), {
  proceed: false,
  alreadyDone: false,
  retry: true,
});

assert.equal(stripeActivationRef("sub_123"), "sub_sub_123");
assert.equal(stripeActivationRef("abc"), "sub_abc");
assert.equal(stripeRenewalRef("in_999"), "renewal_in_999");

const t1 = new Date("2026-06-19T10:00:00Z");
const t2 = new Date("2026-06-19T11:00:00Z");
assert.equal(isEventStale(t1, t2), true); // older than last -> stale
assert.equal(isEventStale(t2, t1), false); // newer -> apply
assert.equal(isEventStale(t1, t1), false); // equal -> apply (not strictly older)
assert.equal(isEventStale(t1, null), false); // no prior event -> apply

console.log("payments/idempotency tests passed");
