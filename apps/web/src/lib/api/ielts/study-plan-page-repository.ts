/**
 * Read-time repository for the IELTS study-plan page (WS-6.2.2).
 *
 * All reads are RLS-own through the typed client: the learner's active plan and
 * its dated items, their spaced-review queue (`ielts_review_items`), and their
 * plan revision log (`ielts_study_plan_revisions`, written by WS-6.2.4). The
 * latest Track B prediction comes from the band-prediction repository. View
 * shaping is delegated to the pure `lib/ielts/study-plan/page-view` module; this
 * file only fetches + resolves the learner's "today" in their plan timezone.
 */
import "server-only";
import {
  DEFAULT_IELTS_TARGET_BAND,
  type IeltsBandPrediction,
  type IeltsGoalModel,
} from "@/lib/ielts/adaptive/contracts";
import { goalFromStudyPlanRow } from "@/lib/ielts/onboarding/model";
import type {
  StudyPlanItemRow,
  StudyPlanRevisionRow,
  StudyPlanReviewRow,
  StudyPlanRow,
} from "@/lib/ielts/study-plan/page-view";
import { loadIeltsBandPrediction } from "./band-prediction-repository";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import {
  findQuickDiagnosticTest,
  type IeltsDiagnosticTestSummary,
} from "./study-plan-content";
import { loadActiveIeltsStudyPlan } from "./study-plan-repository";

const REVIEW_QUEUE_LIMIT = 60;
const REVISION_LIMIT = 50;
const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Active spaced-review states — what a learner can still work through. */
const ACTIVE_REVIEW_STATES = ["new", "learning", "review", "relearning"] as const;

const REVIEW_COLUMNS =
  "id, skill, focus_area, review_kind, prompt_en, prompt_vi, due_at, state";
const REVISION_COLUMNS =
  "id, from_version, to_version, trigger_type, trigger_source_type, summary_en, summary_vi, changed_item_count, created_at";

export interface IeltsStudyPlanPageData {
  plan: StudyPlanRow | null;
  goal: IeltsGoalModel | null;
  items: StudyPlanItemRow[];
  reviews: StudyPlanReviewRow[];
  revisions: StudyPlanRevisionRow[];
  prediction: IeltsBandPrediction;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  todayIso: string;
  now: string;
}

/** YYYY-MM-DD for `now` in the learner's plan timezone (falls back to UTC). */
function isoDateInTimeZone(now: Date, timeZone: string): string {
  try {
    // en-CA renders an ISO-shaped YYYY-MM-DD date.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

async function loadReviewQueue(
  client: IeltsDbClient,
  userId: string,
): Promise<StudyPlanReviewRow[]> {
  const { data, error } = await client
    .from("ielts_review_items")
    .select(REVIEW_COLUMNS)
    .eq("user_id", userId)
    .in("state", [...ACTIVE_REVIEW_STATES])
    .order("due_at", { ascending: true })
    .limit(REVIEW_QUEUE_LIMIT);
  if (error) throw new Error(`getIeltsStudyPlanPageData(reviews): ${error.message}`);
  return (data ?? []) as StudyPlanReviewRow[];
}

async function loadRevisions(
  client: IeltsDbClient,
  planId: string,
): Promise<StudyPlanRevisionRow[]> {
  const { data, error } = await client
    .from("ielts_study_plan_revisions")
    .select(REVISION_COLUMNS)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(REVISION_LIMIT);
  if (error) throw new Error(`getIeltsStudyPlanPageData(revisions): ${error.message}`);
  return (data ?? []) as StudyPlanRevisionRow[];
}

export async function getIeltsStudyPlanPageData(
  userId: string,
  client?: IeltsDbClient,
): Promise<IeltsStudyPlanPageData> {
  const supabase = await resolveIeltsClient(client);
  const active = await loadActiveIeltsStudyPlan(userId, supabase);
  const plan = active?.plan ?? null;
  const goal = plan ? goalFromStudyPlanRow(plan) : null;
  const targetBand = plan?.target_overall_band ?? DEFAULT_IELTS_TARGET_BAND;

  const [prediction, diagnosticTest, reviews, revisions] = await Promise.all([
    loadIeltsBandPrediction(userId, {
      module: plan?.module,
      targetBand,
      client: supabase,
    }),
    findQuickDiagnosticTest(supabase),
    loadReviewQueue(supabase, userId),
    plan ? loadRevisions(supabase, plan.id) : Promise.resolve<StudyPlanRevisionRow[]>([]),
  ]);

  const now = new Date();
  const timezone = plan?.timezone ?? DEFAULT_TIMEZONE;

  return {
    plan,
    goal,
    items: active?.items ?? [],
    reviews,
    revisions,
    prediction,
    diagnosticTest,
    todayIso: isoDateInTimeZone(now, timezone),
    now: now.toISOString(),
  };
}
