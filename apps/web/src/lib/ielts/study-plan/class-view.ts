/**
 * Pure view-model for the teacher-facing IELTS class study-plan surface.
 *
 * The repository supplies already-authorized rows. This module keeps the product
 * rules local and testable: active-plan selection, plan-item progress, weak
 * subskill ranking, and class-level rollups. No DB or React imports here.
 */
import type { IeltsModule, IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import type { Database } from "@/types/supabase";

type StudyPlanStatus = Database["public"]["Enums"]["ielts_study_plan_status"];
type StudyPlanItemStatus = Database["public"]["Enums"]["ielts_plan_item_status"];

export type IeltsClassStudyPlanWeaknessSeverity = "watch" | "weak" | "critical";

export interface IeltsClassStudyPlanClassInput {
  id: string;
  title: string;
}

export interface IeltsClassStudyPlanMembershipInput {
  classId: string;
  userId: string;
}

export interface IeltsClassStudyPlanProfileInput {
  userId: string;
  displayName: string | null;
  email: string | null;
}

export interface IeltsClassStudyPlanPlanInput {
  id: string;
  userId: string;
  status: StudyPlanStatus;
  module: IeltsModule;
  predictedOverallBand: number | null;
  targetOverallBand: number;
  generatedAt: string;
  nextReassessmentAt: string | null;
}

export interface IeltsClassStudyPlanItemInput {
  id: string;
  planId: string;
  status: StudyPlanItemStatus;
  scheduledDate: string;
}

export interface IeltsClassStudyPlanWeakSubskillInput {
  userId: string;
  key: string;
  skill: IeltsSkill;
  labelEn: string;
  labelVi: string;
  bandEstimate: number | null;
  confidence: number;
  weaknessWeight: number;
  evidenceCount: number;
  lastEvidenceAt: string | null;
}

export interface BuildIeltsClassStudyPlanViewInput {
  classes: IeltsClassStudyPlanClassInput[];
  memberships: IeltsClassStudyPlanMembershipInput[];
  profiles: IeltsClassStudyPlanProfileInput[];
  plans: IeltsClassStudyPlanPlanInput[];
  items: IeltsClassStudyPlanItemInput[];
  weakSubskills: IeltsClassStudyPlanWeakSubskillInput[];
  todayIso: string;
  maxWeakSubskillsPerLearner?: number;
  maxWeakSubskillsPerClass?: number;
}

export interface IeltsClassStudyPlanProgressView {
  done: number;
  scheduled: number;
  missed: number;
  total: number;
  completionPercent: number;
}

export interface IeltsClassStudyPlanWeakSubskillView {
  key: string;
  skill: IeltsSkill;
  labelEn: string;
  labelVi: string;
  severity: IeltsClassStudyPlanWeaknessSeverity;
  bandEstimate: number | null;
  confidencePercent: number;
  weaknessWeight: number;
  evidenceCount: number;
  lastEvidenceAt: string | null;
}

export interface IeltsClassStudyPlanClassWeakSubskillView
  extends IeltsClassStudyPlanWeakSubskillView {
  affectedLearnerCount: number;
}
export interface IeltsClassStudyPlanLearnerView {
  userId: string;
  displayName: string;
  email: string | null;
  hasActivePlan: boolean;
  module: IeltsModule | null;
  predictedBand: number | null;
  targetBand: number | null;
  planGeneratedAt: string | null;
  nextReassessmentAt: string | null;
  progress: IeltsClassStudyPlanProgressView;
  weakSubskills: IeltsClassStudyPlanWeakSubskillView[];
  needsAttention: boolean;
}

export interface IeltsClassStudyPlanClassView {
  id: string;
  title: string;
  learnerCount: number;
  activePlanCount: number;
  needsAttentionCount: number;
  averagePredictedBand: number | null;
  progress: IeltsClassStudyPlanProgressView;
  weakSubskills: IeltsClassStudyPlanClassWeakSubskillView[];
  learners: IeltsClassStudyPlanLearnerView[];
}

export interface IeltsClassStudyPlanSurfaceView {
  classCount: number;
  learnerCount: number;
  activePlanCount: number;
  needsAttentionCount: number;
  averagePredictedBand: number | null;
  progress: IeltsClassStudyPlanProgressView;
  classes: IeltsClassStudyPlanClassView[];
}

const EMPTY_PROGRESS: IeltsClassStudyPlanProgressView = { done: 0, scheduled: 0, missed: 0, total: 0, completionPercent: 0 };
const ACTIVE_ITEM_STATUSES = new Set<StudyPlanItemStatus>(["scheduled", "available", "started"]);
function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function averageBand(bands: Array<number | null>): number | null {
  const values = bands.filter((band): band is number => band !== null);
  if (values.length === 0) return null;
  return roundOne(values.reduce((sum, band) => sum + band, 0) / values.length);
}

function mergeProgress(
  rows: IeltsClassStudyPlanProgressView[],
): IeltsClassStudyPlanProgressView {
  const done = rows.reduce((sum, row) => sum + row.done, 0);
  const scheduled = rows.reduce((sum, row) => sum + row.scheduled, 0);
  const missed = rows.reduce((sum, row) => sum + row.missed, 0);
  const total = done + scheduled + missed;
  return {
    done,
    scheduled,
    missed,
    total,
    completionPercent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

function tallyProgress(
  items: IeltsClassStudyPlanItemInput[],
  todayIso: string,
): IeltsClassStudyPlanProgressView {
  let done = 0;
  let scheduled = 0;
  let missed = 0;

  for (const item of items) {
    const scheduledDate = item.scheduledDate.slice(0, 10);
    if (item.status === "completed") {
      done += 1;
    } else if (
      item.status === "missed" ||
      (ACTIVE_ITEM_STATUSES.has(item.status) && scheduledDate < todayIso)
    ) {
      missed += 1;
    } else if (ACTIVE_ITEM_STATUSES.has(item.status)) {
      scheduled += 1;
    }
  }

  return mergeProgress([{ ...EMPTY_PROGRESS, done, scheduled, missed }]);
}

function severityFor(weight: number): IeltsClassStudyPlanWeaknessSeverity {
  if (weight >= 0.7) return "critical";
  if (weight >= 0.4) return "weak";
  return "watch";
}

function compareWeakSubskills(
  a: IeltsClassStudyPlanWeakSubskillInput,
  b: IeltsClassStudyPlanWeakSubskillInput,
): number {
  return (
    b.weaknessWeight - a.weaknessWeight ||
    b.confidence - a.confidence ||
    b.evidenceCount - a.evidenceCount ||
    a.key.localeCompare(b.key)
  );
}

function toWeakSubskillView(
  row: IeltsClassStudyPlanWeakSubskillInput,
): IeltsClassStudyPlanWeakSubskillView {
  return {
    key: row.key,
    skill: row.skill,
    labelEn: row.labelEn,
    labelVi: row.labelVi,
    severity: severityFor(row.weaknessWeight),
    bandEstimate: row.bandEstimate,
    confidencePercent: Math.round(row.confidence * 100),
    weaknessWeight: row.weaknessWeight,
    evidenceCount: row.evidenceCount,
    lastEvidenceAt: row.lastEvidenceAt,
  };
}

function nameFor(profile: IeltsClassStudyPlanProfileInput | undefined): {
  displayName: string;
  email: string | null;
} {
  const trimmed = profile?.displayName?.trim();
  if (trimmed) return { displayName: trimmed, email: profile?.email ?? null };
  if (profile?.email) {
    return { displayName: profile.email.split("@")[0] || "Student", email: profile.email };
  }
  return { displayName: "Student", email: null };
}

function sortPlansDesc(
  a: IeltsClassStudyPlanPlanInput,
  b: IeltsClassStudyPlanPlanInput,
): number {
  return b.generatedAt.localeCompare(a.generatedAt) || b.id.localeCompare(a.id);
}

function sortLearners(
  a: IeltsClassStudyPlanLearnerView,
  b: IeltsClassStudyPlanLearnerView,
): number {
  return (
    Number(b.needsAttention) - Number(a.needsAttention) ||
    b.progress.missed - a.progress.missed ||
    a.displayName.localeCompare(b.displayName) ||
    a.userId.localeCompare(b.userId)
  );
}

interface BuildLearnerContext {
  profilesByUser: ReadonlyMap<string, IeltsClassStudyPlanProfileInput>;
  activePlanByUser: ReadonlyMap<string, IeltsClassStudyPlanPlanInput>;
  itemsByPlan: ReadonlyMap<string, IeltsClassStudyPlanItemInput[]>;
  weakSubskillsByUser: ReadonlyMap<string, IeltsClassStudyPlanWeakSubskillInput[]>;
  todayIso: string;
  maxWeakSubskillsPerLearner: number;
}

function learnerWeakSubskills(
  userId: string,
  context: BuildLearnerContext,
): IeltsClassStudyPlanWeakSubskillView[] {
  return (context.weakSubskillsByUser.get(userId) ?? [])
    .sort(compareWeakSubskills)
    .slice(0, context.maxWeakSubskillsPerLearner)
    .map(toWeakSubskillView);
}

function learnerNeedsAttention(params: {
  hasPlan: boolean;
  progress: IeltsClassStudyPlanProgressView;
  weakSubskills: IeltsClassStudyPlanWeakSubskillView[];
}): boolean {
  return (
    params.progress.missed > 0 ||
    !params.hasPlan ||
    params.weakSubskills.some((weakness) => weakness.severity === "critical")
  );
}

function buildLearnerView(
  userId: string,
  context: BuildLearnerContext,
): IeltsClassStudyPlanLearnerView {
  const profile = nameFor(context.profilesByUser.get(userId));
  const plan = context.activePlanByUser.get(userId);
  const progress = plan
    ? tallyProgress(context.itemsByPlan.get(plan.id) ?? [], context.todayIso)
    : EMPTY_PROGRESS;
  const weakSubskills = learnerWeakSubskills(userId, context);

  return {
    userId,
    displayName: profile.displayName,
    email: profile.email,
    hasActivePlan: Boolean(plan),
    module: plan?.module ?? null,
    predictedBand: plan?.predictedOverallBand ?? null,
    targetBand: plan?.targetOverallBand ?? null,
    planGeneratedAt: plan?.generatedAt ?? null,
    nextReassessmentAt: plan?.nextReassessmentAt ?? null,
    progress,
    weakSubskills,
    needsAttention: learnerNeedsAttention({
      hasPlan: Boolean(plan),
      progress,
      weakSubskills,
    }),
  };
}

type ClassWeakSubskillAggregate = { base: IeltsClassStudyPlanWeakSubskillView; affectedLearners: Set<string>; weightTotal: number; confidenceTotal: number };

function buildClassWeakSubskills(
  learners: IeltsClassStudyPlanLearnerView[],
  maxWeakSubskillsPerClass: number,
): IeltsClassStudyPlanClassWeakSubskillView[] {
  const byKey = new Map<string, ClassWeakSubskillAggregate>();

  for (const learner of learners) {
    for (const weakness of learner.weakSubskills) {
      const existing = byKey.get(weakness.key);
      if (existing) {
        existing.affectedLearners.add(learner.userId);
        existing.weightTotal += weakness.weaknessWeight;
        existing.confidenceTotal += weakness.confidencePercent;
      } else {
        byKey.set(weakness.key, {
          base: weakness,
          affectedLearners: new Set([learner.userId]),
          weightTotal: weakness.weaknessWeight,
          confidenceTotal: weakness.confidencePercent,
        });
      }
    }
  }

  return [...byKey.values()]
    .map(toClassWeakSubskillView)
    .sort(
      (a, b) =>
        b.affectedLearnerCount - a.affectedLearnerCount ||
        b.weaknessWeight - a.weaknessWeight ||
        a.key.localeCompare(b.key),
    )
    .slice(0, maxWeakSubskillsPerClass);
}

function toClassWeakSubskillView(
  entry: ClassWeakSubskillAggregate,
): IeltsClassStudyPlanClassWeakSubskillView {
  const affectedLearnerCount = entry.affectedLearners.size;
  const averageWeight = entry.weightTotal / affectedLearnerCount;
  return {
    ...entry.base,
    severity: severityFor(averageWeight),
    weaknessWeight: roundTwo(averageWeight),
    confidencePercent: Math.round(entry.confidenceTotal / affectedLearnerCount),
    affectedLearnerCount,
  };
}

export function buildIeltsClassStudyPlanView(
  input: BuildIeltsClassStudyPlanViewInput,
): IeltsClassStudyPlanSurfaceView {
  const maxWeakSubskillsPerLearner = input.maxWeakSubskillsPerLearner ?? 3;
  const maxWeakSubskillsPerClass = input.maxWeakSubskillsPerClass ?? 5;

  const profilesByUser = new Map(input.profiles.map((profile) => [profile.userId, profile]));
  const membershipsByClass = new Map<string, string[]>();
  for (const membership of input.memberships) {
    const userIds = membershipsByClass.get(membership.classId) ?? [];
    if (!userIds.includes(membership.userId)) userIds.push(membership.userId);
    membershipsByClass.set(membership.classId, userIds);
  }

  const activePlanByUser = new Map<string, IeltsClassStudyPlanPlanInput>();
  for (const plan of [...input.plans].filter((row) => row.status === "active").sort(sortPlansDesc)) {
    if (!activePlanByUser.has(plan.userId)) activePlanByUser.set(plan.userId, plan);
  }

  const itemsByPlan = new Map<string, IeltsClassStudyPlanItemInput[]>();
  for (const item of input.items) {
    const items = itemsByPlan.get(item.planId) ?? [];
    items.push(item);
    itemsByPlan.set(item.planId, items);
  }

  const weakSubskillsByUser = new Map<string, IeltsClassStudyPlanWeakSubskillInput[]>();
  for (const weakness of input.weakSubskills) {
    if (weakness.weaknessWeight <= 0 || weakness.confidence <= 0) continue;
    const rows = weakSubskillsByUser.get(weakness.userId) ?? [];
    rows.push(weakness);
    weakSubskillsByUser.set(weakness.userId, rows);
  }

  const learnerContext: BuildLearnerContext = {
    profilesByUser,
    activePlanByUser,
    itemsByPlan,
    weakSubskillsByUser,
    todayIso: input.todayIso,
    maxWeakSubskillsPerLearner,
  };

  const classes = input.classes.map((classRow) => {
    const userIds = membershipsByClass.get(classRow.id) ?? [];
    const learners = userIds
      .map((userId) => buildLearnerView(userId, learnerContext))
      .sort(sortLearners);

    const classProgress = mergeProgress(learners.map((learner) => learner.progress));

    return {
      id: classRow.id,
      title: classRow.title,
      learnerCount: learners.length,
      activePlanCount: learners.filter((learner) => learner.hasActivePlan).length,
      needsAttentionCount: learners.filter((learner) => learner.needsAttention).length,
      averagePredictedBand: averageBand(learners.map((learner) => learner.predictedBand)),
      progress: classProgress,
      weakSubskills: buildClassWeakSubskills(learners, maxWeakSubskillsPerClass),
      learners,
    };
  });

  const learnerViews = classes.flatMap((classRow) => classRow.learners);
  const uniqueLearners = new Map(learnerViews.map((learner) => [learner.userId, learner]));

  return {
    classCount: classes.length,
    learnerCount: uniqueLearners.size,
    activePlanCount: [...uniqueLearners.values()].filter((learner) => learner.hasActivePlan).length,
    needsAttentionCount: [...uniqueLearners.values()].filter((learner) => learner.needsAttention).length,
    averagePredictedBand: averageBand(
      [...uniqueLearners.values()].map((learner) => learner.predictedBand),
    ),
    progress: mergeProgress([...uniqueLearners.values()].map((learner) => learner.progress)),
    classes,
  };
}
