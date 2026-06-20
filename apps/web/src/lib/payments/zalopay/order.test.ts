import assert from "node:assert/strict";
import { test } from "node:test";
import type { ZaloPayConfig } from "./config";
import { buildOrderBody, createZaloPayOrder, type ZaloFetch } from "./order";
import { buildCreateOrderMac } from "./signing";

const config: ZaloPayConfig = {
  appId: "75326",
  key1: "k1",
  key2: "k2",
  createEndpoint: "https://sb/create",
  callbackUrl: "https://app/cb",
};

const input = {
  userId: "u1",
  billingCycle: "monthly" as const,
  amount: 197000,
  returnUrl: "https://app/return",
};

// buildOrderBody signs with key1 over the canonical field order and embeds the user.
const built = buildOrderBody(config, input, "260619_000000001", 1_750_000_000_000);
const embed = JSON.parse(built.embed_data) as { userId: string; billingCycle: string };
assert.equal(embed.userId, "u1");
assert.equal(embed.billingCycle, "monthly");
assert.equal(
  built.mac,
  buildCreateOrderMac(
    {
      appId: "75326",
      appTransId: "260619_000000001",
      appUser: "u1",
      amount: 197000,
      appTime: 1_750_000_000_000,
      embedData: built.embed_data,
      item: built.item,
    },
    "k1",
  ),
);

test("payments/zalopay/order create flow", async () => {
  let posted = "";
  const okFetch: ZaloFetch = async (_url, init) => {
    posted = init.body;
    return { json: async () => ({ return_code: 1, order_url: "https://zp/order/abc" }) };
  };
  const res = await createZaloPayOrder(input, {
    config,
    now: new Date("2026-06-19T03:00:00Z"),
    appTransId: "260619_000000042",
    fetchFn: okFetch,
  });
  assert.equal(res.appTransId, "260619_000000042");
  assert.equal(res.orderUrl, "https://zp/order/abc");
  assert.match(posted, /app_id=75326/);
  assert.match(posted, /app_trans_id=260619_000000042/);

  // Non-success return_code throws.
  const failFetch: ZaloFetch = async () => ({
    json: async () => ({ return_code: 2, sub_return_message: "bad merchant" }),
  });
  await assert.rejects(
    () => createZaloPayOrder(input, { config, fetchFn: failFetch }),
    /create-order failed: bad merchant/,
  );
});

console.log("payments/zalopay/order tests passed");
