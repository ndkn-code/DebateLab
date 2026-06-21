import "server-only";

import type {
  IeltsGeneratedStudyPlanItem,
} from "@/lib/ielts/study-plan";
import type { Json, TablesInsert } from "@/types/supabase";
import {
  ieltsLearnAtomKey,
  type IeltsDiagnosticTestSummary,
} from "./study-plan-content";
import type { MaterializedSkillDrillTest } from "./skill-drill-repository";

function questionIdForSubmission(
  item: IeltsGeneratedStudyPlanItem,
  diagnosticTest: IeltsDiagnosticTestSummary | null,
): string | null {
  if (item.reference.type !== "question") return null;
  if (item.reference.questionId) return item.reference.questionId;
  if (item.kind === "writing_submission") {
    return diagnosticTest?.writingTask2QuestionId ?? null;
  }
  if (item.kind === "speaking_submission") {
    return diagnosticTest?.speakingPart2QuestionId ?? null;
  }
  return null;
}

function itemReferencePatch(params: {
  item: IeltsGeneratedStudyPlanItem;
  learnActivityByKey: Map<string, string>;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  skillDrillTestByKey: Map<string, MaterializedSkillDrillTest>;
}): Partial<TablesInsert<"ielts_study_plan_items">> | null {
  const { item } = params;

  switch (item.reference.type) {
    case "learn_atom": {
      const activityId = params.learnActivityByKey.get(
        ieltsLearnAtomKey(item.reference.atom),
      );
      return activityId ? { activity_id: activityId } : null;
    }
    case "mock": {
      const testId = item.reference.testId ?? params.diagnosticTest?.id ?? null;
      return testId ? { ielts_test_id: testId } : null;
    }
    case "skill_drill": {
      const test = params.skillDrillTestByKey.get(item.reference.drillKey);
      return test ? { ielts_test_id: test.id } : null;
    }
    case "question": {
      const questionId = questionIdForSubmission(item, params.diagnosticTest);
      return questionId ? { ielts_question_id: questionId } : null;
    }
    case "review_item":
      return { review_item_id: item.reference.reviewItemId };
    case "teacher_assignment":
      return { assignment_id: item.reference.assignmentId };
  }
}

export function toPlanItemInsert(params: {
  planId: string;
  userId: string;
  item: IeltsGeneratedStudyPlanItem;
  sourcePredictionId: string | null;
  learnActivityByKey: Map<string, string>;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  skillDrillTestByKey?: Map<string, MaterializedSkillDrillTest>;
}): TablesInsert<"ielts_study_plan_items"> | null {
  const pointer = itemReferencePatch({
    item: params.item,
    learnActivityByKey: params.learnActivityByKey,
    diagnosticTest: params.diagnosticTest,
    skillDrillTestByKey: params.skillDrillTestByKey ?? new Map(),
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
