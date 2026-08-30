import {
  speakingBandFromCriteria,
  type SpeakingCriteriaBands,
} from "@/lib/scoring/ielts-speaking/band-math";
import {
  taskBandFromCriteria,
  type WritingCriteriaBands,
} from "@/lib/scoring/ielts-writing/band-math";

export const IELTS_TEACHER_RUBRIC_KEY = "ielts_official_v1" as const;
export const IELTS_TEACHER_RUBRIC_VERSION = 1 as const;

export type WritingTaskScope = "task1" | "task2";
export type TeacherReviewKind = "writing" | "speaking";
export type TeacherReviewStatus = "draft" | "published" | "returned";

export interface RubricCriterion {
  key: string;
  dbKey: string;
  labelEn: string;
  labelVi: string;
  weight: number;
  skill: "writing" | "speaking";
  taskScope?: WritingTaskScope;
}

export const WRITING_TEACHER_CRITERIA: readonly RubricCriterion[] = [
  {
    key: "taskAchievement",
    dbKey: "task_response",
    labelEn: "Task Achievement",
    labelVi: "Mức độ hoàn thành yêu cầu đề",
    weight: 0.25,
    skill: "writing",
    taskScope: "task1",
  },
  {
    key: "taskResponse",
    dbKey: "task_response",
    labelEn: "Task Response",
    labelVi: "Trả lời yêu cầu đề",
    weight: 0.25,
    skill: "writing",
    taskScope: "task2",
  },
  {
    key: "coherenceCohesion",
    dbKey: "coherence_cohesion",
    labelEn: "Coherence and Cohesion",
    labelVi: "Tính mạch lạc và liên kết",
    weight: 0.25,
    skill: "writing",
  },
  {
    key: "lexicalResource",
    dbKey: "lexical_resource",
    labelEn: "Lexical Resource",
    labelVi: "Vốn từ vựng",
    weight: 0.25,
    skill: "writing",
  },
  {
    key: "grammaticalRangeAccuracy",
    dbKey: "grammar_range_accuracy",
    labelEn: "Grammatical Range and Accuracy",
    labelVi: "Đa dạng và chính xác ngữ pháp",
    weight: 0.25,
    skill: "writing",
  },
] as const;

export const SPEAKING_TEACHER_CRITERIA: readonly RubricCriterion[] = [
  {
    key: "fluencyCoherence",
    dbKey: "fluency_coherence",
    labelEn: "Fluency and Coherence",
    labelVi: "Độ trôi chảy và mạch lạc",
    weight: 0.25,
    skill: "speaking",
  },
  {
    key: "lexicalResource",
    dbKey: "lexical_resource",
    labelEn: "Lexical Resource",
    labelVi: "Vốn từ vựng",
    weight: 0.25,
    skill: "speaking",
  },
  {
    key: "grammaticalRangeAccuracy",
    dbKey: "grammar_range_accuracy",
    labelEn: "Grammatical Range and Accuracy",
    labelVi: "Đa dạng và chính xác ngữ pháp",
    weight: 0.25,
    skill: "speaking",
  },
  {
    key: "pronunciation",
    dbKey: "pronunciation",
    labelEn: "Pronunciation",
    labelVi: "Phát âm",
    weight: 0.25,
    skill: "speaking",
  },
] as const;

export interface TeacherRubricDefinition {
  key: typeof IELTS_TEACHER_RUBRIC_KEY;
  version: typeof IELTS_TEACHER_RUBRIC_VERSION;
  writing: {
    task1: readonly RubricCriterion[];
    task2: readonly RubricCriterion[];
  };
  speaking: readonly RubricCriterion[];
}

export const IELTS_TEACHER_RUBRIC: TeacherRubricDefinition = {
  key: IELTS_TEACHER_RUBRIC_KEY,
  version: IELTS_TEACHER_RUBRIC_VERSION,
  writing: {
    task1: WRITING_TEACHER_CRITERIA.filter((criterion) => criterion.taskScope === "task1"),
    task2: WRITING_TEACHER_CRITERIA.filter((criterion) => criterion.taskScope === "task2" || !criterion.taskScope),
  },
  speaking: SPEAKING_TEACHER_CRITERIA,
};

export type TeacherBands = Partial<Record<string, number | null>>;

export function isHalfBand(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 9 && Number.isInteger(value * 2);
}

export function validateTeacherBands(bands: TeacherBands): void {
  for (const [key, value] of Object.entries(bands)) {
    if (value !== null && value !== undefined && !isHalfBand(value)) {
      throw new Error(`${key} must be an IELTS half-band between 0 and 9`);
    }
  }
}

export function deriveWritingTaskBand(bands: TeacherBands): number | null {
  const values = {
    taskResponse: bands.taskResponse ?? bands.taskAchievement,
    coherenceCohesion: bands.coherenceCohesion,
    lexicalResource: bands.lexicalResource,
    grammaticalRangeAccuracy: bands.grammaticalRangeAccuracy,
  };
  if (Object.values(values).some((value) => value == null)) return null;
  return taskBandFromCriteria(values as WritingCriteriaBands);
}

export function deriveSpeakingBand(bands: TeacherBands): number | null {
  const values = {
    fluencyCoherence: bands.fluencyCoherence,
    lexicalResource: bands.lexicalResource,
    grammaticalRangeAccuracy: bands.grammaticalRangeAccuracy,
    pronunciation: bands.pronunciation,
  };
  if (Object.values(values).some((value) => value == null)) return null;
  return speakingBandFromCriteria(values as SpeakingCriteriaBands);
}

export function criteriaForReview(kind: TeacherReviewKind, taskNumber?: number): readonly RubricCriterion[] {
  if (kind === "speaking") return SPEAKING_TEACHER_CRITERIA;
  return taskNumber === 1 ? IELTS_TEACHER_RUBRIC.writing.task1.concat(IELTS_TEACHER_RUBRIC.writing.task2.filter((c) => !c.taskScope)) : IELTS_TEACHER_RUBRIC.writing.task2;
}
