import assert from "node:assert/strict";
import test from "node:test";
import { parseNotificationQueueMessage, parsePubSubEnvelope, parseDeliveryJobRow } from "./contracts.mjs";

const jobId = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000002";
const recipientId = "00000000-0000-4000-8000-000000000003";
const leaseToken = "00000000-0000-4000-8000-000000000004";

test("parses bare job messages and compatibility nested job messages", () => {
  assert.deepEqual(parseNotificationQueueMessage({ jobId, eventId, recipientId, channel: "email" }), {
    jobId,
    leaseToken: null,
    eventId,
    recipientId,
    channel: "email",
    payload: {},
    deliveryAttempt: null,
    mode: "job",
  });
  assert.equal(parseNotificationQueueMessage({ job: { id: jobId, leaseToken } }).leaseToken, leaseToken);
});

test("parses and bounds scheduler reconciliation messages", () => {
  assert.deepEqual(parseNotificationQueueMessage({ mode: "reconcile", limit: 999, leaseSeconds: 999 }), {
    mode: "reconcile",
    limit: 25,
    leaseSeconds: 300,
    deliveryAttempt: null,
  });
});

test("parses standard base64 Pub/Sub envelope", () => {
  const data = Buffer.from(JSON.stringify({ jobId })).toString("base64");
  const parsed = parsePubSubEnvelope({
    deliveryAttempt: 2,
    message: { data, messageId: "message-1" },
  });
  assert.equal(parsed.message.jobId, jobId);
  assert.equal(parsed.deliveryAttempt, 2);
});

test("rejects malformed jobs and invalid channels", () => {
  assert.throws(() => parseNotificationQueueMessage({ jobId: "not-a-uuid" }));
  assert.throws(() => parseNotificationQueueMessage({ jobId, channel: "sms" }));
  assert.throws(() => parsePubSubEnvelope({ message: { data: "%%%" } }));
});

test("normalizes a claimed database job without dropping provider fields", () => {
  const row = parseDeliveryJobRow({
    id: jobId,
    event_id: eventId,
    recipient_id: recipientId,
    channel: "email",
    status: "processing",
    idempotency_key: "notification:key",
    payload: { templateKey: "welcome" },
    attempts: 1,
    max_attempts: 5,
    lease_token: leaseToken,
    provider_message_id: null,
  });
  assert.equal(row.eventId, eventId);
  assert.equal(row.attempts, 1);
  assert.equal(row.maxAttempts, 5);
});
