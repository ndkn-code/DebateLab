/**
 * WS-6.2.4 — Adaptation / replan repository (server-authoritative).
 *
 * After new evidence lands (an attempt is graded, W/S is scored) or on a
 * scheduled pass, adjust the learner's FUTURE pending plan items while
 * preserving started/completed/teacher/current-day work, and log a revision
 * the study-plan page (WS-6.2.2) renders as "what changed". The decision logic
 * is the pure `study-plan/replan` core; this layer maps rows ⇄ projections and
 * owns the writes (service-role; the tables have no write RLS policies).
 *
 * Seam: WS-6.2.2 OWNS the `ielts_study_plan_revisions` table + the read/render
 * path. This card only WRITES rows + maps the rich summary onto their columns.
 */
import "server-only";

import {
  IeltsBandPredictionSchema,
  type IeltsBandPrediction,
} from "@/lib/ielts/adaptive/contracts";
import {
  goalFromStudyPlanRow,
  IELTS_ONBOARDING_HORIZON_DAYS,
} from "@/lib/ielts/onboarding/model";
import {
  buildReplanRevisionSummary,
  computeNextReassessmentAt,
  countMissedDays,
  evaluateReplan,
  generateIeltsStudyPlan,
  planItemReferenceKey,
  reconcileStudyPlanItems,
  summarizePrediction,
  type CandidateReconcileItem,
  type IeltsGeneratedStudyPlan,
  type ReplanEvaluation,
  type ReplanReason,
  type ReplanRevisionView,
  type ReplanTriggerEvent,
  type StudyPlanReconcileResult,
} from "@/lib/ielts/study-plan";
import { isEnrolledStudent } from "@/lib/ielts/enrollment";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert, TablesUpdate } from "@/types/supabase";
import type { IeltsDbClient } from "./client";
import {
  findQuickDiagnosticTest,
  ieltsLearnAtomKey,
  listAvailableIeltsLearnAtoms,
  type IeltsDiagnosticTestSummary,
} from "./study-plan-content";
import {
  loadActiveIeltsStudyPlan,
  loadPredictionForGeneratedPlan,
  planSummaryJson,
  predictionJson,
  reviewSeedFromRow,
  todayIso,
  type StudyPlanRow,
} from "./study-plan-repository";
import { toPlanItemInsert } from "./study-plan-item-inserts";
import {
  materializeSkillDrillsForItems,
  type MaterializedSkillDrillTest,
} from "./skill-drill-repository";
import {
  currentRevisionView,
  previousRevisionView,
  toExistingReconcileItem,
  toPredictionView,
} from "./study-plan-replan-mapping";
import { listDueIeltsReviewItems } from "./review-repository";

export interface ReplanOutcome {
  changed: boolean;
  reason: "no_active_plan" | "not_triggered" | "replanned";
  revisionId?: string;
  cancelledCount?: number;
  insertedCount?: number;
  reasons?: ReplanReason[];
  plan?: StudyPlanRow;
}

// ── Writes (split out to keep the orchestrator under the complexity cap) ──────

async function markOverduePlanItemsMissed(
  client: IeltsDbClient,
  params: { planId: string; today: string; now: string },
): Promise<void> {
  const { error } = await client
    .from("ielts_study_plan_items")
    .update({ status: "missed", updated_at: params.now })
    .eq("plan_id", params.planId)
    .lt("scheduled_date", params.today)
    .neq("kind", "teacher_assignment")
    .in("status", ["scheduled", "available"]);
  if (error) throw new Error(`replan(mark missed): ${error.message}`);
}

interface ReplanCandidates {
  candidates: CandidateReconcileItem[];
  insertByKey: Map<string, TablesInsert<"ielts_study_plan_items">>;
}

/** Map the generated plan's FUTURE items into insert rows + reconcile candidates. */
function buildReplanCandidates(params: {
  planId: string;
  userId: string;
  generatedPlan: IeltsGeneratedStudyPlan;
  learnActivityByKey: Map<string, string>;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  skillDrillTestByKey: Map<string, MaterializedSkillDrillTest>;
  sourcePredictionId: string | null;
  today: string;
}): ReplanCandidates {
  const insertByKey = new Map<string, TablesInsert<"ielts_study_plan_items">>();
  const candidates: CandidateReconcileItem[] = [];
  for (const item of params.generatedPlan.items) {
    if (item.scheduledDate <= params.today) continue; // today + past are preserved
    const insert = toPlanItemInsert({
      planId: params.planId,
      userId: params.userId,
      item,
      learnActivityByKey: params.learnActivityByKey,
      diagnosticTest: params.diagnosticTest,
      skillDrillTestByKey: params.skillDrillTestByKey,
      sourcePredictionId: params.sourcePredictionId,
    });
    if (!insert) continue; // unresolvable reference → skipped (mirrors generate)
    insertByKey.set(item.tempId, insert);
    candidates.push({
      clientKey: item.tempId,
      kind: item.kind,
      scheduledDate: item.scheduledDate,
      skill: item.skill,
      focusArea: item.focusArea,
      titleEn: item.titleEn,
      titleVi: item.titleVi,
      referenceKey: planItemReferenceKey(insert),
    });
  }
  return { candidates, insertByKey };
}

interface ApplyReplanParams {
  admin: IeltsDbClient;
  planRow: StudyPlanRow;
  userId: string;
  trigger: ReplanTriggerEvent;
  source?: { type: string; id: string | null };
  today: string;
  prediction: IeltsBandPrediction;
  generatedPlan: IeltsGeneratedStudyPlan;
  predictionSourceId: string | null;
  reconcile: StudyPlanReconcileResult;
  insertByKey: Map<string, TablesInsert<"ielts_study_plan_items">>;
  evaluation: ReplanEvaluation;
  beforeView: ReplanRevisionView;
  afterView: ReplanRevisionView;
  nextReassessmentAt: string;
}

/** Apply a material replan: mark missed, cancel/insert items, bump the plan, log the revision. */
async function applyReplanWrites(params: ApplyReplanParams): Promise<ReplanOutcome> {
  const { admin, planRow, reconcile, insertByKey } = params;
  const now = new Date().toISOString();

  await markOverduePlanItemsMissed(admin, { planId: planRow.id, today: params.today, now });

  if (reconcile.cancelIds.length > 0) {
    const { error } = await admin
      .from("ielts_study_plan_items")
      .delete()
      .in("id", reconcile.cancelIds);
    if (error) throw new Error(`replan(cancel items): ${error.message}`);
  }

  if (reconcile.insertKeys.length > 0) {
    const inserts = reconcile.insertKeys.flatMap((key) => {
      const insert = insertByKey.get(key);
      return insert ? [insert] : [];
    });
    const { error } = await admin
      .from("ielts_study_plan_items")
      .insert(inserts)
      .select("id");
    if (error) throw new Error(`replan(insert items): ${error.message}`);
  }

  const planVersionBefore = planRow.plan_version;
  const planVersionAfter = planVersionBefore + 1;
  const planPatch: TablesUpdate<"ielts_study_plans"> = {
    predicted_overall_band: params.prediction.overall.band,
    predicted_listening_band: params.prediction.skills.listening.band,
    predicted_reading_band: params.prediction.skills.reading.band,
    predicted_writing_band: params.prediction.skills.writing.band,
    predicted_speaking_band: params.prediction.skills.speaking.band,
    prediction_confidence: params.prediction.overall.confidence,
    prediction_summary: predictionJson(params.prediction),
    explanation: {
      plan: planSummaryJson(params.generatedPlan),
      rationale: params.generatedPlan.rationale,
    } as Json,
    latest_prediction_snapshot_id: params.predictionSourceId,
    plan_version: planVersionAfter,
    last_replanned_at: now,
    next_reassessment_at: params.nextReassessmentAt,
    updated_at: now,
  };
  const { data: updatedPlan, error: planError } = await admin
    .from("ielts_study_plans")
    .update(planPatch)
    .eq("id", planRow.id)
    .select("*")
    .single();
  if (planError) throw new Error(`replan(plan): ${planError.message}`);

  // Map the rich summary onto the WS-6.2.2-owned revision columns: bilingual
  // summary text + a changed-item count for the timeline, with the structured
  // before/after views kept in the snapshot jsonb for trust/debugging.
  const summary = buildReplanRevisionSummary({
    trigger: params.trigger,
    evaluation: params.evaluation,
    before: params.beforeView,
    after: params.afterView,
    reconcile,
  });
  const revisionInsert: TablesInsert<"ielts_study_plan_revisions"> = {
    plan_id: planRow.id,
    user_id: params.userId,
    from_version: planVersionBefore,
    to_version: planVersionAfter,
    trigger_type: params.trigger,
    trigger_source_type: params.source?.type ?? null,
    trigger_source_id: params.source?.id ?? null,
    summary_en: summary.reasonEn,
    summary_vi: summary.reasonVi,
    changed_item_count:
      reconcile.cancelIds.length + reconcile.insertKeys.length,
    before_snapshot: summary.before as unknown as Json,
    after_snapshot: {
      ...summary.after,
      reasons: summary.reasons,
      bandDelta: summary.bandDelta,
      changes: summary.changes,
      predictionSnapshotId: params.predictionSourceId,
    } as unknown as Json,
  };
  const { data: revision, error: revisionError } = await admin
    .from("ielts_study_plan_revisions")
    .insert(revisionInsert)
    .select("id")
    .single();
  if (revisionError) throw new Error(`replan(revision): ${revisionError.message}`);

  return {
    changed: true,
    reason: "replanned",
    revisionId: revision.id,
    cancelledCount: reconcile.cancelIds.length,
    insertedCount: reconcile.insertKeys.length,
    reasons: params.evaluation.reasons,
    plan: updatedPlan,
  };
}

/**
 * Re-plan a learner's FUTURE pending items from the latest prediction, log a
 * revision, and (for scheduled passes) advance the reassessment cursor.
 * Idempotent: when the regenerated plan matches the current one and the band
 * has not moved, nothing is written.
 */
export async function replanIeltsStudyPlanForUser(params: {
  userId: string;
  trigger: ReplanTriggerEvent;
  /** Optional provenance for the revision log (e.g. the graded attempt id). */
  source?: { type: string; id: string | null };
  client?: IeltsDbClient;
}): Promise<ReplanOutcome> {
  const admin = params.client ?? createTypedAdminClient();
  const active = await loadActiveIeltsStudyPlan(params.userId, admin);
  if (!active) return { changed: false, reason: "no_active_plan" };

  const planRow = active.plan;
  const goal = goalFromStudyPlanRow(planRow);
  const today = todayIso();
  const horizonDays = planRow.plan_horizon_days ?? IELTS_ONBOARDING_HORIZON_DAYS;

  const prediction = IeltsBandPredictionSchema.parse(
    await loadPredictionForGeneratedPlan({ userId: params.userId, goal, client: admin }),
  );
  const isEnrolled = await isEnrolledStudent(params.userId, admin);
  const [learnAtoms, diagnosticTest, dueReviews] = await Promise.all([
    isEnrolled ? listAvailableIeltsLearnAtoms(admin) : Promise.resolve([]),
    findQuickDiagnosticTest(admin),
    listDueIeltsReviewItems({ userId: params.userId, dueAt: new Date(), limit: 50 }, admin),
  ]);
  const generatedPlan = generateIeltsStudyPlan({
    goal,
    prediction,
    isEnrolled,
    weaknesses: prediction.weaknesses,
    learnAtoms: learnAtoms.map((entry) => entry.atom),
    dueReviews: dueReviews.map(reviewSeedFromRow),
    startDate: today,
    horizonDays,
  });
  const predictionSummary = summarizePrediction(prediction);
  const skillDrillTestByKey = await materializeSkillDrillsForItems({
    client: admin,
    userId: params.userId,
    items: generatedPlan.items,
  });

  const { candidates, insertByKey } = buildReplanCandidates({
    planId: planRow.id,
    userId: params.userId,
    generatedPlan,
    learnActivityByKey: new Map(
      learnAtoms.map((entry) => [ieltsLearnAtomKey(entry.atom), entry.activityId]),
    ),
    diagnosticTest,
    skillDrillTestByKey,
    sourcePredictionId: predictionSummary.sourceId,
    today,
  });

  const existing = active.items.map(toExistingReconcileItem);
  const reconcile = reconcileStudyPlanItems({ existing, candidates, today });
  const missedDays = countMissedDays(existing, today);

  const beforeView = previousRevisionView(
    planRow,
    reconcile.cancelIds.length + reconcile.keptIds.length,
  );
  const afterView = currentRevisionView(
    generatedPlan,
    prediction,
    reconcile.keptCount + reconcile.insertKeys.length,
  );
  const evaluation = evaluateReplan({
    event: params.trigger,
    previous: toPredictionView(beforeView),
    current: toPredictionView(afterView),
    reconcileChanged: reconcile.changed,
    missedDays,
  });
  const nextReassessmentAt = computeNextReassessmentAt(generatedPlan.mode, today);

  if (!evaluation.triggered) {
    // Scheduled passes advance the cursor so the cron stops re-selecting this
    // plan; event-driven no-ops touch nothing at all (idempotent).
    if (params.trigger === "scheduled_pass") {
      const { error } = await admin
        .from("ielts_study_plans")
        .update({ next_reassessment_at: nextReassessmentAt })
        .eq("id", planRow.id);
      if (error) throw new Error(`replan(advance cursor): ${error.message}`);
    }
    return { changed: false, reason: "not_triggered" };
  }

  return applyReplanWrites({
    admin,
    planRow,
    userId: params.userId,
    trigger: params.trigger,
    source: params.source,
    today,
    prediction,
    generatedPlan,
    predictionSourceId: predictionSummary.sourceId,
    reconcile,
    insertByKey,
    evaluation,
    beforeView,
    afterView,
    nextReassessmentAt,
  });
}

// ── Cron selector ────────────────────────────────────────────────────────────

export interface DueReplanPlan {
  planId: string;
  userId: string;
}

/**
 * Active plans whose scheduled reassessment is due (or never set), oldest cursor
 * first — drives the nightly replan cron. Service-role read across all users.
 */
export async function listActivePlansDueForReplan(params: {
  client: IeltsDbClient;
  asOf: string;
  limit: number;
}): Promise<DueReplanPlan[]> {
  const { data, error } = await params.client
    .from("ielts_study_plans")
    .select("id, user_id")
    .eq("status", "active")
    .or(`next_reassessment_at.is.null,next_reassessment_at.lte.${params.asOf}`)
    .order("next_reassessment_at", { ascending: true, nullsFirst: true })
    .limit(params.limit);
  if (error) throw new Error(`listActivePlansDueForReplan: ${error.message}`);
  return (data ?? []).map((row) => ({ planId: row.id, userId: row.user_id }));
}
