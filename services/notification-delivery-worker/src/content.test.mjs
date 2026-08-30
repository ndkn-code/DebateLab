import assert from "node:assert/strict";
import test from "node:test";
import { buildEmailContent, escapeHtml, isEmailAllowed, senderStreamForMessageClass } from "./content.mjs";

const recipient = { id: "user-1", email: "student@example.com", display_name: "A <student>", preferences: { preferred_locale: "en" } };
const event = {
  id: "event-1", event_type: "practice_reminder", title: "Practice <now>",
  body: "Keep going & build your case.", message_class: "lifecycle", topic: "practice",
  payload: { templateKey: "practice_reminder", variables: {
    ctaUrl: "https://thinkfy.net/en/practice",
    unsubscribeUrl: "https://thinkfy.net/en/email/unsubscribe?token=signed",
    oneClickUnsubscribeUrl: "https://thinkfy.net/api/email/unsubscribe?token=signed",
  } },
};
const job = { id: "job-1", idempotency_key: "notification:job-1", channel: "email" };

test("renders an accessible, localized email and preserves plain text", () => {
  const content = buildEmailContent(event, recipient, job, "https://thinkfy.net");
  assert.equal(escapeHtml('<x> & "q"'), "&lt;x&gt; &amp; &quot;q&quot;");
  assert.match(content.html, /<html lang="en" dir="ltr">/);
  assert.match(content.html, /name="color-scheme" content="light dark"/);
  assert.match(content.html, /prefers-color-scheme: dark/);
  assert.equal(content.html.match(/<table\b/g)?.length, content.html.match(/<table role="presentation"/g)?.length);
  assert.match(content.html, /background:#222222/);
  assert.match(content.html, /color:#595959;font-size:13px/);
  assert.match(content.html, /color:#005fb8/);
  assert.match(content.html, /Practice &lt;now&gt;/);
  assert.doesNotMatch(content.html, /A <student>/);
  assert.match(content.text, /Manage email preferences/);
  assert.equal(content.oneClickUnsubscribeUrl, "https://thinkfy.net/api/email/unsubscribe?token=signed");
});

test("renders Vietnamese copy with explicit language", () => {
  const content = buildEmailContent(event, { ...recipient, display_name: "Minh", preferences: { preferred_locale: "vi" } }, job, "https://thinkfy.net");
  assert.match(content.html, /<html lang="vi" dir="ltr">/);
  assert.match(content.html, /Chào Minh,/);
  assert.match(content.html, /Quản lý tùy chọn email/);
});

test("uses streams and consent controls", () => {
  assert.equal(senderStreamForMessageClass("transactional"), "notifications");
  assert.equal(senderStreamForMessageClass("marketing"), "updates");
  assert.equal(isEmailAllowed({ event: { message_class: "transactional" }, settings: null, preference: null }), true);
  assert.equal(isEmailAllowed({ event: { message_class: "lifecycle" }, settings: null, preference: null }), false);
  assert.equal(isEmailAllowed({ event: { message_class: "lifecycle" }, settings: { email_enabled: true }, preference: { enabled: true } }), true);
});

test("rejects unsupported templates", () => {
  assert.throws(() => buildEmailContent({ ...event, event_type: "unknown_event", payload: {} }, recipient, job, "https://thinkfy.net"), /no supported email template/);
});
