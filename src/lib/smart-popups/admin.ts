import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeSurveyQuestions,
} from "@/lib/smart-popups/survey";

export interface FeedbackPopupCampaignSummary {
  key: string;
  title: string;
  body: string;
  titleVi: string;
  status: "active" | "paused" | "archived";
  deliveryMode: "targeted" | "send_now" | "scheduled";
  priority: number;
  rewardCredits: number;
  responseGoal: number | null;
  startsAt: string | null;
  endsAt: string | null;
  questionCount: number;
  latestVersionId: string | null;
  latestVersion: number | null;
  responseCount: number;
  averageRating: number | null;
  lastResponseAt: string | null;
  updatedAt: string;
}

export interface FeedbackPopupResponseSummary {
  id: string;
  campaignKey: string;
  locale: string;
  rewardCredits: number;
  submittedAt: string;
  route: string | null;
  answers: Array<{
    questionId: string;
    type: string;
    value: unknown;
  }>;
}

export interface FeedbackPopupCronRunSummary {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  processedUsers: number;
  generatedOpportunities: number;
  errorMessage: string | null;
}

export interface FeedbackPopupAdminData {
  campaigns: FeedbackPopupCampaignSummary[];
  responses: FeedbackPopupResponseSummary[];
  cronRuns: FeedbackPopupCronRunSummary[];
  kpis: Array<{
    key: string;
    label: string;
    value: string;
    tone: "neutral" | "success" | "warning";
  }>;
}

export interface SaveFeedbackPopupCampaignInput {
  actorId: string;
  campaignKey?: string | null;
  titleEn: string;
  bodyEn: string;
  titleVi: string;
  bodyVi: string;
  questions: unknown;
  status?: "active" | "paused" | "archived";
  deliveryMode?: "targeted" | "send_now" | "scheduled";
  priority?: number;
  responseGoal?: number | null;
  rules?: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return slug || "feedback-popup";
}

function getCopy(row: Record<string, unknown>, key: "copy_en" | "copy_vi") {
  return asRecord(row[key]);
}

function getQuestionCount(row: Record<string, unknown> | undefined) {
  if (!row) return 0;
  return normalizeSurveyQuestions(row.questions).length;
}

function normalizeAnswers(value: unknown): FeedbackPopupResponseSummary["answers"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item))
    )
    .map((item) => ({
      questionId: asText(item.questionId),
      type: asText(item.type),
      value: item.value,
    }))
    .filter((item) => item.questionId.length > 0);
}

function extractRoute(context: unknown) {
  const source = asRecord(context);
  return typeof source.route === "string" ? source.route : null;
}

function getNumericRatings(answers: FeedbackPopupResponseSummary["answers"]) {
  return answers
    .filter((answer) => answer.type === "rating" || answer.type === "nps")
    .map((answer) => answer.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function buildCampaignSummaries(input: {
  campaigns: Record<string, unknown>[];
  versions: Record<string, unknown>[];
  responses: FeedbackPopupResponseSummary[];
}): FeedbackPopupCampaignSummary[] {
  const versionsByCampaign = new Map<string, Record<string, unknown>>();
  for (const version of input.versions) {
    const key = asText(version.campaign_key);
    const current = versionsByCampaign.get(key);
    if (!current || asNumber(version.version) > asNumber(current.version)) {
      versionsByCampaign.set(key, version);
    }
  }

  return input.campaigns.map((campaign) => {
    const key = asText(campaign.key);
    const copyEn = getCopy(campaign, "copy_en");
    const copyVi = getCopy(campaign, "copy_vi");
    const latestVersion = versionsByCampaign.get(key);
    const responses = input.responses.filter((response) => response.campaignKey === key);
    const ratings = responses.flatMap((response) => getNumericRatings(response.answers));
    const averageRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
        : null;

    return {
      key,
      title: asText(copyEn.title, key),
      body: asText(copyEn.body),
      titleVi: asText(copyVi.title, asText(copyEn.title, key)),
      status:
        campaign.status === "active" || campaign.status === "archived"
          ? campaign.status
          : "paused",
      deliveryMode:
        campaign.delivery_mode === "send_now" || campaign.delivery_mode === "scheduled"
          ? campaign.delivery_mode
          : "targeted",
      priority: asNumber(campaign.priority, 100),
      rewardCredits: asNumber(campaign.reward_credits, 50),
      responseGoal:
        typeof campaign.response_goal === "number" && Number.isFinite(campaign.response_goal)
          ? campaign.response_goal
          : null,
      startsAt: asText(campaign.starts_at) || null,
      endsAt: asText(campaign.ends_at) || null,
      questionCount: getQuestionCount(latestVersion),
      latestVersionId: asText(latestVersion?.id) || null,
      latestVersion: latestVersion ? asNumber(latestVersion.version, 1) : null,
      responseCount: responses.length,
      averageRating,
      lastResponseAt: responses[0]?.submittedAt ?? null,
      updatedAt: asText(campaign.updated_at, asText(campaign.created_at)),
    };
  });
}

export async function getFeedbackPopupAdminData(
  supabase: SupabaseClient
): Promise<FeedbackPopupAdminData> {
  const [campaignsRes, versionsRes, responsesRes, cronRes] = await Promise.all([
    supabase
      .from("smart_popup_campaigns")
      .select(
        "key, status, delivery_mode, priority, reward_credits, response_goal, starts_at, ends_at, copy_en, copy_vi, updated_at, created_at"
      )
      .eq("campaign_type", "feedback_survey")
      .order("updated_at", { ascending: false }),
    supabase
      .from("smart_popup_survey_versions")
      .select("id, campaign_key, version, questions, created_at")
      .order("version", { ascending: false }),
    supabase
      .from("smart_popup_survey_responses")
      .select("id, campaign_key, locale, answers, context, reward_credits_awarded, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(100),
    supabase
      .from("smart_popup_cron_runs")
      .select("id, status, started_at, finished_at, processed_users, generated_opportunities, error_message")
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  if (campaignsRes.error) throw new Error(campaignsRes.error.message);
  if (versionsRes.error) throw new Error(versionsRes.error.message);
  if (responsesRes.error) throw new Error(responsesRes.error.message);
  if (cronRes.error) throw new Error(cronRes.error.message);

  const responses: FeedbackPopupResponseSummary[] = (responsesRes.data ?? []).map((row) => ({
    id: row.id,
    campaignKey: row.campaign_key,
    locale: row.locale,
    rewardCredits: row.reward_credits_awarded,
    submittedAt: row.submitted_at,
    route: extractRoute(row.context),
    answers: normalizeAnswers(row.answers),
  }));
  const campaigns = buildCampaignSummaries({
    campaigns: (campaignsRes.data ?? []) as Record<string, unknown>[],
    versions: (versionsRes.data ?? []) as Record<string, unknown>[],
    responses,
  });
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
  const totalResponses = responses.length;
  const avgRatingValues = responses.flatMap((response) => getNumericRatings(response.answers));
  const avgRating =
    avgRatingValues.length > 0
      ? Math.round((avgRatingValues.reduce((sum, rating) => sum + rating, 0) / avgRatingValues.length) * 10) / 10
      : null;

  return {
    campaigns,
    responses,
    cronRuns: (cronRes.data ?? []).map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      processedUsers: run.processed_users,
      generatedOpportunities: run.generated_opportunities,
      errorMessage: run.error_message,
    })),
    kpis: [
      { key: "active", label: "Active campaigns", value: String(activeCampaigns), tone: "success" },
      { key: "responses", label: "Recent responses", value: String(totalResponses), tone: "neutral" },
      { key: "rating", label: "Avg rating", value: avgRating == null ? "-" : String(avgRating), tone: "success" },
      { key: "reward", label: "Reward", value: "50 Credits", tone: "warning" },
    ],
  };
}

async function getNextVersion(supabase: SupabaseClient, campaignKey: string) {
  const { data, error } = await supabase
    .from("smart_popup_survey_versions")
    .select("version")
    .eq("campaign_key", campaignKey)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return asNumber((data as { version?: number } | null)?.version, 0) + 1;
}

export async function saveFeedbackPopupCampaign(
  supabase: SupabaseClient,
  input: SaveFeedbackPopupCampaignInput
) {
  const questions = normalizeSurveyQuestions(input.questions);
  if (questions.length === 0) {
    throw new Error("Add at least one valid feedback question.");
  }

  const key =
    input.campaignKey && input.campaignKey.trim()
      ? slugify(input.campaignKey)
      : `${slugify(input.titleEn)}-${Date.now().toString(36)}`;
  const status = input.status ?? "paused";
  const now = new Date().toISOString();

  const { error: campaignError } = await supabase
    .from("smart_popup_campaigns")
    .upsert(
      {
        key,
        surface: "global",
        status,
        campaign_type: "feedback_survey",
        delivery_mode: input.deliveryMode ?? "targeted",
        priority: input.priority ?? 25,
        cooldown_hours: 168,
        max_impressions_per_user: 1,
        daily_cap_per_user: 1,
        weekly_cap_per_user: 1,
        reward_credits: 50,
        response_goal: input.responseGoal ?? null,
        cta_href: "/dashboard",
        image_path: "/images/smart-popups/ask-coach.webp",
        copy_en: {
          eyebrow: "Quick feedback",
          title: input.titleEn.trim(),
          body: input.bodyEn.trim(),
          ctaLabel: "Share feedback",
          dismissLabel: "Later",
          dontShowLabel: "Don't ask again",
          alt: "DebateLab feedback prompt",
        },
        copy_vi: {
          eyebrow: "Góp ý nhanh",
          title: input.titleVi.trim() || input.titleEn.trim(),
          body: input.bodyVi.trim() || input.bodyEn.trim(),
          ctaLabel: "Gửi góp ý",
          dismissLabel: "Để sau",
          dontShowLabel: "Đừng hỏi lại",
          alt: "Hộp góp ý DebateLab",
        },
        rules: {
          maxSubmissionsPerUser: 1,
          ...(input.rules ?? {}),
        },
        metadata: {
          adminLabel: input.titleEn.trim(),
          managedBy: "feedback-popups-admin",
        },
        published_at: status === "active" ? now : null,
        published_by: status === "active" ? input.actorId : null,
        created_by: input.actorId,
        updated_by: input.actorId,
        updated_at: now,
      },
      { onConflict: "key" }
    );

  if (campaignError) throw new Error(campaignError.message);

  const version = await getNextVersion(supabase, key);
  const { error: versionError } = await supabase
    .from("smart_popup_survey_versions")
    .insert({
      campaign_key: key,
      version,
      questions,
      thank_you_copy: {
        en: {
          title: "Thanks for the feedback",
          body: "You earned 50 Credits. We will use this to make DebateLab sharper.",
        },
        vi: {
          title: "Cảm ơn bạn đã góp ý",
          body: "Bạn đã nhận 50 Credits. Tụi mình sẽ dùng góp ý này để cải thiện DebateLab.",
        },
      },
      created_by: input.actorId,
      published_at: status === "active" ? now : null,
    });

  if (versionError) throw new Error(versionError.message);

  return { key, version };
}

export async function setFeedbackPopupCampaignStatus(
  supabase: SupabaseClient,
  input: {
    actorId: string;
    campaignKey: string;
    status: "active" | "paused" | "archived";
  }
) {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: input.status,
    published_at: input.status === "active" ? now : null,
    published_by: input.status === "active" ? input.actorId : null,
    updated_by: input.actorId,
    updated_at: now,
  };

  if (input.status === "active") {
    update.delivery_mode = "targeted";
  }

  const { error } = await supabase
    .from("smart_popup_campaigns")
    .update(update)
    .eq("key", input.campaignKey)
    .eq("campaign_type", "feedback_survey");

  if (error) throw new Error(error.message);
}

export async function sendFeedbackPopupNow(
  supabase: SupabaseClient,
  input: {
    actorId: string;
    campaignKey: string;
  }
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("smart_popup_campaigns")
    .update({
      status: "active",
      delivery_mode: "send_now",
      priority: 1,
      starts_at: now,
      published_at: now,
      published_by: input.actorId,
      updated_by: input.actorId,
      updated_at: now,
    })
    .eq("key", input.campaignKey)
    .eq("campaign_type", "feedback_survey");

  if (error) throw new Error(error.message);
}
