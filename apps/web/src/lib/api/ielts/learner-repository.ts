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
import type { IeltsBandPrediction } from "@/lib/ielts/adaptive/contracts";
import { DEFAULT_IELTS_TARGET_BAND } from "@/lib/ielts/adaptive/contracts";
import {
  findQuickDiagnosticTest,
  loadActiveIeltsStudyPlan,
  type IeltsDiagnosticTestSummary,
} from "./study-plan-repository";
import { loadIeltsBandPrediction } from "./band-prediction-repository";
import type { IeltsDbClient } from "./client";
import { getPublishedIeltsTests } from "./tests-repository";
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

export interface IeltsHomeData {
  recentAttempts: IeltsAttemptSummary[];
  featuredTests: IeltsTestCard[];
  publishedCount: number;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  prediction: IeltsBandPrediction;
  hasGoal: boolean;
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

/** Home payload: recent sittings + a short featured-tests teaser. */
export async function getIeltsHomeData(
  userId: string,
  client?: IeltsDbClient,
): Promise<IeltsHomeData> {
  const supabase = client ?? (await createTypedServerClient());
  const activePlan = await loadActiveIeltsStudyPlan(userId, supabase);
  const targetBand = activePlan?.plan.target_overall_band ?? DEFAULT_IELTS_TARGET_BAND;
  const [recentAttempts, published, diagnosticTest, prediction] = await Promise.all([
    listRecentIeltsAttempts({ userId, client: supabase }),
    getPublishedIeltsTests(supabase),
    findQuickDiagnosticTest(supabase),
    loadIeltsBandPrediction(userId, { targetBand, client: supabase }),
  ]);
  return {
    recentAttempts,
    featuredTests: published.slice(0, HOME_FEATURED_LIMIT).map(toTestCard),
    publishedCount: published.length,
    diagnosticTest,
    prediction,
    hasGoal: Boolean(activePlan),
  };
}
