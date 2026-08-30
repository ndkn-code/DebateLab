import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateCampaignResults,
  resolveCampaignAudience,
} from "@/lib/email/campaigns-model";

test("audience resolution deduplicates, respects consent, locale, and suppressions", () => {
  const recipients = resolveCampaignAudience({
    profiles: [
      { id: "1", email: " Admin@Example.com ", displayName: "Admin", preferences: { preferred_locale: "vi" } },
      { id: "2", email: "admin@example.com", displayName: "Duplicate", preferences: {} },
      { id: "3", email: "no@example.com", displayName: null, preferences: { email_notifications: false } },
      { id: "4", email: "reminders@example.com", displayName: null, preferences: { email_opt_in_scope: "reminders_only" } },
      { id: "5", email: "blocked@example.com", displayName: null, preferences: {} },
      { id: "6", email: null, displayName: null, preferences: {} },
    ],
    suppressedEmails: ["BLOCKED@example.com"],
  });

  assert.deepEqual(recipients, [
    { userId: "1", email: "admin@example.com", displayName: "Admin", locale: "vi" },
  ]);
});

test("campaign results use tracking timestamps and terminal status fallbacks", () => {
  const results = aggregateCampaignResults([
    { status: "clicked", sent_at: "x", delivered_at: "x", opened_at: "x", clicked_at: "x", bounced_at: null },
    { status: "opened", sent_at: "x", delivered_at: "x", opened_at: "x", clicked_at: null, bounced_at: null },
    { status: "bounced", sent_at: "x", delivered_at: null, opened_at: null, clicked_at: null, bounced_at: "x" },
    { status: "failed", sent_at: null, delivered_at: null, opened_at: null, clicked_at: null, bounced_at: null, failed_at: "x" },
    { status: "suppressed", sent_at: null, delivered_at: null, opened_at: null, clicked_at: null, bounced_at: null, suppressed_at: "x" },
  ]);

  assert.deepEqual(results, {
    total: 5,
    sent: 3,
    delivered: 2,
    opened: 2,
    clicked: 1,
    bounced: 1,
    failed: 1,
    suppressed: 1,
    deliveryRate: 66.7,
    openRate: 100,
    clickRate: 50,
  });
});
