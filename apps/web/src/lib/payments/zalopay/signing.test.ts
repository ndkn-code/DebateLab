import assert from "node:assert/strict";
import {
  appTransDatePrefix,
  buildCreateOrderMac,
  generateAppTransId,
  hmacSha256Hex,
  verifyCallbackMac,
} from "./signing";

// Canonical RFC HMAC-SHA256 test vector (guards against accidental algo changes).
assert.equal(
  hmacSha256Hex("The quick brown fox jumps over the lazy dog", "key"),
  "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
);

// Create-order MAC = hmac over the exact pipe-joined field order with key1.
const fields = {
  appId: "75326",
  appTransId: "260619_000000001",
  appUser: "thinkfy",
  amount: 197000,
  appTime: 1750000000000,
  embedData: '{"planId":"premium"}',
  item: "[]",
};
const expectedData =
  "75326|260619_000000001|thinkfy|197000|1750000000000|{\"planId\":\"premium\"}|[]";
assert.equal(
  buildCreateOrderMac(fields, "key1"),
  hmacSha256Hex(expectedData, "key1"),
);

// Callback verification with key2 (constant-time).
const raw = '{"app_trans_id":"260619_000000001","amount":197000,"zp_trans_id":99}';
const goodMac = hmacSha256Hex(raw, "key2");
assert.equal(verifyCallbackMac(raw, goodMac, "key2"), true);
assert.equal(verifyCallbackMac(raw, goodMac, "wrong-key"), false);
assert.equal(verifyCallbackMac(raw, "deadbeef", "key2"), false); // length mismatch
assert.equal(verifyCallbackMac(raw, goodMac.replace(/.$/, "0"), "key2"), false);

// Date prefix uses VN time (GMT+7): 20:00Z on the 19th -> 03:00 on the 20th VN.
assert.equal(appTransDatePrefix(new Date("2026-06-19T20:00:00Z")), "260620");
assert.equal(appTransDatePrefix(new Date("2026-06-19T10:00:00Z")), "260619");

// app_trans_id format yymmdd_<9 digits>, rng injected for determinism.
const id = generateAppTransId(new Date("2026-06-19T10:00:00Z"), () => 42);
assert.match(id, /^\d{6}_\d{9}$/);
assert.equal(id, "260619_000000042");

console.log("payments/zalopay/signing tests passed");
