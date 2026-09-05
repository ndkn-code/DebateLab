import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createZaloPayProvider, appTransId } from "./zalopay.mjs";

const config = { appId: "2553", key1: "one", key2: "two", callbackUrl: "https://center.example/zalo/callback" };
const response = (body = { return_code: 1 }) => ({ ok: true, status: 200, json: async () => body });

test("order IDs are deterministic and sandbox origin is fixed", async () => {
  const calls = [];
  const provider = createZaloPayProvider({ ...config, fetchFn: async (url, init) => { calls.push({ url, init }); return response(); } });
  await provider.createOrder({ orderId: "tuition-7", payerId: "parent-1", amount: 500000, returnUrl: "https://center.example/pay", now: "2026-09-04T03:00:00.000Z" });
  assert.equal(appTransId("tuition-7", "2026-09-04T03:00:00.000Z"), "260904_tuition-7");
  assert.equal(calls[0].url, "https://sb-openapi.zalopay.vn/v2/create");
  assert.equal(calls[0].init.method, "POST");
});

test("callback verifies before parsing and rejects tamper", () => {
  const provider = createZaloPayProvider(config);
  const data = JSON.stringify({ app_id: 2553, app_trans_id: "260904_o", zp_trans_id: "zp1", amount: 500000 });
  const signature = createHmac("sha256", config.key2).update(data).digest("hex");
  assert.equal(provider.verifyCallback({ data, mac: signature, type: 1 }).verified, true);
  assert.throws(() => provider.verifyCallback({ data: `${data} `, mac: signature, type: 1 }), /signature/i);
});

test("invalid amounts are rejected", async () => {
  const provider = createZaloPayProvider({ ...config, fetchFn: async () => response() });
  await assert.rejects(() => provider.createOrder({ orderId: "o", payerId: "p", amount: 1.2, returnUrl: "https://x", now: Date.now() }), /integer VND/);
});

test("signed numeric transaction IDs are normalized without losing safe integer precision", () => {
  const provider = createZaloPayProvider(config);
  for (const transactionId of [2309041234567, Number.MAX_SAFE_INTEGER]) {
    const data = JSON.stringify({ app_id: 2553, app_trans_id: "260904_numeric", zp_trans_id: transactionId, amount: 500000 });
    const signature = createHmac("sha256", config.key2).update(data).digest("hex");
    const result = provider.verifyCallback({ data, mac: signature, type: 1 });
    assert.equal(result.verified, true);
    assert.equal(typeof result.zp_trans_id, "string");
    assert.equal(result.zp_trans_id, String(transactionId));
    assert.equal(result.app_trans_id, "260904_numeric");
    assert.equal(result.amount, 500000);
  }
});

test("even correctly signed unsafe or fractional numeric transaction IDs are rejected", () => {
  const provider = createZaloPayProvider(config);
  for (const transactionId of [Number.MAX_SAFE_INTEGER + 1, 123.5]) {
    const data = JSON.stringify({ app_id: 2553, app_trans_id: "260904_invalid", zp_trans_id: transactionId, amount: 500000 });
    const signature = createHmac("sha256", config.key2).update(data).digest("hex");
    assert.throws(() => provider.verifyCallback({ data, mac: signature, type: 1 }), (error) => error.code === "INVALID_CALLBACK" && error.message === "Unexpected ZaloPay callback shape");
  }
});
