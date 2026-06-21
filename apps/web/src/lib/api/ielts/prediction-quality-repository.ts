/**
 * Server-only data access for the admin "Prediction Quality" dashboard (Wave
 * 6.3 Workstream B, item 4).
 *
 * It assembles one {@link BacktestScenario} per qualifying (learner, module) —
 * the chronological evidence ledger plus the learner's real mock outcomes — so
 * the pure aggregation layer can replay the served `weighted-recency-v1` model
 * against actual results. A "mock" is a graded {@link MOCK_TEST_KINDS} attempt
 * with a band-score row; only learners with ≥ {@link MIN_MOCKS_FOR_BACKTEST}
 * mocks are scored.
 *
 * Security: the dashboard aggregates across ALL learners, so it reads through
 * the service-role client — gated behind an explicit `profiles.role = 'admin'`
 * check (the admin layout already gates the route; this is defense-in-depth for
 * the privilege escalation). Evidence is mapped through the SAME `mapEvidence`
 * the served read path uses, so the backtest replays the real model, not a copy.
 */
import "server-only";
import {
  DEFAULT_IELTS_TARGET_BAND,
  type IeltsModule,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import type { BacktestScenario, MockOutcome } from "@/lib/scoring/ielts-prediction";
import { tryCreateTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import type { Database, Tables } from "@/types/supabase";
import {
  EVIDENCE_COLUMNS,
  mapEvidence,
  type EvidenceRow,
  type SubskillRow,
} from "./band-prediction-repository";

/** Test kinds that count as a "mock" — excludes single-subskill `drill`s. */
export const MOCK_TEST_KINDS: readonly Database["public"]["Enums"]["ielts_test_kind"][] = [
  "full_mock",
  "skill_set",
];

export const MIN_MOCKS_FOR_BACKTEST = 2;

const MOCK_ROW_LIMIT = 5000;
const EVIDENCE_ROW_LIMIT = 20000;
const ID_BATCH = 500;

/** Mapping result: the assembled scenarios + how many histories were examined. */
export interface PredictionQualityScenarioLoad {
  scenarios: BacktestScenario[];
  /** (learner, module) histories with ≥ 1 mock, before the min-mock filter. */
  scenariosConsidered: number;
  /** True when the service-role client is not configured (e.g. local dev). */
  unavailable: boolean;
}

type BandRow = Pick<
  Tables<"attempt_band_scores">,
  | "attempt_id"
  | "user_id"
  | "listening_band"
  | "reading_band"
  | "writing_band"
  | "speaking_band"
  | "overall_band"
  | "computed_at"
  | "created_at"
>;
type AttemptRow = Pick<
  Tables<"ielts_attempts">,
  "id" | "module" | "test_id" | "submitted_at" | "completed_at" | "created_at"
>;

type AdminClient = NonNullable<ReturnType<typeof tryCreateTypedAdminClient>>;

const EMPTY_LABELS: ReadonlyMap<string, SubskillRow> = new Map();

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

function scenarioKey(userId: string, module: IeltsModule): string {
  return `${userId}::${module}`;
}

/** A mock "occurred" when the learner submitted it; fall back to grading time. */
function occurredAt(attempt: AttemptRow, band: BandRow): string {
  return (
    attempt.submitted_at ??
    attempt.completed_at ??
    band.computed_at ??
    band.created_at
  );
}

function toMockOutcome(attempt: AttemptRow, band: BandRow): MockOutcome {
  const bands = {
    listening: band.listening_band,
    reading: band.reading_band,
    writing: band.writing_band,
    speaking: band.speaking_band,
  } as Record<IeltsSkill, number | null>;
  return {
    attemptId: band.attempt_id,
    occurredAt: occurredAt(attempt, band),
    bands,
    overall: band.overall_band,
  };
}

/** Confirm the caller is an admin before escalating to the service-role read. */
async function assertCallerIsAdmin(): Promise<void> {
  if (isDevAdminBypassEnabled()) return;
  const cookie = await createTypedServerClient();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) throw new Error("prediction-quality: not authenticated");
  const { data: profile, error } = await cookie
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error) throw new Error(`prediction-quality(profile): ${error.message}`);
  if (profile?.role !== "admin") throw new Error("prediction-quality: admin only");
}

async function fetchAttempts(db: AdminClient, attemptIds: string[]): Promise<AttemptRow[]> {
  const rows: AttemptRow[] = [];
  for (const batch of chunk(attemptIds, ID_BATCH)) {
    const { data, error } = await db
      .from("ielts_attempts")
      .select("id, module, test_id, submitted_at, completed_at, created_at")
      .in("id", batch);
    if (error) throw new Error(`prediction-quality(attempts): ${error.message}`);
    rows.push(...((data ?? []) as AttemptRow[]));
  }
  return rows;
}

/** test_id → kind, keeping only mock-kind tests. */
async function fetchMockTestIds(db: AdminClient, testIds: string[]): Promise<Set<string>> {
  const mockIds = new Set<string>();
  for (const batch of chunk(testIds, ID_BATCH)) {
    const { data, error } = await db
      .from("ielts_tests")
      .select("id, kind")
      .in("id", batch)
      .in("kind", [...MOCK_TEST_KINDS]);
    if (error) throw new Error(`prediction-quality(tests): ${error.message}`);
    for (const row of data ?? []) mockIds.add(row.id);
  }
  return mockIds;
}

async function fetchEvidenceByUser(
  db: AdminClient,
  userIds: string[],
): Promise<Map<string, EvidenceRow[]>> {
  const byUser = new Map<string, EvidenceRow[]>();
  for (const batch of chunk(userIds, ID_BATCH)) {
    const { data, error } = await db
      .from("ielts_adaptive_evidence")
      .select(`user_id, ${EVIDENCE_COLUMNS}`)
      .in("user_id", batch)
      .order("created_at", { ascending: true })
      .limit(EVIDENCE_ROW_LIMIT);
    if (error) throw new Error(`prediction-quality(evidence): ${error.message}`);
    for (const row of (data ?? []) as (EvidenceRow & { user_id: string })[]) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row);
      byUser.set(row.user_id, list);
    }
  }
  return byUser;
}

/**
 * Load every qualifying learner's replayable history. Returns an empty,
 * `unavailable` load when the service-role client is not configured.
 */
export async function loadPredictionQualityScenarios(): Promise<PredictionQualityScenarioLoad> {
  await assertCallerIsAdmin();

  const db = tryCreateTypedAdminClient();
  if (!db) return { scenarios: [], scenariosConsidered: 0, unavailable: true };

  // 1. The universe of graded attempts (one band-score row each).
  const { data: bandData, error: bandError } = await db
    .from("attempt_band_scores")
    .select(
      "attempt_id, user_id, listening_band, reading_band, writing_band, speaking_band, overall_band, computed_at, created_at",
    )
    .order("created_at", { ascending: true })
    .limit(MOCK_ROW_LIMIT);
  if (bandError) throw new Error(`prediction-quality(bands): ${bandError.message}`);
  const bandRows = (bandData ?? []) as BandRow[];
  if (bandRows.length === 0) {
    return { scenarios: [], scenariosConsidered: 0, unavailable: false };
  }

  // 2. Resolve each attempt's module + timing, and keep only mock-kind tests.
  const attempts = await fetchAttempts(db, [...new Set(bandRows.map((row) => row.attempt_id))]);
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const mockTestIds = await fetchMockTestIds(
    db,
    [...new Set(attempts.map((attempt) => attempt.test_id))],
  );

  // 3. Group mock outcomes by (learner, module).
  const groups = new Map<
    string,
    { userId: string; module: IeltsModule; mocks: MockOutcome[] }
  >();
  for (const band of bandRows) {
    const attempt = attemptById.get(band.attempt_id);
    if (!attempt || !mockTestIds.has(attempt.test_id)) continue;
    const key = scenarioKey(band.user_id, attempt.module);
    const group = groups.get(key) ?? { userId: band.user_id, module: attempt.module, mocks: [] };
    group.mocks.push(toMockOutcome(attempt, band));
    groups.set(key, group);
  }

  const scenariosConsidered = groups.size;
  const qualifying = [...groups.values()].filter(
    (group) => group.mocks.length >= MIN_MOCKS_FOR_BACKTEST,
  );
  if (qualifying.length === 0) {
    return { scenarios: [], scenariosConsidered, unavailable: false };
  }

  // 4. Fetch evidence only for qualifying learners and replay-map it identically
  //    to the served read path (labels are cosmetic to the math → empty map).
  const evidenceByUser = await fetchEvidenceByUser(db, [
    ...new Set(qualifying.map((group) => group.userId)),
  ]);

  const scenarios: BacktestScenario[] = qualifying.map((group) => {
    const observations = (evidenceByUser.get(group.userId) ?? [])
      .filter((row) => row.module === group.module)
      .map((row) => mapEvidence(row, EMPTY_LABELS));
    return {
      userId: group.userId,
      module: group.module,
      targetBand: DEFAULT_IELTS_TARGET_BAND,
      observations,
      mocks: [...group.mocks].sort(
        (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
      ),
      skillStates: [],
    };
  });

  return { scenarios, scenariosConsidered, unavailable: false };
}
