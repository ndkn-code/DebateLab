import assert from "node:assert/strict";
import test from "node:test";
import { buildResendRequest, sendResendEmail } from "./provider.mjs";

const event = {
  message_class: "lifecycle",
  topic: "practice",
  payload: {},
};
const recipient = { email: "student@example.com" };
const content = {
  templateKey: "practice_reminder",
  category: "practice",
  subject: "Practice",
  html: "<p>Practice</p>",
  text: "Practice",
  oneClickUnsubscribeUrl: "https://thinkfy.net/api/email/unsubscribe?token=signed",
};
const job = { idempotency_key: "notification:event:user:email" };

test("builds a Resend request with stream and idempotency metadata", () => {
  process.env.RESEND_API_KEY = "test-key";
  const request = buildResendRequest({ event, recipient, content, job });
  assert.equal(request.headers["idempotency-key"], job.idempotency_key);
  assert.equal(request.body.from, "Thinkfy Updates <hello@updates.thinkfy.net>");
  assert.deepEqual(request.body.to, [recipient.email]);
  assert.equal(request.body.tags.find((tag) => tag.name === "stream").value, "updates");
  assert.equal(request.body.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(request.body.headers["List-Unsubscribe"], /token=signed/);
  assert.equal(request.body.headers["List-ID"], "<practice@updates.thinkfy.net>");
});

test("returns provider id and surfaces provider failures", async () => {
  process.env.RESEND_API_KEY = "test-key";
  const success = await sendResendEmail({ event, recipient, content, job }, async () => new Response(JSON.stringify({ id: "resend-1" }), { status: 200 }));
  assert.equal(success.providerMessageId, "resend-1");
  await assert.rejects(
    sendResendEmail({ event, recipient, content, job }, async () => new Response(JSON.stringify({ message: "rate limited" }), { status: 429 })),
    (error) => error.message === "rate limited" && error.retryable === true,
  );
});
