import assert from "node:assert/strict";

import {
  coerceProfileConnectionStatus,
  getProfileConnectionCta,
  normalizeProfileSocialTab,
  normalizeSettingsHandleDraft,
  normalizeSettingsStatusDraft,
} from "@/lib/profile-social/ui-model";

assert.equal(normalizeProfileSocialTab("analytics"), "analytics");
assert.equal(normalizeProfileSocialTab("activities"), "activities");
assert.equal(normalizeProfileSocialTab("wat"), "analytics");
assert.equal(normalizeProfileSocialTab(undefined), "analytics");

assert.equal(
  getProfileConnectionCta({ status: "none", viewerCanRequest: true }),
  "add"
);
assert.equal(
  getProfileConnectionCta({ status: "pending_sent", viewerCanRequest: false }),
  "requested"
);
assert.equal(
  getProfileConnectionCta({ status: "pending_received", viewerCanRequest: false }),
  "respond"
);
assert.equal(
  getProfileConnectionCta({ status: "accepted", viewerCanRequest: false }),
  "friends"
);
assert.equal(
  getProfileConnectionCta({ status: "blocked", viewerCanRequest: false }),
  "blocked"
);
assert.equal(getProfileConnectionCta({ status: "self" }), "self");
assert.equal(getProfileConnectionCta({ status: "none" }), "none");

assert.equal(coerceProfileConnectionStatus("accepted"), "accepted");
assert.equal(coerceProfileConnectionStatus("bad"), "none");

assert.equal(normalizeSettingsHandleDraft(" @Dev.Admin "), "dev.admin");
assert.equal(normalizeSettingsHandleDraft("@@too short"), "too short");
assert.equal(normalizeSettingsStatusDraft("  hello  "), "hello");
assert.equal(normalizeSettingsStatusDraft("x".repeat(150)).length, 140);
