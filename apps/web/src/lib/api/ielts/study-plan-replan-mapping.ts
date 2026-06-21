/**
 * WS-6.2.4 — row ⇄ projection mapping for the replan repository.
 *
 * Pure transforms between persisted DB rows and the dependency-free shapes the
 * `study-plan/replan` engine reasons over. No DB access here; split from
 * `study-plan-replan.ts` only to keep each file under the line cap.
 */
import type {
  IeltsBandPrediction,
} from "@/lib/ielts/adaptive/contracts";
import {
  planItemReferenceKey,
  type ExistingReconcileItem,
  type IeltsGeneratedStudyPlan,
  type ReplanPredictionView,
  type ReplanRevisionView,
} from "@/lib/ielts/study-plan";
import type {
  StudyPlanItemRow,
  StudyPlanRow,
} from "./study-plan-repository";

function planItemMetadataTitle(
  row: StudyPlanItemRow,
  key: "titleEn" | "titleVi",
): string {
  const metadata = row.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return row.focus_area;
}

export function toExistingReconcileItem(
  row: StudyPlanItemRow,
): ExistingReconcileItem {
  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    scheduledDate: row.scheduled_date,
    skill: row.skill,
    focusArea: row.focus_area,
    titleEn: planItemMetadataTitle(row, "titleEn"),
    titleVi: planItemMetadataTitle(row, "titleVi"),
    referenceKey: planItemReferenceKey(row),
    isTeacherAssigned:
      row.kind === "teacher_assignment" || row.assignment_id != null,
  };
}

function previousTopWeaknessKey(planRow: StudyPlanRow): string | null {
  const explanation = planRow.explanation;
  if (
    !explanation ||
    typeof explanation !== "object" ||
    Array.isArray(explanation)
  ) {
    return null;
  }
  const plan = (explanation as Record<string, unknown>).plan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  const priorities = (plan as Record<string, unknown>).skillPriorities;
  if (!Array.isArray(priorities) || priorities.length === 0) return null;
  const top = priorities[0];
  if (!top || typeof top !== "object") return null;
  const key = (top as Record<string, unknown>).weaknessKey;
  return typeof key === "string" ? key : null;
}

export function previousRevisionView(
  planRow: StudyPlanRow,
  pendingFutureItems: number,
): ReplanRevisionView {
  return {
    predictedOverallBand: planRow.predicted_overall_band,
    predictedSkillBands: {
      listening: planRow.predicted_listening_band,
      reading: planRow.predicted_reading_band,
      writing: planRow.predicted_writing_band,
      speaking: planRow.predicted_speaking_band,
    },
    topWeaknessKey: previousTopWeaknessKey(planRow),
    topWeaknessLabelEn: null,
    topWeaknessLabelVi: null,
    pendingFutureItems,
  };
}

export function currentRevisionView(
  generatedPlan: IeltsGeneratedStudyPlan,
  prediction: IeltsBandPrediction,
  pendingFutureItems: number,
): ReplanRevisionView {
  const top = generatedPlan.skillPriorities[0] ?? null;
  return {
    predictedOverallBand: prediction.overall.band,
    predictedSkillBands: {
      listening: prediction.skills.listening.band,
      reading: prediction.skills.reading.band,
      writing: prediction.skills.writing.band,
      speaking: prediction.skills.speaking.band,
    },
    topWeaknessKey: top?.weaknessKey ?? null,
    topWeaknessLabelEn: top?.labelEn ?? null,
    topWeaknessLabelVi: top?.labelVi ?? null,
    pendingFutureItems,
  };
}

export function toPredictionView(
  view: ReplanRevisionView,
): ReplanPredictionView {
  return {
    overallBand: view.predictedOverallBand,
    skillBands: view.predictedSkillBands,
    topWeaknessKey: view.topWeaknessKey,
  };
}
