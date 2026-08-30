/**
 * Shared product contracts used by the IELTS assessment and teaching surfaces.
 * Keep these values as string unions so API payloads, database rows, and the
 * web/mobile clients cannot silently drift apart.
 */

export const ASSESSMENT_MODES = ["practice", "simulation"] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

export const WORKSPACE_ROLES = ["student", "teacher", "admin"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const SCORE_SOURCES = [
  "objective",
  "ai_provisional",
  "teacher_confirmed",
] as const;
export type ScoreSource = (typeof SCORE_SOURCES)[number];

export const LESSON_OCCURRENCE_STATUSES = [
  "scheduled",
  "cancelled",
  "completed",
] as const;
export type LessonOccurrenceStatus =
  (typeof LESSON_OCCURRENCE_STATUSES)[number];

export const REVIEW_STATUSES = [
  "pending",
  "draft",
  "published",
  "returned",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

