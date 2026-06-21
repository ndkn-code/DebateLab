import "server-only";

import { parseInput } from "@/lib/api/boundary";
import {
  IeltsBandPredictionSchema,
  IeltsGoalModelSchema,
  type IeltsGoalModel,
} from "@/lib/ielts/adaptive/contracts";
import {
  computeNextReassessmentAt,
  generateIeltsStudyPlan,
  summarizePrediction,
  type IeltsGeneratedStudyPlan,
  type IeltsGeneratedStudyPlanItem,
} from "@/lib/ielts/study-plan";
import {
  IELTS_ONBOARDING_HORIZON_DAYS,
  defaultIeltsOnboardingGoal,
  goalFromStudyPlanRow,
} from "@/lib/ielts/onboarding/model";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/types/supabase";
import {
  loadIeltsBandPrediction,
  loadIeltsPredictionForPlanning,
} from "./band-prediction-repository";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import {
  findQuickDiagnosticTest,
  ieltsLearnAtomKey,
  listAvailableIeltsLearnAtoms,
  type AvailableIeltsLearnAtom,
  type IeltsDiagnosticTestSummary,
} from "./study-plan-content";

export {
  findQuickDiagnosticTest,
  listAvailableIeltsLearnAtoms,
} from "./study-plan-content";
export type {
  AvailableIeltsLearnAtom,
  IeltsDiagnosticTestSummary,
} from "./study-plan-content";

export type StudyPlanRow = Tables<"ielts_study_plans">;
export type StudyPlanItemRow = Tables<"ielts_study_plan_items">;

export interface IeltsStudyPlanView {
  plan: StudyPlanRow;
  items: StudyPlanItemRow[];
}

export interface PersistedIeltsStudyPlanResult {
  plan: StudyPlanRow;
  persistedItems: StudyPlanItemRow[];
  skippedItems: IeltsGeneratedStudyPlanItem[];
  generatedPlan: IeltsGeneratedStudyPlan;
  prediction: ReturnType<typeof IeltsBandPredictionSchema.parse>;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function skillTarget(
  goal: IeltsGoalModel,
  skill: keyof IeltsGoalModel["targetSkillBands"],
): number | null {
  return goal.targetSkillBands[skill] ?? null;
}

function goalPatch(
  userId: string,
  goal: IeltsGoalModel,
): TablesInsert<"ielts_study_plans"> {
  return {
    user_id: userId,
    module: goal.module,
    status: "active",
    target_test_date: goal.targetTestDate,
    target_overall_band: goal.targetOverallBand,
    target_listening_band: skillTarget(goal, "listening"),
    target_reading_band: skillTarget(goal, "reading"),
    target_writing_band: skillTarget(goal, "writing"),
    target_speaking_band: skillTarget(goal, "speaking"),
    focus_skills: goal.focusSkills ?? null,
    daily_minutes: goal.availability.dailyMinutes,
    study_days: goal.availability.studyDays,
    timezone: goal.availability.timezone,
    feedback_language: goal.feedbackLanguage,
    plan_horizon_days: IELTS_ONBOARDING_HORIZON_DAYS,
  };
}

export async function loadActiveIeltsStudyPlan(
  userId: string,
  client?: IeltsDbClient,
): Promise<IeltsStudyPlanView | null> {
  const supabase = await resolveIeltsClient(client);
  const { data: plan, error } = await supabase
    .from("ielts_study_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`loadActiveIeltsStudyPlan(plan): ${error.message}`);
  if (!plan) return null;

  const { data: items, error: itemsError } = await supabase
    .from("ielts_study_plan_items")
    .select("*")
    .eq("plan_id", plan.id)
    .order("scheduled_date", { ascending: true })
    .order("priority_score", { ascending: false });
  if (itemsError) {
    throw new Error(`loadActiveIeltsStudyPlan(items): ${itemsError.message}`);
  }
  return { plan, items: items ?? [] };
}

export async function saveIeltsStudyPlanGoal(params: {
  userId: string;
  goal: IeltsGoalModel;
  client?: IeltsDbClient;
}): Promise<StudyPlanRow> {
  const supabase = params.client ?? createTypedAdminClient();
  const goal = parseInput(IeltsGoalModelSchema, params.goal);
  const existing = await loadActiveIeltsStudyPlan(params.userId, supabase);
  const now = new Date().toISOString();

  if (existing) {
    const patch: TablesUpdate<"ielts_study_plans"> = {
      ...goalPatch(params.userId, goal),
      updated_at: now,
    };
    const { data, error } = await supabase
      .from("ielts_study_plans")
      .update(patch)
      .eq("id", existing.plan.id)
      .select("*")
      .single();
    if (error) throw new Error(`saveIeltsStudyPlanGoal(update): ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from("ielts_study_plans")
    .insert({ ...goalPatch(params.userId, goal), created_at: now, updated_at: now })
    .select("*")
    .single();
  if (error) throw new Error(`saveIeltsStudyPlanGoal(insert): ${error.message}`);
  return data;
}

export function planSummaryJson(plan: IeltsGeneratedStudyPlan): Json {
  return {
    mode: plan.mode,
    horizon: plan.horizon,
    todayCount: plan.today.length,
    itemCount: plan.items.length,
    skillPriorities: plan.skillPriorities.map((priority) => ({
      skill: priority.skill,
      weaknessKey: priority.weaknessKey,
      priorityScore: priority.priorityScore,
      targetBand: priority.targetBand,
      currentBand: priority.currentBand,
      maintenance: priority.isMaintenance,
    })),
  } satisfies Json;
}

export function predictionJson(
  prediction: ReturnType<typeof IeltsBandPredictionSchema.parse>,
): Json {
  const summary = summarizePrediction(prediction);
  return {
    ...summary,
    status: prediction.overall.status,
    lower: prediction.overall.lower,
    upper: prediction.overall.upper,
    limitations: prediction.limitations,
    nextBestDiagnostic: prediction.nextBestDiagnostic,
  } satisfies Json;
}

function itemReferencePatch(params: {
  item: IeltsGeneratedStudyPlanItem;
  learnActivityByKey: Map<string, string>;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
}): Partial<TablesInsert<"ielts_study_plan_items">> | null {
  const { item } = params;
  if (item.reference.type === "learn_atom") {
    const activityId = params.learnActivityByKey.get(
      ieltsLearnAtomKey(item.reference.atom),
    );
    return activityId ? { activity_id: activityId } : null;
  }
  if (item.reference.type === "mock") {
    const testId = item.reference.testId ?? params.diagnosticTest?.id ?? null;
    return testId ? { ielts_test_id: testId } : null;
  }
  if (item.reference.type === "question") {
    return item.reference.questionId ? { ielts_question_id: item.reference.questionId } : null;
  }
  if (item.reference.type === "review_item") {
    return { review_item_id: item.reference.reviewItemId };
  }
  return { assignment_id: item.reference.assignmentId };
}

export function toPlanItemInsert(params: {
  planId: string;
  userId: string;
  item: IeltsGeneratedStudyPlanItem;
  sourcePredictionId: string | null;
  learnActivityByKey: Map<string, string>;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
}): TablesInsert<"ielts_study_plan_items"> | null {
  const pointer = itemReferencePatch({
    item: params.item,
    learnActivityByKey: params.learnActivityByKey,
    diagnosticTest: params.diagnosticTest,
  });
  if (!pointer) return null;

  return {
    plan_id: params.planId,
    user_id: params.userId,
    kind: params.item.kind,
    status: params.item.status,
    scheduled_date: params.item.scheduledDate,
    available_at: params.item.status === "available" ? new Date().toISOString() : null,
    skill: params.item.skill,
    focus_area: params.item.focusArea,
    estimated_minutes: params.item.estimatedMinutes,
    priority_score: params.item.priorityScore,
    source_prediction_snapshot_id: params.sourcePredictionId,
    source_weakness_keys: params.item.sourceWeaknessKeys,
    rationale_en: params.item.rationaleEn,
    rationale_vi: params.item.rationaleVi,
    metadata: {
      ...params.item.metadata,
      tempId: params.item.tempId,
      titleEn: params.item.titleEn,
      titleVi: params.item.titleVi,
    } as Json,
    ...pointer,
  };
}

async function replacePlanItems(params: {
  client: IeltsDbClient;
  planId: string;
  userId: string;
  items: IeltsGeneratedStudyPlanItem[];
  learnAtoms: AvailableIeltsLearnAtom[];
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  sourcePredictionId: string | null;
}): Promise<{ persisted: StudyPlanItemRow[]; skipped: IeltsGeneratedStudyPlanItem[] }> {
  const learnActivityByKey = new Map(
    params.learnAtoms.map((entry) => [ieltsLearnAtomKey(entry.atom), entry.activityId]),
  );
  const mapped = params.items.map((item) => ({
    item,
    insert: toPlanItemInsert({
      planId: params.planId,
      userId: params.userId,
      item,
      learnActivityByKey,
      diagnosticTest: params.diagnosticTest,
      sourcePredictionId: params.sourcePredictionId,
    }),
  }));
  const inserts = mapped.flatMap((entry) => (entry.insert ? [entry.insert] : []));
  const skipped = mapped.flatMap((entry) => (entry.insert ? [] : [entry.item]));

  const { error: deleteError } = await params.client
    .from("ielts_study_plan_items")
    .delete()
    .eq("plan_id", params.planId);
  if (deleteError) throw new Error(`replacePlanItems(delete): ${deleteError.message}`);
  if (inserts.length === 0) return { persisted: [], skipped };

  const { data, error } = await params.client
    .from("ielts_study_plan_items")
    .insert(inserts)
    .select("*");
  if (error) throw new Error(`replacePlanItems(insert): ${error.message}`);
  return { persisted: data ?? [], skipped };
}

export async function loadPredictionForGeneratedPlan(params: {
  userId: string;
  goal: IeltsGoalModel;
  client?: IeltsDbClient;
}) {
  const options = {
    module: params.goal.module,
    targetBand: params.goal.targetOverallBand,
  };

  if (params.client) {
    return loadIeltsBandPrediction(params.userId, {
      ...options,
      client: params.client,
    });
  }

  return loadIeltsPredictionForPlanning(params.userId, options);
}

export async function generateAndPersistIeltsStudyPlanForUser(params: {
  userId: string;
  goal?: IeltsGoalModel;
  client?: IeltsDbClient;
}): Promise<PersistedIeltsStudyPlanResult> {
  const admin = params.client ?? createTypedAdminClient();
  const active = await loadActiveIeltsStudyPlan(params.userId, admin);
  const goal =
    params.goal ??
    (active
      ? goalFromStudyPlanRow(active.plan)
      : defaultIeltsOnboardingGoal({
          todayIso: todayIso(),
          timezone: "Asia/Ho_Chi_Minh",
          feedbackLanguage: "en",
        }));
  const planRow = active
    ? active.plan
    : await saveIeltsStudyPlanGoal({ userId: params.userId, goal, client: admin });
  const prediction = IeltsBandPredictionSchema.parse(
    await loadPredictionForGeneratedPlan({
      userId: params.userId,
      goal,
      client: params.client,
    }),
  );
  const [learnAtoms, diagnosticTest] = await Promise.all([
    listAvailableIeltsLearnAtoms(admin),
    findQuickDiagnosticTest(admin),
  ]);
  const generatedPlan = generateIeltsStudyPlan({
    goal,
    prediction,
    weaknesses: prediction.weaknesses,
    learnAtoms: learnAtoms.map((entry) => entry.atom),
    startDate: todayIso(),
    horizonDays: IELTS_ONBOARDING_HORIZON_DAYS,
  });
  const predictionSummary = summarizePrediction(prediction);
  const now = new Date().toISOString();

  const planPatch: TablesUpdate<"ielts_study_plans"> = {
    ...goalPatch(params.userId, goal),
    predicted_overall_band: prediction.overall.band,
    predicted_listening_band: prediction.skills.listening.band,
    predicted_reading_band: prediction.skills.reading.band,
    predicted_writing_band: prediction.skills.writing.band,
    predicted_speaking_band: prediction.skills.speaking.band,
    prediction_confidence: prediction.overall.confidence,
    prediction_summary: predictionJson(prediction),
    explanation: {
      plan: planSummaryJson(generatedPlan),
      rationale: generatedPlan.rationale,
    } as Json,
    latest_prediction_snapshot_id: predictionSummary.sourceId,
    baseline_prediction_snapshot_id:
      planRow.baseline_prediction_snapshot_id ?? predictionSummary.sourceId,
    generated_at: now,
    last_replanned_at: now,
    // WS-6.2.4: seed the reassessment cursor so the nightly replan pass can find
    // freshly generated plans (additive — onboarding output is otherwise unchanged).
    next_reassessment_at: computeNextReassessmentAt(generatedPlan.mode, todayIso()),
    updated_at: now,
  };

  const { data: updatedPlan, error } = await admin
    .from("ielts_study_plans")
    .update(planPatch)
    .eq("id", planRow.id)
    .select("*")
    .single();
  if (error) {
    throw new Error(`generateAndPersistIeltsStudyPlanForUser(plan): ${error.message}`);
  }

  const items = await replacePlanItems({
    client: admin,
    planId: updatedPlan.id,
    userId: params.userId,
    items: generatedPlan.items,
    learnAtoms,
    diagnosticTest,
    sourcePredictionId: predictionSummary.sourceId,
  });

  return {
    plan: updatedPlan,
    persistedItems: items.persisted,
    skippedItems: items.skipped,
    generatedPlan,
    prediction,
    diagnosticTest,
  };
}
