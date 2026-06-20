import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeRepository } from "../fake-repository";
import { processZaloPayCallback } from "./callback";
import type { ZaloPayConfig } from "./config";
import { hmacSha256Hex } from "./signing";

const config: ZaloPayConfig = {
  appId: "75326",
  key1: "k1",
  key2: "k2",
  createEndpoint: "https://sb/create",
  callbackUrl: "https://app/cb",
};
const now = new Date("2026-06-19T10:00:00Z");

function body(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app_trans_id: "260619_000001",
    amount: 197000,
    zp_trans_id: 99,
    embed_data: JSON.stringify({ userId: "u1", billingCycle: "monthly" }),
    ...over,
  });
}
const macFor = (raw: string) => hmacSha256Hex(raw, "k2");

test("payments/zalopay/callback grant + idempotency + guards", async () => {
  const repo = new FakeRepository(["u1"]);
  const raw = body();

  // Happy path: grants a 1-month premium subscription.
  const r1 = await processZaloPayCallback(raw, macFor(raw), repo, { config, now });
  assert.equal(r1.return_code, 1);
  assert.equal(r1.return_message, "success");
  assert.equal(repo.subscriptionCount(), 1);
  const txn = await repo.getTransaction("zalopay", "260619_000001");
  assert.ok(txn && txn.processed);

  // Replay: idempotent success, still one subscription.
  const r2 = await processZaloPayCallback(raw, macFor(raw), repo, { config, now });
  assert.equal(r2.return_code, 1);
  assert.equal(r2.return_message, "already processed");
  assert.equal(repo.subscriptionCount(), 1);

  // Bad MAC -> rejected.
  assert.equal((await processZaloPayCallback(raw, "deadbeef", repo, { config, now })).return_code, -1);

  // Valid MAC over invalid JSON.
  const garbage = "not-json";
  const r3 = await processZaloPayCallback(garbage, macFor(garbage), repo, { config, now });
  assert.equal(r3.return_code, 0);
  assert.equal(r3.return_message, "invalid data");

  // Missing user in embed_data.
  const noUser = body({ embed_data: JSON.stringify({ billingCycle: "monthly" }) });
  const r4 = await processZaloPayCallback(noUser, macFor(noUser), repo, { config, now });
  assert.equal(r4.return_code, 0);
  assert.equal(r4.return_message, "missing user");

  // Transient grant failure -> return_code 0 so ZaloPay retries.
  const throwing = new FakeRepository(["u1"]);
  throwing.applySubscription = async () => {
    throw new Error("db down");
  };
  const fresh = body({ app_trans_id: "260619_000002" });
  const r5 = await processZaloPayCallback(fresh, macFor(fresh), throwing, { config, now });
  assert.equal(r5.return_code, 0);
});

console.log("payments/zalopay/callback tests passed");
