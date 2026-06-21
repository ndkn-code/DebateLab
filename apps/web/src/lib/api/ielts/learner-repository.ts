/**
 * Learner-shell reads for the IELTS home + test library (WS-5.1).
 *
 * All reads go through the typed server client and are RLS-respecting:
 * `ielts_tests` is visible only when published; `ielts_attempts` and
 * `attempt_band_scores` are SELECT-own, so a learner only ever sees their own
 * sittings. No answer keys are touched here. The view-shaping (stitch + sort +
 * card mapping) lives in the pure `lib/ielts/learner/*` modules, which are unit
 * tested; this file only fetches and delegates.
 */
import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import { isEnrolledStudent } from "@/lib/ielts/enrollment";
import type { IeltsBandPrediction } from "@/lib/ielts/adaptive/contracts";
import { DEFAULT_IELTS_TARGET_BAND } from "@/lib/ielts/adaptive/contracts";
import {
  findQuickDiagnosticTest,
  loadActiveIeltsStudyPlan,
  type IeltsDiagnosticTestSummary,
} from "./study-plan-repository";
import { loadIeltsBandPrediction } from "./band-prediction-repository";
import {
  buildIeltsTodayList,
  withDueReviewTodayEntry,
  type IeltsTodayItemView,
} from "@/lib/ielts/home/today";
import {
  buildIeltsHomePlanSummary,
  type IeltsHomePlanSummary,
} from "@/lib/ielts/home/plan-summary";
import {
  buildIeltsHomeRetentionView,
  todayIsoForIeltsRetention,
  type IeltsHomeRetentionView,
  type IeltsRetentionDailyStatRow,
  type IeltsRetentionProfileRow,
} from "@/lib/ielts/home/retention";
import type { StreakActivityEvent } from "@/lib/streaks/model";
import type { IeltsDbClient } from "./client";
import { getPublishedIeltsTests, isGeneratedIeltsSkillDrill } from "./tests-repository";
import { listDueIeltsReviewItems, type IeltsReviewItem } from "./review-repository";
import {
  summarizeAttempts,
  type AttemptBandRow,
  type AttemptRow,
  type AttemptTestRow,
  type IeltsAttemptSummary,
} from "@/lib/ielts/learner/summary";
import { toTestCard, type IeltsTestCard } from "@/lib/ielts/learner/library";

const RECENT_ATTEMPTS_LIMIT = 6;
const HOME_FEATURED_LIMIT = 3;

type ActiveIeltsHomePlan = Awaited<ReturnType<typeof loadActiveIeltsStudyPlan>>;
type PublishedIeltsTest = Awaited<ReturnType<typeof getPublishedIeltsTests>>[number];

interface IeltsHomeReadBundle {
  recentAttempts: IeltsAttemptSummary[];
  published: PublishedIeltsTest[];
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  prediction: IeltsBandPrediction;
  enrolled: boolean;
  retentionProfile: IeltsRetentionProfileRow | null;
  retentionActivities: StreakActivityEvent[] | undefined;
  todayStat: IeltsRetentionDailyStatRow | null;
  dueReviews: IeltsReviewItem[];
}

export interface IeltsHomeData {
  recentAttempts: IeltsAttemptSummary[];
  featuredTests: IeltsTestCard[];
  publishedCount: number;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  prediction: IeltsBandPrediction;
  hasGoal: boolean;
  /** Target band + test-date countdown from the active plan (null with no plan). */
  planSummary: IeltsHomePlanSummary | null;
  /** The prioritized "Today" tasks (2–5), launch hrefs resolved. */
  today: IeltsTodayItemView[];
  /** Actionable items scheduled for today or earlier. */
  todayDueCount: number;
  /** Live spaced-review cards due now. */
  reviewsDueCount: number;
  /** Actionable items hidden behind the Today cap (drives "more in your plan"). */
  todayOverflowCount: number;
  /** Shared retention mechanics rendered on the IELTS home. */
  retention: IeltsHomeRetentionView;
  /** Whether the learner can access teaching-center IELTS course content. */
  isEnrolledStudent: boolean;
}

export interface IeltsLibraryData {
  tests: IeltsTestCard[];
}

/** A learner's most recent sittings (own rows under RLS), newest first. */
export async function listRecentIeltsAttempts(
  params: {
    limit?: number;
    userId?: string;
    client?: IeltsDbClient;
  } = {},
): Promise<IeltsAttemptSummary[]> {
  const supabase = params.client ?? (await createTypedServerClient());
  const limit = params.limit ?? RECENT_ATTEMPTS_LIMIT;

  let query = supabase
    .from("ielts_attempts")
    .select("id, test_id, module, status, attempt_number, started_at, submitted_at")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (params.userId) query = query.eq("user_id", params.userId);

  const { data: attempts, error } = await query;
  if (error) throw new Error(`listRecentIeltsAttempts: ${error.message}`);

  const rows = (attempts ?? []) as AttemptRow[];
  if (rows.length === 0) return [];

  const testIds = [...new Set(rows.map((row) => row.test_id))];
  const attemptIds = rows.map((row) => row.id);

  const [tests, bands] = await Promise.all([
    supabase.from("ielts_tests").select("id, title, slug").in("id", testIds),
    supabase
      .from("attempt_band_scores")
      .select(
        "attempt_id, overall_band, listening_band, reading_band, writing_band, speaking_band",
      )
      .in("attempt_id", attemptIds),
  ]);
  if (tests.error) throw new Error(`listRecentIeltsAttempts(tests): ${tests.error.message}`);
  if (bands.error) throw new Error(`listRecentIeltsAttempts(bands): ${bands.error.message}`);

  return summarizeAttempts(
    rows,
    (tests.data ?? []) as AttemptTestRow[],
    (bands.data ?? []) as AttemptBandRow[],
  );
}

/** Every published test, as library cards (RLS admits published only). */
export async function getIeltsLibraryData(): Promise<IeltsLibraryData> {
  const tests = await getPublishedIeltsTests();
  return { tests: tests.map(toTestCard) };
}

async function loadIeltsRetentionProfile(
  userId: string,
  client: IeltsDbClient,
): Promise<IeltsRetentionProfileRow | null> {
  const { data, error } = await client
    .from("profiles")
    .select("streak_current, streak_longest, streak_last_active_date, xp, level")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`loadIeltsRetentionProfile: ${error.message}`);
  return data;
}

async function loadIeltsRetentionActivityLog(
  userId: string,
  client: IeltsDbClient,
): Promise<StreakActivityEvent[] | undefined> {
  const { data, error } = await client
    .from("activity_log")
    .select("activity_type, reference_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return undefined;
  return (data ?? []) as StreakActivityEvent[];
}

async function loadIeltsTodayStat(
  userId: string,
  today: string,
  client: IeltsDbClient,
): Promise<IeltsRetentionDailyStatRow | null> {
  const { data, error } = await client
    .from("daily_stats")
    .select("date, minutes_studied, practice_minutes, xp_earned, sessions_completed")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();
  if (error) throw new Error(`loadIeltsTodayStat: ${error.message}`);
  return data;
}

async function loadIeltsHomeReadBundle(params: {
  userId: string;
  client: IeltsDbClient;
  targetBand: number;
  today: string;
  now: Date;
}): Promise<IeltsHomeReadBundle> {
  const [
    recentAttempts,
    published,
    diagnosticTest,
    prediction,
    enrolled,
    retentionProfile,
    retentionActivities,
    todayStat,
    dueReviews,
  ] = await Promise.all([
    listRecentIeltsAttempts({ userId: params.userId, client: params.client }),
    getPublishedIeltsTests(params.client, { includeGenerated: true }),
    findQuickDiagnosticTest(params.client),
    loadIeltsBandPrediction(params.userId, {
      targetBand: params.targetBand,
      client: params.client,
    }),
    isEnrolledStudent(params.userId, params.client),
    loadIeltsRetentionProfile(params.userId, params.client),
    loadIeltsRetentionActivityLog(params.userId, params.client),
    loadIeltsTodayStat(params.userId, params.today, params.client),
    listDueIeltsReviewItems(
      { userId: params.userId, dueAt: params.now, limit: 200 },
      params.client,
    ),
  ]);

  return {
    recentAttempts,
    published,
    diagnosticTest,
    prediction,
    enrolled,
    retentionProfile,
    retentionActivities,
    todayStat,
    dueReviews,
  };
}

function buildTestSlugById(
  published: readonly PublishedIeltsTest[],
  diagnosticTest: IeltsDiagnosticTestSummary | null,
): Map<string, string> {
  const testSlugById = new Map<string, string>(
    published.map((test) => [test.id, test.slug]),
  );
  if (diagnosticTest) testSlugById.set(diagnosticTest.id, diagnosticTest.slug);
  return testSlugById;
}

function buildTodayAndRetention(params: {
  activePlan: ActiveIeltsHomePlan;
  reads: IeltsHomeReadBundle;
  today: string;
  now: Date;
  testSlugById: ReadonlyMap<string, string>;
}): Pick<IeltsHomeData, "today" | "todayDueCount" | "todayOverflowCount" | "retention"> {
  const plan = params.activePlan?.plan ?? null;
  const planItems = params.activePlan?.items ?? [];
  const planTodayList = buildIeltsTodayList(planItems, {
    today: params.today,
    testSlugById: params.testSlugById,
  });
  const todayList = withDueReviewTodayEntry(planTodayList, {
    count: params.reads.dueReviews.length,
    earliestDueAt: params.reads.dueReviews[0]?.due_at ?? null,
    skill: params.reads.dueReviews[0]?.skill ?? "reading",
    today: params.today,
  });

  return {
    today: todayList.items,
    todayDueCount: todayList.dueCount,
    todayOverflowCount: todayList.overflowCount,
    retention: buildIeltsHomeRetentionView({
      profile: params.reads.retentionProfile,
      plan,
      planItems,
      todayStat: params.reads.todayStat,
      reviewsDue: params.reads.dueReviews,
      todayItems: todayList.items,
      todayDueCount: todayList.dueCount,
      todayOverflowCount: todayList.overflowCount,
      activities: params.reads.retentionActivities,
      now: params.now,
    }),
  };
}

function buildIeltsHomeDataResponse(params: {
  activePlan: ActiveIeltsHomePlan;
  reads: IeltsHomeReadBundle;
  catalogTests: PublishedIeltsTest[];
  today: string;
  todayAndRetention: ReturnType<typeof buildTodayAndRetention>;
}): IeltsHomeData {
  const plan = params.activePlan?.plan ?? null;

  return {
    recentAttempts: params.reads.recentAttempts,
    featuredTests: params.catalogTests.slice(0, HOME_FEATURED_LIMIT).map(toTestCard),
    publishedCount: params.catalogTests.length,
    diagnosticTest: params.reads.diagnosticTest,
    prediction: params.reads.prediction,
    hasGoal: Boolean(params.activePlan),
    planSummary: buildIeltsHomePlanSummary({ plan, today: params.today }),
    today: params.todayAndRetention.today,
    todayDueCount: params.todayAndRetention.todayDueCount,
    reviewsDueCount: params.reads.dueReviews.length,
    todayOverflowCount: params.todayAndRetention.todayOverflowCount,
    retention: params.todayAndRetention.retention,
    isEnrolledStudent: params.reads.enrolled,
  };
}

/**
 * Home payload: the adaptive dashboard (WS-6.2.1). Composes the predicted band,
 * the prioritized "Today" tasks from the active plan, recent sittings, and a
 * featured-tests teaser. The active study plan + its items are read RLS-own via
 * `loadActiveIeltsStudyPlan`; the published-test list doubles as the slug source
 * for resolving each Today item's launch href (no extra query).
 */
export async function getIeltsHomeData(
  userId: string,
  client?: IeltsDbClient,
): Promise<IeltsHomeData> {
  const supabase = client ?? (await createTypedServerClient());
  const activePlan = await loadActiveIeltsStudyPlan(userId, supabase);
  const targetBand = activePlan?.plan.target_overall_band ?? DEFAULT_IELTS_TARGET_BAND;
  const now = new Date();
  const today = todayIsoForIeltsRetention(now, activePlan?.plan.timezone);
  const reads = await loadIeltsHomeReadBundle({
    userId,
    client: supabase,
    targetBand,
    today,
    now,
  });
  const catalogTests = reads.published.filter((test) => !isGeneratedIeltsSkillDrill(test));
  const todayAndRetention = buildTodayAndRetention({
    activePlan,
    reads,
    today,
    now,
    testSlugById: buildTestSlugById(reads.published, reads.diagnosticTest),
  });
  return buildIeltsHomeDataResponse({
    activePlan,
    reads,
    catalogTests,
    today,
    todayAndRetention,
  });
}
