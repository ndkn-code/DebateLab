import {
  type IeltsLearnAtom,
  type IeltsPlanAtomKind,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import type {
  IeltsGeneratedPlanReference,
  IeltsGeneratedStudyPlanItem,
  IeltsReviewSeed,
  IeltsSkillPriority,
  IeltsTeacherAssignmentSeed,
} from "./types";

function skillLabel(skill: IeltsSkill): string {
  return skill[0].toUpperCase() + skill.slice(1);
}

function roundPriority(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function availableStatus(
  scheduledDate: string,
  startDate: string,
): IeltsGeneratedStudyPlanItem["status"] {
  return scheduledDate === startDate ? "available" : "scheduled";
}

function itemKindForPriority(priority: IeltsSkillPriority): IeltsPlanAtomKind {
  const atom = priority.recommendedAtom;
  if (!atom) return "mini_mock";
  if (atom.scoringMode === "ai_writing" && atom.questionIds.length > 0) {
    return "writing_submission";
  }
  if (atom.scoringMode === "ai_speaking" && atom.questionIds.length > 0) {
    return "speaking_submission";
  }
  return "learn_activity";
}

function referenceForPriority(
  kind: IeltsPlanAtomKind,
  atom: IeltsLearnAtom | null,
): IeltsGeneratedPlanReference {
  if (kind === "writing_submission" || kind === "speaking_submission") {
    return { type: "question", questionId: atom?.questionIds[0] ?? null };
  }
  if (atom) return { type: "learn_atom", atom };
  return { type: "mock", testId: null };
}

function estimateMinutes(priority: IeltsSkillPriority, remaining: number): number {
  const ideal = priority.recommendedAtom?.estimatedMinutes ?? 18;
  return Math.max(5, Math.min(ideal, remaining));
}

function rationaleForPriority(priority: IeltsSkillPriority): {
  en: string;
  vi: string;
} {
  if (priority.isMaintenance) {
    return {
      en: `${priority.labelEn} gets a light maintenance touch while the plan protects the declared focus skills.`,
      vi: `${priority.labelVi} chỉ được ôn duy trì nhẹ để kế hoạch ưu tiên kỹ năng trọng tâm đã khai báo.`,
    };
  }

  return {
    en: `${priority.labelEn} is ${priority.gapBands.toFixed(1)} band from the ${priority.targetBand.toFixed(1)} target, with ${Math.round(priority.weakness.confidence * 100)}% confidence.`,
    vi: `${priority.labelVi} còn cách mục tiêu ${priority.targetBand.toFixed(1)} khoảng ${priority.gapBands.toFixed(1)} band, với độ tin cậy ${Math.round(priority.weakness.confidence * 100)}%.`,
  };
}

export function makePriorityItem(params: {
  priority: IeltsSkillPriority;
  scheduledDate: string;
  startDate: string;
  sequence: number;
  remainingMinutes: number;
  predictionSourceId: string | null;
}): IeltsGeneratedStudyPlanItem {
  const kind = itemKindForPriority(params.priority);
  const rationale = rationaleForPriority(params.priority);
  const minutes = estimateMinutes(params.priority, params.remainingMinutes);

  return {
    tempId: `ielts-plan-${params.scheduledDate}-${params.sequence}`,
    scheduledDate: params.scheduledDate,
    kind,
    status: availableStatus(params.scheduledDate, params.startDate),
    skill: params.priority.skill,
    focusArea: params.priority.focusArea,
    titleEn: `${skillLabel(params.priority.skill)}: ${params.priority.labelEn}`,
    titleVi: `${skillLabel(params.priority.skill)}: ${params.priority.labelVi}`,
    estimatedMinutes: minutes,
    priorityScore: params.priority.priorityScore,
    sourceWeaknessKeys: [params.priority.weaknessKey],
    rationaleEn: rationale.en,
    rationaleVi: rationale.vi,
    reference: referenceForPriority(kind, params.priority.recommendedAtom),
    metadata: {
      predictionSourceId: params.predictionSourceId,
      maintenance: params.priority.isMaintenance,
      declaredFocus: params.priority.isDeclaredFocus,
    },
  };
}

export function makeReviewItem(params: {
  review: IeltsReviewSeed;
  scheduledDate: string;
  startDate: string;
  sequence: number;
}): IeltsGeneratedStudyPlanItem {
  const priority = params.review.priorityScore ?? 0.5;
  return {
    tempId: `ielts-plan-${params.scheduledDate}-review-${params.sequence}`,
    scheduledDate: params.scheduledDate,
    kind: "review",
    status: availableStatus(params.scheduledDate, params.startDate),
    skill: params.review.skill,
    focusArea: params.review.focusArea,
    titleEn: `${skillLabel(params.review.skill)} review`,
    titleVi: `Ôn tập ${skillLabel(params.review.skill)}`,
    estimatedMinutes: params.review.estimatedMinutes ?? 5,
    priorityScore: roundPriority(priority),
    sourceWeaknessKeys: [],
    rationaleEn: "A due spaced-review item is scheduled before new practice.",
    rationaleVi: "Một mục ôn giãn cách đến hạn được xếp trước phần luyện mới.",
    reference: { type: "review_item", reviewItemId: params.review.reviewItemId },
    metadata: { dueAt: params.review.dueAt },
  };
}

export function makeTeacherAssignmentItem(params: {
  assignment: IeltsTeacherAssignmentSeed;
  startDate: string;
  sequence: number;
}): IeltsGeneratedStudyPlanItem {
  return {
    tempId: `ielts-plan-${params.assignment.scheduledDate}-assignment-${params.sequence}`,
    scheduledDate: params.assignment.scheduledDate,
    kind: params.assignment.kind ?? "teacher_assignment",
    status: availableStatus(params.assignment.scheduledDate, params.startDate),
    skill: params.assignment.skill,
    focusArea: params.assignment.focusArea,
    titleEn: `${skillLabel(params.assignment.skill)} teacher assignment`,
    titleVi: `Bài giáo viên giao: ${skillLabel(params.assignment.skill)}`,
    estimatedMinutes: params.assignment.estimatedMinutes,
    priorityScore: 99,
    sourceWeaknessKeys: [],
    rationaleEn: "Teacher-assigned work is fixed and planned around first.",
    rationaleVi: "Bài giáo viên giao là cố định và được ưu tiên xếp trước.",
    reference: {
      type: "teacher_assignment",
      assignmentId: params.assignment.assignmentId,
    },
    metadata: { fixed: true },
  };
}

export function diagnosticItem(params: {
  skill: IeltsSkill;
  scheduledDate: string;
  startDate: string;
  sequence: number;
  minutes: number;
}): IeltsGeneratedStudyPlanItem {
  const kind: IeltsPlanAtomKind =
    params.skill === "writing"
      ? "writing_submission"
      : params.skill === "speaking"
        ? "speaking_submission"
        : "mini_mock";
  const reference: IeltsGeneratedPlanReference =
    kind === "mini_mock"
      ? { type: "mock", testId: null }
      : { type: "question", questionId: null };

  return {
    tempId: `ielts-plan-${params.scheduledDate}-diagnostic-${params.sequence}`,
    scheduledDate: params.scheduledDate,
    kind,
    status: availableStatus(params.scheduledDate, params.startDate),
    skill: params.skill,
    focusArea: "quick diagnostic",
    titleEn: `${skillLabel(params.skill)} quick diagnostic`,
    titleVi: `Chẩn đoán nhanh ${skillLabel(params.skill)}`,
    estimatedMinutes: Math.min(params.minutes, 20),
    priorityScore: 1,
    sourceWeaknessKeys: [],
    rationaleEn: "No reliable weakness evidence exists yet, so diagnostic work comes first.",
    rationaleVi: "Chưa có đủ bằng chứng điểm yếu đáng tin cậy, nên cần làm chẩn đoán trước.",
    reference,
    metadata: { diagnostic: true },
  };
}
