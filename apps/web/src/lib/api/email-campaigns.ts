import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  aggregateCampaignResults,
  emailAudienceSegmentSchema,
  resolveCampaignAudience,
  type CampaignAudienceProfile,
  type CampaignResults,
  type EmailAudienceSegment,
} from "@/lib/email/campaigns-model";
import { dispatchEmailCandidates } from "@/lib/email/dispatch";
import {
  EMAIL_TEMPLATE_KEYS,
  type EmailCandidate,
  type EmailCategory,
  type EmailLocale,
  type EmailTemplateKey,
} from "@/lib/email/types";
import {
  buildTemplateVariables,
  EMAIL_TEMPLATE_META,
} from "@/lib/email/templates";
import {
  applyEmailTemplateCopyOverrides,
  type EmailTemplateCopy,
} from "@/lib/email/template-overrides";
import { buildUnsubscribeLinks } from "@/lib/email/unsubscribe";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Database, Json, Tables } from "@/types/supabase";

const CAMPAIGN_BATCH_SIZE = 250;
const PAGE_SIZE = 1000;

const campaignInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  templateKey: z.enum(EMAIL_TEMPLATE_KEYS),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.record(z.string(), z.unknown()).default({}),
  variables: z.record(z.string(), z.unknown()).default({}),
  locale: z.enum(["en", "vi"]).default("en"),
  audience: emailAudienceSegmentSchema,
});

type CampaignRow = Tables<"email_campaigns">;
type AdminClient = SupabaseClient<Database>;

export interface EmailCampaign {
  id: string;
  name: string;
  templateKey: EmailTemplateKey;
  subject: string | null;
  body: Record<string, unknown>;
  variables: Record<string, unknown>;
  locale: EmailLocale;
  audience: EmailAudienceSegment;
  status:
    | "draft"
    | "approved"
    | "scheduled"
    | "sending"
    | "paused"
    | "sent"
    | "failed"
    | "canceled";
  scheduledFor: string | null;
  createdBy: string | null;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  audienceSnapshotCount: number;
  completedAt: string | null;
  lastError: string | null;
}

function record(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapCampaign(row: CampaignRow): EmailCampaign {
  const extended = row as CampaignRow & {
    approved_at?: string | null;
    approved_by?: string | null;
    audience_snapshot_count?: number;
    completed_at?: string | null;
    last_error?: string | null;
  };
  return {
    id: row.id,
    name: row.name,
    templateKey: row.template_key as EmailTemplateKey,
    subject: row.subject,
    body: record(row.body),
    variables: record(row.variables),
    locale: row.locale === "vi" ? "vi" : "en",
    audience: emailAudienceSegmentSchema.parse(row.audience),
    status: row.status as EmailCampaign["status"],
    scheduledFor: row.scheduled_for,
    createdBy: row.created_by,
    sentCount: row.sent_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: extended.approved_at ?? null,
    approvedBy: extended.approved_by ?? null,
    audienceSnapshotCount: extended.audience_snapshot_count ?? 0,
    completedAt: extended.completed_at ?? null,
    lastError: extended.last_error ?? null,
  };
}

async function verifyAdmin() {
  const session = await createTypedServerClient();
  const {
    data: { user },
    error: userError,
  } = await session.auth.getUser();
  if (userError || !user) throw new Error("email-campaigns: unauthorized");
  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError || profile?.role !== "admin")
    throw new Error("email-campaigns: forbidden");
  return { actorId: user.id, admin: createTypedAdminClient() };
}

async function loadAllProfiles(admin: AdminClient) {
  const rows: Array<
    Pick<
      Tables<"profiles">,
      "id" | "email" | "display_name" | "preferences" | "referred_by" | "role"
    >
  > = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, display_name, preferences, referred_by, role")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`email-campaigns(profiles): ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return rows;
}

async function loadSegmentUserIds(
  admin: AdminClient,
  segment: EmailAudienceSegment,
) {
  if (segment.type === "by_plan") {
    const { data, error } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("plan_type", segment.plan)
      .in("status", ["active", "trialing"])
      .limit(10000);
    if (error) throw new Error(`email-campaigns(plan): ${error.message}`);
    return new Set((data ?? []).map((row) => row.user_id));
  }
  if (segment.type === "by_club") {
    const { data, error } = await admin
      .from("club_memberships")
      .select("user_id")
      .eq("club_id", segment.clubId)
      .eq("status", "active")
      .is("removed_at", null)
      .limit(10000);
    if (error) throw new Error(`email-campaigns(club): ${error.message}`);
    return new Set((data ?? []).map((row) => row.user_id));
  }
  if (segment.type === "referrers") {
    const { data, error } = await admin
      .from("referrals")
      .select("referrer_id")
      .limit(10000);
    if (error) throw new Error(`email-campaigns(referrers): ${error.message}`);
    return new Set((data ?? []).map((row) => row.referrer_id));
  }
  return null;
}

async function resolveAudienceWithClient(
  admin: AdminClient,
  segment: EmailAudienceSegment,
  actorId: string | null,
  campaignLocale?: EmailLocale | null,
  suppressionCategory?: EmailCategory,
) {
  let suppressionQuery = admin
    .from("email_suppressions")
    .select("email")
    .eq("active", true);
  suppressionQuery = suppressionCategory
    ? suppressionQuery.or(`category.is.null,category.eq.${suppressionCategory}`)
    : suppressionQuery.is("category", null);
  const [profiles, segmentIds, suppressionsResult] = await Promise.all([
    loadAllProfiles(admin),
    loadSegmentUserIds(admin, segment),
    suppressionQuery.limit(10000),
  ]);
  if (suppressionsResult.error) {
    throw new Error(
      `email-campaigns(suppressions): ${suppressionsResult.error.message}`,
    );
  }

  const selected = profiles.filter((profile) => {
    if (segment.type === "admin_test") {
      return actorId ? profile.id === actorId : profile.role === "admin";
    }
    if (segment.type === "by_locale") {
      const preferred = record(profile.preferences).preferred_locale;
      return segment.locale === "vi" ? preferred === "vi" : preferred !== "vi";
    }
    if (segmentIds) return segmentIds.has(profile.id);
    return true;
  });

  const safeSelected =
    segment.type === "admin_test" && !actorId ? selected.slice(0, 1) : selected;
  return resolveCampaignAudience({
    profiles: safeSelected.map(
      (profile): CampaignAudienceProfile => ({
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        preferences: record(profile.preferences),
      }),
    ),
    suppressedEmails: (suppressionsResult.data ?? []).map((row) => row.email),
    locale: campaignLocale,
  });
}

export async function listCampaigns() {
  const { admin } = await verifyAdmin();
  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`email-campaigns(list): ${error.message}`);
  return (data ?? []).map(mapCampaign);
}

export async function getCampaign(id: string) {
  const { admin } = await verifyAdmin();
  return getCampaignWithClient(admin, id);
}

async function getCampaignWithClient(admin: AdminClient, id: string) {
  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data)
    throw new Error(`email-campaigns(get): ${error?.message ?? "not found"}`);
  return mapCampaign(data);
}

export async function upsertCampaign(input: unknown) {
  const parsed = campaignInputSchema.parse(input);
  const { actorId, admin } = await verifyAdmin();
  const payload = {
    name: parsed.name,
    template_key: parsed.templateKey,
    subject: parsed.subject || null,
    body: parsed.body as Json,
    variables: parsed.variables as Json,
    locale: parsed.locale,
    audience: parsed.audience as Json,
    updated_at: new Date().toISOString(),
  };

  if (parsed.id) {
    const existing = await getCampaignWithClient(admin, parsed.id);
    if (existing.status !== "draft")
      throw new Error("Only draft campaigns can be edited.");
    const { data, error } = await admin
      .from("email_campaigns")
      .update(payload)
      .eq("id", parsed.id)
      .eq("status", "draft")
      .select("*")
      .single();
    if (error || !data)
      throw new Error(
        `email-campaigns(update): ${error?.message ?? "not found"}`,
      );
    return mapCampaign(data);
  }

  const { data, error } = await admin
    .from("email_campaigns")
    .insert({ ...payload, created_by: actorId })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(`email-campaigns(create): ${error?.message ?? "failed"}`);
  return mapCampaign(data);
}

export async function resolveAudience(segment: EmailAudienceSegment) {
  const parsed = emailAudienceSegmentSchema.parse(segment);
  const { actorId, admin } = await verifyAdmin();
  return resolveAudienceWithClient(admin, parsed, actorId);
}

type CampaignRecipientRow = {
  id: string;
  campaign_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  locale: EmailLocale;
  status:
    | "pending"
    | "processing"
    | "sent"
    | "delivered"
    | "failed"
    | "suppressed"
    | "canceled";
  attempts: number;
  max_attempts: number;
  send_key: string;
  available_at: string;
  last_error: string | null;
};

function campaignDb(admin: AdminClient) {
  return admin as unknown as SupabaseClient;
}

export async function approveCampaign(id: string, confirmationName?: string) {
  const { actorId, admin } = await verifyAdmin();
  const campaign = await getCampaignWithClient(admin, id);
  if (campaign.status !== "draft")
    throw new Error("Only draft campaigns can be approved.");
  if (confirmationName !== campaign.name)
    throw new Error("Type the campaign name to confirm approval.");

  const recipients = await resolveAudienceWithClient(
    admin,
    campaign.audience,
    actorId,
    campaign.locale,
    EMAIL_TEMPLATE_META[campaign.templateKey].category,
  );
  if (recipients.length === 0)
    throw new Error(
      "Campaign audience is empty after consent and suppression checks.",
    );

  const db = campaignDb(admin);
  const { error: recipientError } = await db
    .from("email_campaign_recipients")
    .insert(
      recipients.map((recipient) => ({
        campaign_id: campaign.id,
        user_id: recipient.userId,
        email: recipient.email,
        display_name: recipient.displayName,
        locale: recipient.locale,
        status: "pending",
        send_key: `campaign:${campaign.id}:${recipient.userId}:v1`,
      })),
    );
  if (recipientError)
    throw new Error(`email-campaigns(snapshot): ${recipientError.message}`);

  const approvedAt = new Date().toISOString();
  const { data, error } = await db
    .from("email_campaigns")
    .update({
      status: "approved",
      approved_at: approvedAt,
      approved_by: actorId,
      audience_snapshot_count: recipients.length,
      updated_at: approvedAt,
    })
    .eq("id", campaign.id)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error || !data) {
    await db
      .from("email_campaign_recipients")
      .delete()
      .eq("campaign_id", campaign.id);
    throw new Error(
      `email-campaigns(approve): ${error?.message ?? "not found"}`,
    );
  }
  return mapCampaign(data as CampaignRow);
}

async function loadCampaignMessages(admin: AdminClient, id: string) {
  const rows: Array<
    Pick<
      Tables<"email_messages">,
      | "send_key"
      | "status"
      | "sent_at"
      | "delivered_at"
      | "opened_at"
      | "clicked_at"
      | "bounced_at"
      | "complained_at"
      | "failed_at"
      | "suppressed_at"
    >
  > = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("email_messages")
      .select(
        "send_key, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at, failed_at, suppressed_at",
      )
      .eq("metadata->>campaignId", id)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`email-campaigns(results): ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return rows;
}

async function getCampaignResultsWithClient(
  admin: AdminClient,
  id: string,
): Promise<CampaignResults> {
  return aggregateCampaignResults(await loadCampaignMessages(admin, id));
}

export async function getCampaignResults(id: string) {
  const { admin } = await verifyAdmin();
  await getCampaignWithClient(admin, id);
  return getCampaignResultsWithClient(admin, id);
}

function buildCandidate(
  campaign: EmailCampaign,
  recipient: Awaited<ReturnType<typeof resolveAudienceWithClient>>[number],
): EmailCandidate {
  const template = buildTemplateVariables(campaign.templateKey, {
    userName:
      recipient.displayName || recipient.email.split("@")[0] || "debater",
    locale: campaign.locale,
  });
  const variables = applyEmailTemplateCopyOverrides(
    { ...template, ...campaign.variables },
    campaign.body as EmailTemplateCopy,
  );
  const category = EMAIL_TEMPLATE_META[campaign.templateKey].category;
  const unsubscribe = buildUnsubscribeLinks({
    email: recipient.email,
    userId: recipient.userId,
    category,
    templateKey: campaign.templateKey,
  });
  variables.unsubscribeUrl = unsubscribe.unsubscribeUrl;
  variables.oneClickUnsubscribeUrl = unsubscribe.oneClickUnsubscribeUrl;

  return {
    userId: recipient.userId,
    toEmail: recipient.email,
    templateKey: campaign.templateKey,
    category,
    locale: campaign.locale,
    sendKey: `campaign:${campaign.id}:${recipient.userId}:v1`,
    subject: campaign.subject || template.subject,
    variables,
    messageClass: "marketing",
    topic: "product_updates",
    senderStream: "updates",
    metadata: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      recipientUserId: recipient.userId,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function sendCampaignBatch(admin: AdminClient, campaign: EmailCampaign) {
  if (!["approved", "scheduled", "sending"].includes(campaign.status)) {
    throw new Error("Campaign must be approved before it can be sent.");
  }
  const db = campaignDb(admin);
  const { data: recipientData, error: recipientError } = await db
    .from("email_campaign_recipients")
    .select("*")
    .eq("campaign_id", campaign.id)
    .in("status", ["pending", "failed"])
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(CAMPAIGN_BATCH_SIZE * 2);
  if (recipientError)
    throw new Error(`email-campaigns(recipients): ${recipientError.message}`);
  const pending = ((recipientData ?? []) as CampaignRecipientRow[])
    .filter((recipient) => recipient.attempts < recipient.max_attempts)
    .slice(0, CAMPAIGN_BATCH_SIZE);

  if (campaign.status !== "sending") {
    const { error } = await db
      .from("email_campaigns")
      .update({
        status: "sending",
        scheduled_for: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .in("status", ["approved", "scheduled"]);
    if (error) throw new Error(`email-campaigns(claim): ${error.message}`);
  }

  if (pending.length > 0) {
    await Promise.all(
      pending.map((recipient) =>
        db
          .from("email_campaign_recipients")
          .update({
            status: "processing",
            attempts: recipient.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipient.id),
      ),
    );
  }
  const dispatch = await dispatchEmailCandidates({
    supabase: admin,
    candidates: pending.map((recipient) =>
      buildCandidate(campaign, {
        userId: recipient.user_id,
        email: recipient.email,
        displayName: recipient.display_name,
        locale: recipient.locale,
      }),
    ),
  });
  if (pending.length > 0) {
    const sendKeys = pending.map((recipient) => recipient.send_key);
    const { data: messageRows, error: messageError } = await db
      .from("email_messages")
      .select("id, send_key, status, error_message")
      .in("send_key", sendKeys);
    if (messageError)
      throw new Error(
        `email-campaigns(message-status): ${messageError.message}`,
      );
    const messagesByKey = new Map(
      (
        (messageRows ?? []) as Array<{
          id: string;
          send_key: string;
          status: string;
          error_message: string | null;
        }>
      ).map((message) => [message.send_key, message]),
    );
    await Promise.all(
      pending.map((recipient) => {
        const message = messagesByKey.get(recipient.send_key);
        const exhausted = recipient.attempts + 1 >= recipient.max_attempts;
        const status = !message
          ? "pending"
          : ["delivered", "opened", "clicked"].includes(message.status)
            ? "delivered"
            : ["sent", "scheduled", "delayed"].includes(message.status)
              ? "sent"
              : ["suppressed", "complained"].includes(message.status)
                ? "suppressed"
                : "failed";
        return db
          .from("email_campaign_recipients")
          .update({
            status,
            email_message_id: message?.id ?? null,
            last_error:
              message?.error_message ??
              (!message ? "Delivery was not attempted." : null),
            available_at:
              status === "failed" && !exhausted
                ? new Date(
                    Date.now() +
                      Math.min(3_600_000, 30_000 * 2 ** recipient.attempts),
                  ).toISOString()
                : recipient.available_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);
      }),
    );
  }

  const results = await getCampaignResultsWithClient(admin, campaign.id);
  const { data: outstandingRows, error: outstandingError } = await db
    .from("email_campaign_recipients")
    .select("id, status, attempts, max_attempts")
    .eq("campaign_id", campaign.id)
    .in("status", ["pending", "processing", "failed"]);
  if (outstandingError)
    throw new Error(
      `email-campaigns(outstanding): ${outstandingError.message}`,
    );
  const outstanding = (outstandingRows ?? []) as Array<{
    status: string;
    attempts: number;
    max_attempts: number;
  }>;
  const retryable = outstanding.some(
    (recipient) =>
      recipient.status !== "failed" ||
      recipient.attempts < recipient.max_attempts,
  );
  const exhausted = outstanding.length > 0 && !retryable;
  const completed = outstanding.length === 0;
  const nextStatus = completed ? "sent" : exhausted ? "failed" : "sending";
  const { error: updateError } = await db
    .from("email_campaigns")
    .update({
      status: nextStatus,
      sent_count: results.sent,
      completed_at: completed ? new Date().toISOString() : null,
      last_error: exhausted
        ? "One or more recipients exhausted retry attempts."
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);
  if (updateError)
    throw new Error(`email-campaigns(finish): ${updateError.message}`);
  return {
    campaignId: campaign.id,
    completed,
    audienceCount: campaign.audienceSnapshotCount,
    dispatch,
    results,
  };
}

export async function sendCampaign(id: string, confirmationName?: string) {
  const { admin } = await verifyAdmin();
  const campaign = await getCampaignWithClient(admin, id);
  if (campaign.status !== "approved") {
    throw new Error("Campaign must be approved before sending.");
  }
  if (confirmationName !== campaign.name)
    throw new Error("Type the campaign name to confirm sending.");
  return sendCampaignBatch(admin, campaign);
}

export async function scheduleCampaign(
  id: string,
  at: string,
  confirmationName?: string,
) {
  const { admin } = await verifyAdmin();
  const campaign = await getCampaignWithClient(admin, id);
  if (campaign.status !== "approved")
    throw new Error("Only approved campaigns can be scheduled.");
  if (confirmationName !== campaign.name)
    throw new Error("Type the campaign name to confirm scheduling.");
  const scheduledFor = new Date(at);
  if (
    !Number.isFinite(scheduledFor.getTime()) ||
    scheduledFor.getTime() < Date.now() + 60_000
  ) {
    throw new Error("Schedule time must be at least one minute in the future.");
  }
  const { data, error } = await admin
    .from("email_campaigns")
    .update({
      status: "scheduled",
      scheduled_for: scheduledFor.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "approved")
    .select("*")
    .single();
  if (error || !data)
    throw new Error(
      `email-campaigns(schedule): ${error?.message ?? "not found"}`,
    );
  return mapCampaign(data);
}

export async function cancelCampaign(id: string) {
  const { admin } = await verifyAdmin();
  const campaign = await getCampaignWithClient(admin, id);
  if (
    !["approved", "scheduled", "sending", "paused"].includes(campaign.status)
  ) {
    throw new Error("Only approved or processing campaigns can be canceled.");
  }
  const { data, error } = await admin
    .from("email_campaigns")
    .update({
      status: "canceled",
      scheduled_for: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["approved", "scheduled", "sending", "paused"])
    .select("*")
    .single();
  if (error || !data)
    throw new Error(
      `email-campaigns(cancel): ${error?.message ?? "not found"}`,
    );
  const db = campaignDb(admin);
  const { error: recipientError } = await db
    .from("email_campaign_recipients")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("campaign_id", id)
    .in("status", ["pending", "processing", "failed"]);
  if (recipientError)
    throw new Error(
      `email-campaigns(cancel-recipients): ${recipientError.message}`,
    );
  return mapCampaign(data);
}

export async function pauseCampaign(id: string) {
  const { admin } = await verifyAdmin();
  const db = campaignDb(admin);
  const { data, error } = await db
    .from("email_campaigns")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "sending"])
    .select("*")
    .single();
  if (error || !data)
    throw new Error(`email-campaigns(pause): ${error?.message ?? "not found"}`);
  return mapCampaign(data as CampaignRow);
}

export async function resumeCampaign(id: string) {
  const { admin } = await verifyAdmin();
  const db = campaignDb(admin);
  const { data, error } = await db
    .from("email_campaigns")
    .update({
      status: "sending",
      scheduled_for: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "paused")
    .select("*")
    .single();
  if (error || !data)
    throw new Error(
      `email-campaigns(resume): ${error?.message ?? "not found"}`,
    );
  return mapCampaign(data as CampaignRow);
}

export async function processDueEmailCampaigns(
  admin: AdminClient,
  now = new Date(),
) {
  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .in("status", ["scheduled", "sending"])
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(10);
  if (error) throw new Error(`email-campaigns(due): ${error.message}`);
  const due = (data ?? [])
    .map(mapCampaign)
    .filter(
      (campaign) =>
        campaign.status === "sending" ||
        (campaign.scheduledFor && new Date(campaign.scheduledFor) <= now),
    );
  const outcomes = [];
  for (const campaign of due)
    outcomes.push(await sendCampaignBatch(admin, campaign));
  return outcomes;
}

export async function getEmailCampaignOptions() {
  const { admin } = await verifyAdmin();
  const [clubsResult, plansResult] = await Promise.all([
    admin
      .from("clubs")
      .select("id, name")
      .eq("status", "active")
      .order("name")
      .limit(200),
    admin.from("subscriptions").select("plan_type").limit(10000),
  ]);
  if (clubsResult.error)
    throw new Error(`email-campaigns(clubs): ${clubsResult.error.message}`);
  if (plansResult.error)
    throw new Error(`email-campaigns(plans): ${plansResult.error.message}`);
  return {
    clubs: clubsResult.data ?? [],
    plans: [
      ...new Set((plansResult.data ?? []).map((row) => row.plan_type)),
    ].sort(),
  };
}
