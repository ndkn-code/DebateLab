import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { SupabasePaymentRepository } from "./supabase-repository";
import type { ClaimTransactionInput } from "./repository.types";
import type { ApplySubscriptionParams } from "./types";

type AnyRec = Record<string, unknown>;
interface FakeOpts {
  rpc?: Record<string, { data?: unknown; error?: { message: string } | null }>;
  rows?: Record<string, AnyRec | null>;
}

function makeDb(opts: FakeOpts) {
  const rpcCalls: { name: string; args: AnyRec }[] = [];
  const chain = (table: string): AnyRec => {
    const c: AnyRec = {};
    c.select = () => c;
    c.eq = () => c;
    c.maybeSingle = async () => ({ data: opts.rows?.[table] ?? null, error: null });
    return c;
  };
  const db = {
    from: (t: string) => chain(t),
    rpc: async (name: string, args: AnyRec) => {
      rpcCalls.push({ name, args });
      const r = opts.rpc?.[name];
      return { data: r?.data ?? null, error: r?.error ?? null };
    },
  } as unknown as SupabaseClient<Database>;
  return { db, rpcCalls };
}

const claim: ClaimTransactionInput = {
  provider: "zalopay",
  idempotencyKey: "k1",
  userId: "u1",
  kind: "order",
  amount: null,
  currency: null,
  planType: null,
  billingCycle: null,
  providerRef: null,
};

const applyParams: ApplySubscriptionParams = {
  userId: "u1",
  provider: "stripe",
  providerSubscriptionId: null,
  providerCustomerId: null,
  planType: "premium",
  status: "active",
  currentPeriodStart: null,
  currentPeriodEnd: null,
  trialEndDate: null,
  cancelAtPeriodEnd: false,
  billingCycle: null,
  amountPaid: null,
  currency: null,
  eventAt: "2026-06-19T10:00:00.000Z",
};

test("payments/supabase-repository maps to rpc/table calls", async () => {
  // isWebhookProcessed
  let r = makeDb({ rows: { payment_webhook_events: { status: "processed" } } });
  assert.equal(await new SupabasePaymentRepository(r.db).isWebhookProcessed("stripe", "e1"), true);
  r = makeDb({ rows: { payment_webhook_events: { status: "pending" } } });
  assert.equal(await new SupabasePaymentRepository(r.db).isWebhookProcessed("stripe", "e1"), false);
  r = makeDb({ rows: { payment_webhook_events: null } });
  assert.equal(await new SupabasePaymentRepository(r.db).isWebhookProcessed("stripe", "e1"), false);

  // recordWebhookEvent calls record + mark
  r = makeDb({ rpc: { record_payment_webhook_event: { data: "new" }, mark_payment_webhook_event: { data: null } } });
  await new SupabasePaymentRepository(r.db).recordWebhookEvent("stripe", "e1", "t", { a: 1 }, "u1", "processed");
  assert.deepEqual(r.rpcCalls.map((c) => c.name), ["record_payment_webhook_event", "mark_payment_webhook_event"]);
  assert.equal(r.rpcCalls[1]?.args.p_status, "processed");

  // claimTransaction returns the rpc string; nullable args pass through.
  r = makeDb({ rpc: { claim_payment_transaction: { data: "claimed" } } });
  assert.equal(await new SupabasePaymentRepository(r.db).claimTransaction(claim), "claimed");
  assert.equal(r.rpcCalls[0]?.args.p_idempotency_key, "k1");
  assert.equal(r.rpcCalls[0]?.args.p_amount, null);

  // applySubscription returns the id.
  r = makeDb({ rpc: { apply_subscription_from_webhook: { data: "sub_42" } } });
  assert.equal(await new SupabasePaymentRepository(r.db).applySubscription(applyParams), "sub_42");

  // incrementFeatureUsage maps the first row.
  r = makeDb({ rpc: { increment_feature_usage: { data: [{ allowed: true, used_count: 2, limit_count: 3 }] } } });
  assert.deepEqual(
    await new SupabasePaymentRepository(r.db).incrementFeatureUsage("u1", "f", "a", "b", 1, 3),
    { allowed: true, usedCount: 2, limitCount: 3 },
  );

  // finalize + release succeed.
  r = makeDb({ rpc: { finalize_payment_transaction: { data: null }, release_payment_transaction: { data: null } } });
  await new SupabasePaymentRepository(r.db).finalizeTransaction("zalopay", "k1", "success", "sub_1", "zp_1");
  await new SupabasePaymentRepository(r.db).releaseTransaction("zalopay", "k1");

  // getTransaction maps a row, and null -> null.
  r = makeDb({ rows: { payment_transactions: { user_id: "u1", provider: "zalopay", idempotency_key: "k1", amount: 197000, currency: "VND", plan_type: "premium", billing_cycle: "monthly", status: "success", processed: true, subscription_id: "sub_1" } } });
  const txn = await new SupabasePaymentRepository(r.db).getTransaction("zalopay", "k1");
  assert.equal(txn?.userId, "u1");
  assert.equal(txn?.processed, true);
  assert.equal(txn?.subscriptionId, "sub_1");
  r = makeDb({ rows: { payment_transactions: null } });
  assert.equal(await new SupabasePaymentRepository(r.db).getTransaction("zalopay", "k1"), null);

  // userExists
  r = makeDb({ rows: { profiles: { id: "u1" } } });
  assert.equal(await new SupabasePaymentRepository(r.db).userExists("u1"), true);
  r = makeDb({ rows: { profiles: null } });
  assert.equal(await new SupabasePaymentRepository(r.db).userExists("u1"), false);
});

test("payments/supabase-repository surfaces rpc errors", async () => {
  const err = { error: { message: "boom" } };
  let r = makeDb({ rpc: { claim_payment_transaction: err } });
  await assert.rejects(() => new SupabasePaymentRepository(r.db).claimTransaction(claim), /claimTransaction: boom/);

  r = makeDb({ rpc: { apply_subscription_from_webhook: err } });
  await assert.rejects(() => new SupabasePaymentRepository(r.db).applySubscription(applyParams), /applySubscription: boom/);

  r = makeDb({ rpc: { increment_feature_usage: err } });
  await assert.rejects(() => new SupabasePaymentRepository(r.db).incrementFeatureUsage("u1", "f", "a", "b", 1, 3), /incrementFeatureUsage: boom/);

  r = makeDb({ rpc: { increment_feature_usage: { data: [] } } });
  await assert.rejects(() => new SupabasePaymentRepository(r.db).incrementFeatureUsage("u1", "f", "a", "b", 1, 3), /no row returned/);

  r = makeDb({ rpc: { finalize_payment_transaction: err } });
  await assert.rejects(() => new SupabasePaymentRepository(r.db).finalizeTransaction("zalopay", "k1", "success", null, null), /finalizeTransaction: boom/);

  r = makeDb({ rpc: { release_payment_transaction: err } });
  await assert.rejects(() => new SupabasePaymentRepository(r.db).releaseTransaction("zalopay", "k1"), /releaseTransaction: boom/);

  r = makeDb({ rpc: { record_payment_webhook_event: { data: "new" }, mark_payment_webhook_event: err } });
  await assert.rejects(() => new SupabasePaymentRepository(r.db).recordWebhookEvent("stripe", "e1", "t", {}, null, "error"), /recordWebhookEvent: boom/);
});

console.log("payments/supabase-repository tests passed");
