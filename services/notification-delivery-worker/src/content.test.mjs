import assert from "node:assert/strict";
import test from "node:test";
import { buildEmailContent, escapeHtml, isEmailAllowed, senderStreamForMessageClass } from "./content.mjs";

const recipient = { id: "user-1", email: "student@example.com", display_name: "A <student>", preferences: { preferred_locale: "en" } };
const event = {
  id: "event-1",
  event_type: "practice_reminder",
  title: "Practice <now>",
  body: "Keep going & build your case.",
  message_class: "lifecycle",
  topic: "practice",
  payload: { templateKey: "practice_reminder", variables: { ctaUrl: "https://thinkfy.net/en/practice" } },
};
const job = { id: "job-1", idempotency_key: "notification:job-1", channel: "email" };

test("escapes event/user content and produces both HTML and text", () => {
  const content = buildEmailContent(event, recipient, job, "https://thinkfy.net");
  assert.equal(escapeHtml("<x> & \"q\""), "&lt;x&gt; &amp; &quot;q&quot;");
  assert.match(content.html, /Practice &lt;now&gt;/);
  assert.doesNotMatch(content.html, /A <student>/);
  assert.match(content.text, /Keep going & build your case/);
  assert.equal(content.locale, "en");
});

test("uses transactional stream for required mail and updates for optional lifecycle", () => {
  assert.equal(senderStreamForMessageClass("transactional"), "notifications");
  assert.equal(senderStreamForMessageClass("marketing"), "updates");
  assert.equal(isEmailAllowed({ event: { message_class: "transactional" }, settings: null, preference: null }), true);
  assert.equal(isEmailAllowed({ event: { message_class: "lifecycle" }, settings: null, preference: null }), false);
  assert.equal(isEmailAllowed({ event: { message_class: "lifecycle" }, settings: { email_enabled: true }, preference: { enabled: true } }), true);
});

test("rejects an event with no approved template instead of inventing copy", () => {
  assert.throws(
    () => buildEmailContent({ ...event, event_type: "unknown_event", payload: {} }, recipient, job, "https://thinkfy.net"),
    /no supported email template/,
  );
});
