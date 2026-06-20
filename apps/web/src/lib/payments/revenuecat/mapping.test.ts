import assert from "node:assert/strict";
import { candidateUserIds, isUuidShaped } from "./mapping";

const uuid = "00000000-0000-0000-0000-0000000000a1";
const uuid2 = "00000000-0000-0000-0000-0000000000a2";

assert.equal(isUuidShaped(uuid), true);
assert.equal(isUuidShaped("not-a-uuid"), false);
assert.equal(isUuidShaped("$RCAnonymousID:abc123"), false);
assert.equal(isUuidShaped(null), false);
assert.equal(isUuidShaped(undefined), false);

// Only UUID-shaped ids survive; order preserved; de-duplicated.
assert.deepEqual(candidateUserIds(uuid, uuid2), [uuid, uuid2]);
assert.deepEqual(candidateUserIds(uuid, uuid), [uuid]);
assert.deepEqual(candidateUserIds("$RCAnonymousID:x", uuid2), [uuid2]);
assert.deepEqual(candidateUserIds(null, null), []);
assert.deepEqual(candidateUserIds("anon", "also-anon"), []);

console.log("payments/revenuecat/mapping tests passed");
