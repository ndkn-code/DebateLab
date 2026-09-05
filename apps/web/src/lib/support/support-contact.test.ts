import assert from "node:assert/strict";

import {
  buildSupportMailtoUrl,
  getConfiguredSupportEmail,
} from "./support-contact";
import {
  reduceSupportFormState,
  SUPPORT_FORM_TIMEOUT_MS,
} from "./support-form";

const originalSupportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
const originalPrivacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL;

process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "help@example.com";
assert.equal(getConfiguredSupportEmail(), "help@example.com");

const mailto = buildSupportMailtoUrl({ locale: "vi", route: "/vi/dashboard" });
assert.equal(mailto.startsWith("mailto:help@example.com?"), true);
const parsed = new URL(mailto);
assert.equal(parsed.searchParams.get("subject"), "Hỗ trợ Thinkfy");
assert.match(parsed.searchParams.get("body") ?? "", /dashboard/);
assert.ok(parsed.searchParams.get("body")?.includes("\n\n"));
assert.equal(SUPPORT_FORM_TIMEOUT_MS, 8_000);
assert.equal(reduceSupportFormState("loading", "load"), "ready");
assert.equal(reduceSupportFormState("loading", "timeout"), "error");
assert.equal(reduceSupportFormState("error", "retry"), "loading");

process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "unsafe value";
process.env.NEXT_PUBLIC_PRIVACY_EMAIL = "also unsafe";
assert.equal(getConfiguredSupportEmail(), "support@thinkfy.net");
process.env.NEXT_PUBLIC_SUPPORT_EMAIL =
  "support@example.com?bcc=attacker@example.com";
assert.equal(getConfiguredSupportEmail(), "support@thinkfy.net");
process.env.NEXT_PUBLIC_PRIVACY_EMAIL = "backup@example.com";
assert.equal(getConfiguredSupportEmail(), "backup@example.com");
process.env.NEXT_PUBLIC_SUPPORT_EMAIL =
  "support@example.com\nBcc: attacker@example.com";
assert.equal(getConfiguredSupportEmail(), "backup@example.com");

if (originalSupportEmail === undefined)
  delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
else process.env.NEXT_PUBLIC_SUPPORT_EMAIL = originalSupportEmail;
if (originalPrivacyEmail === undefined)
  delete process.env.NEXT_PUBLIC_PRIVACY_EMAIL;
else process.env.NEXT_PUBLIC_PRIVACY_EMAIL = originalPrivacyEmail;

console.log("support contact tests passed");
