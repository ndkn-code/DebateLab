import test from "node:test";
import assert from "node:assert/strict";
import { createCenterNotifications } from "./notifications.mjs";

test("delivery reserves each recipient and records unknown provider outcomes without resend", async () => {
  const calls = []; const rpc = async (name, args) => { calls.push([name, args]); if (name === "center_notification_context") return { data: { allowed: true, connectionId: "c", templateId: "t", templateData: {}, recipients: [{ id: "r", phone: "849" }] } }; if (name === "center_reserve_delivery") return { data: { allowed: true } }; if (name === "center_record_delivery") return { data: { status: args.p_status } }; return { data: {} }; };
  const n = createCenterNotifications({ rpc, loadProvider: async () => ({ sendTemplate: async () => { throw Object.assign(new Error("timeout"), { retryable: true }); } }) });
  const result = await n.deliver({ id: "e" }); assert.equal(result.outcomes[0].status, "uncertain"); assert.equal(calls.filter(([name]) => name === "center_reserve_delivery").length, 1);
});

test("webhook fails closed without configured verification", async () => { await assert.rejects(() => createCenterNotifications({ rpc: async () => ({ data: {} }), loadProvider: async () => ({}) }).webhook({ body: {}, headers: {} }), /verification is not configured/); });

test("approved delivery records a provider message and policy deferrals remain retryable", async () => {
  const calls = []; const rpc = async (name, args) => { calls.push([name, args]); if (name === "center_notification_context") return { data: { allowed: true, connectionId: "c", templateId: "t", templateData: {}, recipients: [{ id: "r", phone: "849" }] } }; if (name === "center_reserve_delivery") return { data: { allowed: true } }; if (name === "center_record_delivery") return { data: { status: args.p_status, providerId: args.p_provider_id } }; return { data: {} }; };
  const n = createCenterNotifications({ rpc, loadProvider: async () => ({ sendTemplate: async () => ({ message_id: "m1" }) }) });
  const result = await n.deliver({ id: "e" }); assert.equal(result.outcomes[0].status, "completed"); assert.equal(result.outcomes[0].providerId, "m1");
});

test("a mixed successful and capped delivery stays deferred and resumes without resending completed recipients", async () => {
  const receipts = new Map(); const sends = []; const records = []; let capacityAvailable = false;
  const rpc = async (name, args) => {
    if (name === "center_notification_context") return { data: { allowed: true, connectionId: "connection", templateId: "template", templateData: { student_name: "An" }, recipients: [{ id: "first", phone: "84905111111" }, { id: "second", phone: "84905222222" }] }, error: null };
    if (name === "center_reserve_delivery") {
      assert.equal(args.p_event_id, "event");
      if (receipts.has(args.p_consumer)) return { data: { allowed: false, reason: "already_completed", status: "completed" }, error: null };
      if (args.p_consumer === "zbs:second" && !capacityAvailable) return { data: { allowed: false, reason: "deferred_daily_limit" }, error: null };
      return { data: { allowed: true, status: "processing" }, error: null };
    }
    if (name === "center_record_delivery") {
      records.push(args);
      receipts.set(args.p_consumer, args.p_provider_id);
      return { data: { status: args.p_status, providerId: args.p_provider_id }, error: null };
    }
    assert.fail(`Unexpected RPC ${name}`);
  };
  const notifications = createCenterNotifications({ rpc, loadProvider: async () => ({ sendTemplate: async (input) => {
    sends.push(input); return { message_id: `message-${sends.length}` };
  } }) });
  const initial = await notifications.deliver({ id: "event" });
  assert.equal(initial.status, "deferred");
  assert.deepEqual(initial.outcomes, [{ status: "completed", providerId: "message-1" }, { allowed: false, reason: "deferred_daily_limit" }]);
  assert.deepEqual(sends.map((send) => send.recipient.phone), ["84905111111"]);
  assert.equal(records.length, 1);
  assert.equal(records[0].p_consumer, "zbs:first");

  capacityAvailable = true;
  const resumed = await notifications.deliver({ id: "event" });
  assert.equal(resumed.status, "delivered");
  assert.equal(resumed.outcomes[0].reason, "already_completed");
  assert.deepEqual(sends.map((send) => send.recipient.phone), ["84905111111", "84905222222"]);
  assert.equal(records.length, 2);
  assert.equal(records[1].p_consumer, "zbs:second");
  await notifications.deliver({ id: "event" });
  assert.equal(sends.length, 2);
  assert.equal(records.length, 2);
});
