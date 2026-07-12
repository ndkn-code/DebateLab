import { z } from "zod";
import type { EmailLocale } from "@/lib/email/types";

export const emailAudienceSegmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("admin_test") }),
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("by_plan"), plan: z.string().trim().min(1).max(80) }),
  z.object({ type: z.literal("by_locale"), locale: z.enum(["en", "vi"]) }),
  z.object({ type: z.literal("by_club"), clubId: z.string().uuid() }),
  z.object({ type: z.literal("referrers") }),
]);

export type EmailAudienceSegment = z.infer<typeof emailAudienceSegmentSchema>;

export interface CampaignAudienceProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  preferences: Record<string, unknown> | null;
}

export interface CampaignRecipient {
  userId: string;
  email: string;
  displayName: string | null;
  locale: EmailLocale;
}

export interface CampaignTrackingRow {
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at?: string | null;
  failed_at?: string | null;
  suppressed_at?: string | null;
}

export interface CampaignResults {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  suppressed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function profileLocale(preferences: Record<string, unknown> | null): EmailLocale {
  return preferences?.preferred_locale === "vi" ? "vi" : "en";
}

function hasCampaignConsent(preferences: Record<string, unknown> | null) {
  return preferences?.email_notifications !== false &&
    preferences?.email_opt_in_scope !== "reminders_only";
}

export function resolveCampaignAudience(input: {
  profiles: CampaignAudienceProfile[];
  suppressedEmails?: Iterable<string>;
  locale?: EmailLocale | null;
}) {
  const suppressed = new Set(
    Array.from(input.suppressedEmails ?? [], (email) => normalizeEmail(email))
  );
  const seen = new Set<string>();
  const recipients: CampaignRecipient[] = [];

  for (const profile of input.profiles) {
    if (!profile.email || !hasCampaignConsent(profile.preferences)) continue;
    const email = normalizeEmail(profile.email);
    if (!email || suppressed.has(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push({
      userId: profile.id,
      email,
      displayName: profile.displayName,
      locale: input.locale ?? profileLocale(profile.preferences),
    });
  }

  return recipients.sort((a, b) => a.email.localeCompare(b.email));
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export function aggregateCampaignResults(rows: CampaignTrackingRow[]): CampaignResults {
  const has = (row: CampaignTrackingRow, timestamp: keyof CampaignTrackingRow, statuses: string[]) =>
    Boolean(row[timestamp]) || statuses.includes(row.status);
  const sent = rows.filter((row) => has(row, "sent_at", ["sent", "delivered", "opened", "clicked"])).length;
  const delivered = rows.filter((row) => has(row, "delivered_at", ["delivered", "opened", "clicked"])).length;
  const opened = rows.filter((row) => has(row, "opened_at", ["opened", "clicked"])).length;
  const clicked = rows.filter((row) => has(row, "clicked_at", ["clicked"])).length;
  const bounced = rows.filter((row) => has(row, "bounced_at", ["bounced"])).length;
  const failed = rows.filter((row) => has(row, "failed_at", ["failed"])).length;
  const suppressed = rows.filter((row) => has(row, "suppressed_at", ["suppressed", "complained"])).length;

  return {
    total: rows.length,
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    failed,
    suppressed,
    deliveryRate: percent(delivered, sent),
    openRate: percent(opened, delivered),
    clickRate: percent(clicked, delivered),
  };
}
