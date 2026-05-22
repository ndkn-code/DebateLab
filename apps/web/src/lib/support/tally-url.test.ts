import assert from "node:assert/strict";

import {
  buildTallyBugReportUrl,
  getConfiguredTallyBugReportFormUrl,
} from "./tally-url";

const url = buildTallyBugReportUrl("https://tally.so/embed/ODolq7", {
  userId: "80700d13-3701-4f29-8f4e-3a51f11e3d2f",
  email: "learner+qa@example.com",
  locale: "en",
  route: "/dashboard?tab=home",
  source: "web_sidebar_help_support",
  userAgent: "Mozilla/5.0 Test Browser",
  viewport: "390x844",
  timestamp: "2026-05-21T16:00:00.000Z",
});

assert.ok(url);

const parsed = new URL(url);
assert.equal(parsed.origin, "https://tally.so");
assert.equal(parsed.pathname, "/embed/ODolq7");
assert.equal(
  parsed.searchParams.get("userId"),
  "80700d13-3701-4f29-8f4e-3a51f11e3d2f"
);
assert.equal(parsed.searchParams.get("email"), "learner+qa@example.com");
assert.equal(parsed.searchParams.get("route"), "/dashboard?tab=home");
assert.equal(parsed.searchParams.get("source"), "web_sidebar_help_support");
assert.equal(parsed.searchParams.get("hideTitle"), "1");
assert.equal(parsed.searchParams.get("transparentBackground"), "1");

const preserved = buildTallyBugReportUrl(
  "https://tally.so/embed/ODolq7?hideTitle=0&existing=value",
  { email: "  " }
);
assert.ok(preserved);

const preservedParsed = new URL(preserved);
assert.equal(preservedParsed.searchParams.get("hideTitle"), "0");
assert.equal(preservedParsed.searchParams.get("existing"), "value");
assert.equal(preservedParsed.searchParams.has("email"), false);

assert.equal(
  buildTallyBugReportUrl("https://example.com/form", { locale: "vi" }),
  null
);

const originalDefaultFormUrl = process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL;
const originalVietnameseFormUrl =
  process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL_VI;

process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL =
  "https://tally.so/embed/ODolq7";
process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL_VI =
  "https://tally.so/embed/NpRXRQ";

assert.equal(
  getConfiguredTallyBugReportFormUrl("en"),
  "https://tally.so/embed/ODolq7"
);
assert.equal(
  getConfiguredTallyBugReportFormUrl("vi"),
  "https://tally.so/embed/NpRXRQ"
);
assert.equal(
  getConfiguredTallyBugReportFormUrl("vi-VN"),
  "https://tally.so/embed/NpRXRQ"
);

if (originalDefaultFormUrl === undefined) {
  delete process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL;
} else {
  process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL = originalDefaultFormUrl;
}

if (originalVietnameseFormUrl === undefined) {
  delete process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL_VI;
} else {
  process.env.NEXT_PUBLIC_TALLY_BUG_REPORT_FORM_URL_VI =
    originalVietnameseFormUrl;
}

console.log("tally url tests passed");
