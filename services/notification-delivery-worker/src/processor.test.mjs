import assert from "node:assert/strict";
import test from "node:test";
import { reconcileNotificationMessages } from "./processor.mjs";

const userId = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000002";
const inboxId = "00000000-0000-4000-8000-000000000003";
const jobId = "00000000-0000-4000-8000-000000000004";
const leaseToken = "00000000-0000-4000-8000-000000000005";

function claimedJob(id = jobId) {
  return {
    id,
    inbox_item_id: inboxId,
    event_id: eventId,
    recipient_id: userId,
    channel: "email",
    status: "processing",
    idempotency_key: `notification:${id}`,
    payload: {},
    attempts: 1,
    max_attempts: 5,
    available_at: "2026-08-30T12:00:00.000Z",
    locked_at: "2026-08-30T12:00:00.000Z",
    lease_token: leaseToken,
    lease_expires_at: "2026-08-30T12:05:00.000Z",
  };
}

function chainFor(table) {
  const values = {
    notification_events: {
      data: {
        id: eventId,
        event_type: "practice_reminder",
        title: "Practice",
        body: "Keep practicing.",
        message_class: "lifecycle",
        topic: "practice",
        subject_type: null,
        subject_id: null,
        payload: { templateKey: "practice_reminder" },
      },
      error: null,
    },
    profiles: {
      data: { id: userId, email: "student@example.com", display_name: "Student", preferences: {} },
      error: null,
    },
    notification_user_settings: { data: { email_enabled: true, in_app_enabled: true, push_enabled: false }, error: null },
    notification_preferences: { data: { enabled: true, frequency: "immediate" }, error: null },
    notification_mutes: { data: [], error: null },
    email_messages: { data: { id: "email-audit-id" }, error: null },
  }[table] ?? { data: null, error: null };
  const chain = {
    select() { return chain; },
    eq() { return chain; },
    ilike() { return chain; },
    in() { return chain; },
    or() { return chain; },
    limit() { return chain; },
    maybeSingle() { return Promise.resolve(values); },
    single() { return Promise.resolve(values); },
    insert() { return chain; },
    update() { return chain; },
    then(resolve, reject) { return Promise.resolve(values).then(resolve, reject); },
  };
  return chain;
}

test("reconcile claims bounded rows, persists per-job provider failure, and continues", async () => {
  const rpcCalls = [];
  const auditUpdates = [];
  const db = {
    from(table) {
      const chain = chainFor(table);
      if (table === "email_messages") {
        chain.update = (value) => {
          auditUpdates.push(value);
          return chain;
        };
      }
      return chain;
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name === "claim_notification_delivery_jobs") return { data: [claimedJob(jobId), claimedJob(`${userId.slice(0, -1)}4`)], error: null };
      return { data: [{}], error: null };
    },
  };
  let sends = 0;
  const outcome = await reconcileNotificationMessages({ mode: "reconcile", limit: 25, leaseSeconds: 300 }, {
    supabase: db,
    sendEmail: async () => {
      sends += 1;
      const error = new Error("provider unavailable");
      error.retryable = true;
      throw error;
    },
  });
  assert.equal(rpcCalls[0].name, "claim_notification_delivery_jobs");
  assert.equal(rpcCalls[0].args.p_limit, 25);
  assert.equal(sends, 2);
  assert.equal(outcome.failed, 2);
  assert.equal(outcome.followUpExpected, false);
  assert.equal(auditUpdates.length, 2);
  assert.equal(auditUpdates[0].status, "delayed");
});
