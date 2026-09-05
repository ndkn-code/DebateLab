import test from "node:test";
import assert from "node:assert/strict";
import { createZbsProvider, validateZbsEligibility } from "./zbs.mjs";

const now = "2026-09-04T00:00:00.000Z";
test("eligibility requires connection, approval, consent, eligibility, and a future expiry", () => {
  const good = validateZbsEligibility({ connectionStatus: "connected", templateStatus: "approved", consent: true, eligible: true, expiresAt: "2026-09-05T00:00:00.000Z", now });
  assert.deepEqual(good, { allowed: true, reason: "eligible" });
  assert.equal(validateZbsEligibility({ connectionStatus: "connected", templateStatus: "approved", consent: true, eligible: true, expiresAt: now, now }).reason, "eligibility_expired");
});

test("sends to the documented endpoint and enforces one recipient", async () => {
  const calls = [];
  const provider = createZbsProvider({ accessToken: "token", fetchFn: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ error: 0 }) }; } });
  await provider.sendTemplate({ recipient: { phone: "84912345678" }, templateId: "t1", templateData: { order: "o" }, trackingId: "track" });
  assert.equal(calls[0].url, "https://business.openapi.zalo.me/message/template");
  assert.equal(JSON.parse(calls[0].init.body).tracking_id, "track");
  await assert.rejects(() => provider.sendTemplate({ recipient: { phone: "8", userId: "u" }, templateId: "t", templateData: {} }), /Exactly one/);
});

test("disconnected eligibility is denied without a fake send", async () => {
  assert.deepEqual(validateZbsEligibility({ connectionStatus: "disconnected", templateStatus: "approved", consent: true, eligible: true, expiresAt: "2099-01-01", now }), { allowed: false, reason: "connection_not_connected" });
});
