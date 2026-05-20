import type { SupabaseClient } from "@supabase/supabase-js";
import { createSmartPopupPayload } from "@/lib/smart-popups/rules";
import {
  getThankYouCopy,
  localizeSurveyQuestions,
  normalizeSurveyQuestions,
} from "@/lib/smart-popups/survey";
import type {
  SmartPopupCampaign,
  SmartPopupLocale,
  SmartPopupPayload,
  SmartPopupRules,
  SmartPopupUserTraits,
} from "@/lib/smart-popups/types";

export type SmartPopupAdminPreviewSet = Record<SmartPopupLocale, SmartPopupPayload>;

export interface FeedbackPopupCampaignSummary {
  key: string;
  title: string;
  body: string;
  titleVi: string;
  bodyVi: string;
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
  previews: SmartPopupAdminPreviewSet;
}

export interface SmartPopupSystemCampaignSummary {
  key: string;
  title: string;
  body: string;
  titleVi: string;
  bodyVi: string;
  status: "active" | "paused" | "archived";
  deliveryMode: "targeted" | "send_now" | "scheduled";
  surface: "dashboard" | "global";
  priority: number;
  ctaHref: string;
  updatedAt: string;
  previews: SmartPopupAdminPreviewSet;
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

export type FeedbackPopupAdminHealthStatus = "ok" | "warning" | "error";

export type FeedbackPopupAdminDataSource = "service_role" | "session" | "none";

export interface FeedbackPopupAdminHealthCheck {
  key: string;
  label: string;
  status: FeedbackPopupAdminHealthStatus;
  detail: string;
}

export interface FeedbackPopupAdminHealth {
  status: FeedbackPopupAdminHealthStatus;
  message: string;
  dataSource: FeedbackPopupAdminDataSource;
  serviceRoleConfigured: boolean;
  checks: FeedbackPopupAdminHealthCheck[];
}

export interface FeedbackPopupAdminData {
  campaigns: FeedbackPopupCampaignSummary[];
  systemCampaigns: SmartPopupSystemCampaignSummary[];
  responses: FeedbackPopupResponseSummary[];
  cronRuns: FeedbackPopupCronRunSummary[];
  health: FeedbackPopupAdminHealth;
  kpis: Array<{
    key: string;
    label: string;
    value: string;
    tone: "neutral" | "success" | "warning";
  }>;
}

export interface FeedbackPopupAdminDataOptions {
  dataSource?: FeedbackPopupAdminDataSource;
  serviceRoleConfigured?: boolean;
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

function getCopyText(
  row: Record<string, unknown>,
  key: "copy_en" | "copy_vi",
  field: string,
  fallback = ""
) {
  return asText(getCopy(row, key)[field], fallback);
}

function getQuestionCount(row: Record<string, unknown> | undefined) {
  if (!row) return 0;
  return normalizeSurveyQuestions(row.questions).length;
}

function buildKpis(input: {
  activeCampaigns: number;
  totalResponses: number;
  avgRating: number | null;
}) {
  return [
    {
      key: "active",
      label: "Active campaigns",
      value: String(input.activeCampaigns),
      tone: "success" as const,
    },
    {
      key: "responses",
      label: "Recent responses",
      value: String(input.totalResponses),
      tone: "neutral" as const,
    },
    {
      key: "rating",
      label: "Avg rating",
      value: input.avgRating == null ? "-" : String(input.avgRating),
      tone: "success" as const,
    },
    { key: "reward", label: "Reward", value: "50 Credits", tone: "warning" as const },
  ];
}

function resolveHealthStatus(
  checks: FeedbackPopupAdminHealthCheck[]
): FeedbackPopupAdminHealthStatus {
  if (checks.some((check) => check.status === "error")) return "error";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "ok";
}

export function buildFeedbackPopupAdminHealth(input: {
  dataSource?: FeedbackPopupAdminDataSource;
  serviceRoleConfigured?: boolean;
  campaignCount?: number;
  surveyVersionCount?: number;
  responseCount?: number;
  cronRunCount?: number;
  loadError?: string | null;
}): FeedbackPopupAdminHealth {
  const dataSource = input.dataSource ?? "service_role";
  const serviceRoleConfigured = input.serviceRoleConfigured ?? dataSource === "service_role";
  const campaignCount = input.campaignCount ?? 0;
  const surveyVersionCount = input.surveyVersionCount ?? 0;
  const responseCount = input.responseCount ?? 0;
  const cronRunCount = input.cronRunCount ?? 0;
  const checks: FeedbackPopupAdminHealthCheck[] = [
    {
      key: "service-role",
      label: "Service-role env",
      status: serviceRoleConfigured ? "ok" : "warning",
      detail: serviceRoleConfigured
        ? "SUPABASE_SERVICE_ROLE_KEY is available for admin writes."
        : "SUPABASE_SERVICE_ROLE_KEY is missing; reads can fall back to the signed-in admin session.",
    },
    {
      key: "data-source",
      label: "Admin data source",
      status: dataSource === "service_role" ? "ok" : dataSource === "session" ? "warning" : "error",
      detail:
        dataSource === "service_role"
          ? "Reading with the service-role server client."
          : dataSource === "session"
            ? "Reading with the authenticated admin session."
            : "No Supabase client was available for admin reads.",
    },
    {
      key: "campaigns",
      label: "Feedback campaigns",
      status: input.loadError ? "error" : campaignCount > 0 ? "ok" : "warning",
      detail: input.loadError ?? `${campaignCount} feedback campaign${campaignCount === 1 ? "" : "s"} found.`,
    },
    {
      key: "survey-versions",
      label: "Survey versions",
      status:
        input.loadError || (campaignCount > 0 && surveyVersionCount === 0)
          ? "error"
          : surveyVersionCount > 0
            ? "ok"
            : "warning",
      detail: input.loadError
        ? "Survey versions could not be loaded."
        : `${surveyVersionCount} published survey version${surveyVersionCount === 1 ? "" : "s"} found.`,
    },
    {
      key: "responses",
      label: "Survey responses",
      status: input.loadError ? "error" : "ok",
      detail: input.loadError
        ? "Responses could not be loaded."
        : `${responseCount} recent response${responseCount === 1 ? "" : "s"} loaded.`,
    },
    {
      key: "cron",
      label: "Cron visibility",
      status: input.loadError ? "error" : cronRunCount > 0 ? "ok" : "warning",
      detail: input.loadError
        ? "Cron health could not be loaded."
        : cronRunCount > 0
          ? `${cronRunCount} recent cron run${cronRunCount === 1 ? "" : "s"} loaded.`
          : "No smart-popup cron runs are visible yet.",
    },
  ];
  const status = resolveHealthStatus(checks);
  const message =
    input.loadError ??
    (!serviceRoleConfigured
      ? "Feedback popup reads are using a session fallback. Add SUPABASE_SERVICE_ROLE_KEY before publishing or sending campaigns."
      : status === "ok"
        ? "Feedback popup admin is connected."
        : "Feedback popup admin is connected with warnings to review.");

  return {
    status,
    message,
    dataSource,
    serviceRoleConfigured,
    checks,
  };
}

export function createEmptyFeedbackPopupAdminData(
  health: Partial<FeedbackPopupAdminHealth> = {}
): FeedbackPopupAdminData {
  const generatedHealth = buildFeedbackPopupAdminHealth({
    dataSource: health.dataSource ?? "none",
    serviceRoleConfigured: health.serviceRoleConfigured ?? false,
    loadError: health.message ?? "Feedback popup data could not be loaded.",
  });
  return {
    campaigns: [],
    systemCampaigns: [],
    responses: [],
    cronRuns: [],
    health: {
      ...generatedHealth,
      ...health,
      checks: health.checks ?? generatedHealth.checks,
    },
    kpis: buildKpis({ activeCampaigns: 0, totalResponses: 0, avgRating: null }),
  };
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

function normalizeCampaign(row: Record<string, unknown>): SmartPopupCampaign {
  return {
    id: asText(row.id) || undefined,
    key: asText(row.key),
    surface: row.surface === "global" ? "global" : "dashboard",
    status:
      row.status === "active" || row.status === "archived"
        ? row.status
        : "paused",
    campaign_type:
      row.campaign_type === "feedback_survey" ? "feedback_survey" : "feature_nudge",
    delivery_mode:
      row.delivery_mode === "send_now" || row.delivery_mode === "scheduled"
        ? row.delivery_mode
        : "targeted",
    priority: asNumber(row.priority, 100),
    starts_at: asText(row.starts_at) || null,
    ends_at: asText(row.ends_at) || null,
    cooldown_hours: asNumber(row.cooldown_hours, 24),
    max_impressions_per_user: asNumber(row.max_impressions_per_user, 3),
    daily_cap_per_user: asNumber(row.daily_cap_per_user, 1),
    weekly_cap_per_user: asNumber(row.weekly_cap_per_user, 2),
    reward_credits: asNumber(row.reward_credits, 0),
    response_goal:
      typeof row.response_goal === "number" && Number.isFinite(row.response_goal)
        ? row.response_goal
        : null,
    cta_href: asText(row.cta_href, "/dashboard"),
    image_path: asText(row.image_path, "/images/smart-popups/first-practice.webp"),
    copy_en: getCopy(row, "copy_en") as SmartPopupCampaign["copy_en"],
    copy_vi: getCopy(row, "copy_vi") as SmartPopupCampaign["copy_vi"],
    rules: asRecord(row.rules) as SmartPopupRules,
    metadata: asRecord(row.metadata),
  };
}

function buildAdminPreviewTraits(): SmartPopupUserTraits {
  return {
    role: "student",
    onboardingCompleted: true,
    smartFeaturePopupsEnabled: true,
    firstDashboardVisit: false,
    totalSessionsCompleted: 7,
    daysSinceSignup: 14,
    daysSinceLastPractice: 1,
    currentStreak: 7,
    courseProgressCount: 1,
    coachEventCount: 0,
    weakestSkill: "rebuttal",
    lastScoredSessionScore: 63,
    lastPracticeMinutes: 10,
    segments: [
      "active_user",
      "returning_user",
      "skill_focus",
      "course_discovery",
      "coach_candidate",
    ],
  };
}

function buildSurveyPayload(input: {
  campaign: SmartPopupCampaign;
  latestVersion: Record<string, unknown> | undefined;
  locale: SmartPopupLocale;
}) {
  if (!input.latestVersion) return undefined;

  const questions = normalizeSurveyQuestions(input.latestVersion.questions);
  if (questions.length === 0) return undefined;

  return {
    versionId: asText(input.latestVersion.id, "admin-preview-survey"),
    version: asNumber(input.latestVersion.version, 1),
    rewardCredits: input.campaign.reward_credits,
    questions: localizeSurveyQuestions(questions, input.locale),
    thankYou: getThankYouCopy(
      input.latestVersion.thank_you_copy,
      input.locale,
      input.campaign.reward_credits
    ),
  };
}

function buildPreviewSet(input: {
  campaign: SmartPopupCampaign;
  latestVersion?: Record<string, unknown>;
}): SmartPopupAdminPreviewSet {
  const traits = buildAdminPreviewTraits();
  const en = createSmartPopupPayload({
    campaign: input.campaign,
    traits,
    locale: "en",
  });
  const vi = createSmartPopupPayload({
    campaign: input.campaign,
    traits,
    locale: "vi",
  });

  if (input.campaign.campaign_type === "feedback_survey") {
    en.survey = buildSurveyPayload({
      campaign: input.campaign,
      latestVersion: input.latestVersion,
      locale: "en",
    });
    vi.survey = buildSurveyPayload({
      campaign: input.campaign,
      latestVersion: input.latestVersion,
      locale: "vi",
    });
  }

  en.metadata = {
    ...en.metadata,
    previewOnly: true,
    previewSource: "admin",
  };
  vi.metadata = {
    ...vi.metadata,
    previewOnly: true,
    previewSource: "admin",
  };

  return { en, vi };
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
    const normalizedCampaign = normalizeCampaign(campaign);
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
      bodyVi: asText(copyVi.body, asText(copyEn.body)),
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
      previews: buildPreviewSet({
        campaign: normalizedCampaign,
        latestVersion,
      }),
    };
  });
}

function buildSystemCampaignSummaries(
  campaigns: Record<string, unknown>[]
): SmartPopupSystemCampaignSummary[] {
  return campaigns.map((campaign) => {
    const normalizedCampaign = normalizeCampaign(campaign);
    const fallbackTitle = getCopyText(campaign, "copy_en", "title", normalizedCampaign.key);
    const fallbackBody = getCopyText(campaign, "copy_en", "body");

    return {
      key: normalizedCampaign.key,
      title: fallbackTitle,
      body: fallbackBody,
      titleVi: getCopyText(campaign, "copy_vi", "title", fallbackTitle),
      bodyVi: getCopyText(campaign, "copy_vi", "body", fallbackBody),
      status: normalizedCampaign.status,
      deliveryMode: normalizedCampaign.delivery_mode,
      surface: normalizedCampaign.surface,
      priority: normalizedCampaign.priority,
      ctaHref: normalizedCampaign.cta_href,
      updatedAt: asText(campaign.updated_at, asText(campaign.created_at)),
      previews: buildPreviewSet({ campaign: normalizedCampaign }),
    };
  });
}

export async function getFeedbackPopupAdminData(
  supabase: SupabaseClient,
  options: FeedbackPopupAdminDataOptions = {}
): Promise<FeedbackPopupAdminData> {
  const [campaignsRes, versionsRes, responsesRes, cronRes] = await Promise.all([
    supabase
      .from("smart_popup_campaigns")
      .select(
        "id, key, surface, status, campaign_type, delivery_mode, priority, starts_at, ends_at, cooldown_hours, max_impressions_per_user, daily_cap_per_user, weekly_cap_per_user, reward_credits, response_goal, cta_href, image_path, copy_en, copy_vi, rules, metadata, updated_at, created_at"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("smart_popup_survey_versions")
      .select("id, campaign_key, version, questions, thank_you_copy, created_at")
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
  const campaignRows = (campaignsRes.data ?? []) as Record<string, unknown>[];
  const feedbackRows = campaignRows.filter(
    (campaign) => campaign.campaign_type === "feedback_survey"
  );
  const systemRows = campaignRows.filter(
    (campaign) => campaign.campaign_type === "feature_nudge"
  );
  const campaigns = buildCampaignSummaries({
    campaigns: feedbackRows,
    versions: (versionsRes.data ?? []) as Record<string, unknown>[],
    responses,
  });
  const systemCampaigns = buildSystemCampaignSummaries(systemRows);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;
  const totalResponses = responses.length;
  const avgRatingValues = responses.flatMap((response) => getNumericRatings(response.answers));
  const avgRating =
    avgRatingValues.length > 0
      ? Math.round((avgRatingValues.reduce((sum, rating) => sum + rating, 0) / avgRatingValues.length) * 10) / 10
      : null;
  const cronRuns: FeedbackPopupCronRunSummary[] = (cronRes.data ?? []).map((run) => ({
    id: run.id,
    status: run.status,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    processedUsers: run.processed_users,
    generatedOpportunities: run.generated_opportunities,
    errorMessage: run.error_message,
  }));

  return {
    campaigns,
    systemCampaigns,
    responses,
    cronRuns,
    health: buildFeedbackPopupAdminHealth({
      dataSource: options.dataSource,
      serviceRoleConfigured: options.serviceRoleConfigured,
      campaignCount: campaigns.length,
      surveyVersionCount: (versionsRes.data ?? []).length,
      responseCount: responses.length,
      cronRunCount: cronRuns.length,
    }),
    kpis: buildKpis({ activeCampaigns, totalResponses, avgRating }),
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
