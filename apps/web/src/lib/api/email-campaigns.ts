import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import {
  aggregateCampaignResults,
  emailAudienceSegmentSchema,
  resolveCampaignAudience,
  type CampaignAudienceProfile,
  type CampaignResults,
  type EmailAudienceSegment,
} from "@/lib/email/campaigns-model";
import { dispatchEmailCandidates } from "@/lib/email/dispatch";
import { EMAIL_TEMPLATE_KEYS, type EmailCandidate, type EmailLocale, type EmailTemplateKey } from "@/lib/email/types";
import { buildTemplateVariables, EMAIL_TEMPLATE_META } from "@/lib/email/templates";
import { applyEmailTemplateCopyOverrides, type EmailTemplateCopy } from "@/lib/email/template-overrides";
import { buildUnsubscribeLinks } from "@/lib/email/unsubscribe";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Database, Json, Tables } from "@/types/supabase";

const CAMPAIGN_BATCH_SIZE = 25;
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
  status: "draft" | "scheduled" | "sending" | "sent" | "canceled";
  scheduledFor: string | null;
  createdBy: string | null;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

function record(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapCampaign(row: CampaignRow): EmailCampaign {
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
  };
}

async function verifyAdmin() {
  if (isDevAdminBypassEnabled()) {
    return { actorId: null, admin: createTypedAdminClient() };
  }
  const session = await createTypedServerClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) throw new Error("email-campaigns: unauthorized");
  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError || profile?.role !== "admin") throw new Error("email-campaigns: forbidden");
  return { actorId: user.id, admin: createTypedAdminClient() };
}

async function loadAllProfiles(admin: AdminClient) {
  const rows: Array<Pick<Tables<"profiles">, "id" | "email" | "display_name" | "preferences" | "referred_by" | "role">> = [];
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

async function loadSegmentUserIds(admin: AdminClient, segment: EmailAudienceSegment) {
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
    const { data, error } = await admin.from("referrals").select("referrer_id").limit(10000);
    if (error) throw new Error(`email-campaigns(referrers): ${error.message}`);
    return new Set((data ?? []).map((row) => row.referrer_id));
  }
  return null;
}

async function resolveAudienceWithClient(
  admin: AdminClient,
  segment: EmailAudienceSegment,
  actorId: string | null,
  campaignLocale?: EmailLocale | null
) {
  const [profiles, segmentIds, suppressionsResult] = await Promise.all([
    loadAllProfiles(admin),
    loadSegmentUserIds(admin, segment),
    admin
      .from("email_suppressions")
      .select("email")
      .eq("active", true)
      .or("category.is.null,category.eq.system")
      .limit(10000),
  ]);
  if (suppressionsResult.error) {
    throw new Error(`email-campaigns(suppressions): ${suppressionsResult.error.message}`);
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

  const safeSelected = segment.type === "admin_test" && !actorId ? selected.slice(0, 1) : selected;
  return resolveCampaignAudience({
    profiles: safeSelected.map((profile): CampaignAudienceProfile => ({
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      preferences: record(profile.preferences),
    })),
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
  const { data, error } = await admin.from("email_campaigns").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`email-campaigns(get): ${error?.message ?? "not found"}`);
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
    if (existing.status !== "draft") throw new Error("Only draft campaigns can be edited.");
    const { data, error } = await admin
      .from("email_campaigns")
      .update(payload)
      .eq("id", parsed.id)
      .eq("status", "draft")
      .select("*")
      .single();
    if (error || !data) throw new Error(`email-campaigns(update): ${error?.message ?? "not found"}`);
    return mapCampaign(data);
  }

  const { data, error } = await admin
    .from("email_campaigns")
    .insert({ ...payload, created_by: actorId })
    .select("*")
    .single();
  if (error || !data) throw new Error(`email-campaigns(create): ${error?.message ?? "failed"}`);
  return mapCampaign(data);
}

export async function resolveAudience(segment: EmailAudienceSegment) {
  const parsed = emailAudienceSegmentSchema.parse(segment);
  const { actorId, admin } = await verifyAdmin();
  return resolveAudienceWithClient(admin, parsed, actorId);
}

async function loadCampaignMessages(admin: AdminClient, id: string) {
  const rows: Array<Pick<Tables<"email_messages">, "send_key" | "status" | "sent_at" | "delivered_at" | "opened_at" | "clicked_at" | "bounced_at" | "complained_at" | "failed_at" | "suppressed_at">> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("email_messages")
      .select("send_key, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, complained_at, failed_at, suppressed_at")
      .eq("metadata->>campaignId", id)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`email-campaigns(results): ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return rows;
}

async function getCampaignResultsWithClient(admin: AdminClient, id: string): Promise<CampaignResults> {
  return aggregateCampaignResults(await loadCampaignMessages(admin, id));
}

export async function getCampaignResults(id: string) {
  const { admin } = await verifyAdmin();
  await getCampaignWithClient(admin, id);
  return getCampaignResultsWithClient(admin, id);
}

function buildCandidate(campaign: EmailCampaign, recipient: Awaited<ReturnType<typeof resolveAudienceWithClient>>[number]): EmailCandidate {
  const template = buildTemplateVariables(campaign.templateKey, {
    userName: recipient.displayName || recipient.email.split("@")[0] || "debater",
    locale: campaign.locale,
  });
  const variables = applyEmailTemplateCopyOverrides(
    { ...template, ...campaign.variables },
    campaign.body as EmailTemplateCopy
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
    metadata: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      recipientUserId: recipient.userId,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function sendCampaignBatch(admin: AdminClient, campaign: EmailCampaign, actorId: string | null) {
  if (campaign.status === "canceled") throw new Error("Canceled campaigns cannot be sent.");
  const recipients = await resolveAudienceWithClient(admin, campaign.audience, actorId, campaign.locale);
  const existing = await loadCampaignMessages(admin, campaign.id);
  const attempted = new Set(existing.map((row) => row.send_key));
  const pending = recipients
    .filter((recipient) => !attempted.has(`campaign:${campaign.id}:${recipient.userId}:v1`))
    .slice(0, CAMPAIGN_BATCH_SIZE);

  if (campaign.status !== "sending") {
    const { error } = await admin
      .from("email_campaigns")
      .update({ status: "sending", scheduled_for: null, updated_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .in("status", ["draft", "scheduled"]);
    if (error) throw new Error(`email-campaigns(claim): ${error.message}`);
  }

  const dispatch = await dispatchEmailCandidates({
    supabase: admin,
    candidates: pending.map((recipient) => buildCandidate(campaign, recipient)),
  });
  const results = await getCampaignResultsWithClient(admin, campaign.id);
  const completed = attempted.size + pending.length >= recipients.length;
  const { error: updateError } = await admin
    .from("email_campaigns")
    .update({
      status: completed ? "sent" : "sending",
      sent_count: results.sent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id);
  if (updateError) throw new Error(`email-campaigns(finish): ${updateError.message}`);
  return { campaignId: campaign.id, completed, audienceCount: recipients.length, dispatch, results };
}

export async function sendCampaign(id: string, confirmationName?: string) {
  const { actorId, admin } = await verifyAdmin();
  const campaign = await getCampaignWithClient(admin, id);
  if (confirmationName !== campaign.name) throw new Error("Type the campaign name to confirm sending.");
  return sendCampaignBatch(admin, campaign, actorId);
}

export async function scheduleCampaign(id: string, at: string, confirmationName?: string) {
  const { admin } = await verifyAdmin();
  const campaign = await getCampaignWithClient(admin, id);
  if (campaign.status !== "draft") throw new Error("Only draft campaigns can be scheduled.");
  if (confirmationName !== campaign.name) throw new Error("Type the campaign name to confirm scheduling.");
  const scheduledFor = new Date(at);
  if (!Number.isFinite(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() + 60_000) {
    throw new Error("Schedule time must be at least one minute in the future.");
  }
  const { data, error } = await admin
    .from("email_campaigns")
    .update({ status: "scheduled", scheduled_for: scheduledFor.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error || !data) throw new Error(`email-campaigns(schedule): ${error?.message ?? "not found"}`);
  return mapCampaign(data);
}

export async function cancelCampaign(id: string) {
  const { admin } = await verifyAdmin();
  const campaign = await getCampaignWithClient(admin, id);
  if (!["scheduled", "sending"].includes(campaign.status)) {
    throw new Error("Only scheduled or processing campaigns can be canceled.");
  }
  const { data, error } = await admin
    .from("email_campaigns")
    .update({ status: "canceled", scheduled_for: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "sending"])
    .select("*")
    .single();
  if (error || !data) throw new Error(`email-campaigns(cancel): ${error?.message ?? "not found"}`);
  return mapCampaign(data);
}

export async function processDueEmailCampaigns(admin: AdminClient, now = new Date()) {
  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .in("status", ["scheduled", "sending"])
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(2);
  if (error) throw new Error(`email-campaigns(due): ${error.message}`);
  const due = (data ?? [])
    .map(mapCampaign)
    .filter((campaign) => campaign.status === "sending" || (campaign.scheduledFor && new Date(campaign.scheduledFor) <= now));
  const outcomes = [];
  for (const campaign of due) outcomes.push(await sendCampaignBatch(admin, campaign, campaign.createdBy));
  return outcomes;
}

export async function getEmailCampaignOptions() {
  const { admin } = await verifyAdmin();
  const [clubsResult, plansResult] = await Promise.all([
    admin.from("clubs").select("id, name").eq("status", "active").order("name").limit(200),
    admin.from("subscriptions").select("plan_type").limit(10000),
  ]);
  if (clubsResult.error) throw new Error(`email-campaigns(clubs): ${clubsResult.error.message}`);
  if (plansResult.error) throw new Error(`email-campaigns(plans): ${plansResult.error.message}`);
  return {
    clubs: clubsResult.data ?? [],
    plans: [...new Set((plansResult.data ?? []).map((row) => row.plan_type))].sort(),
  };
}
