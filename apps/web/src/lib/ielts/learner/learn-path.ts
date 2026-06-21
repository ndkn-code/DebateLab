/**
 * Pure view-model builders for the IELTS Learn-mode path (WS-6.2.3 / WS-D.6).
 *
 * Learn presents the existing `courses → course_modules → activities` spine as a
 * guided path of units and micro-lessons (research: learn-mode-activities.md).
 * The DB reads (lib/api/ielts/learn-path-repository.ts) fetch the raw rows under
 * RLS; this module stitches them into serialisable, view-ready shapes —
 * completion state, per-subskill mastery, and the explainable "recommended next"
 * lesson — with no DB or React, so it is unit-tested in isolation.
 *
 * Mastery is always evidence-backed: a subskill the learner has no evidence for
 * shows as `untouched`, never an invented band (synthesis §2 — explainable, not
 * black-box). Lessons stay browsable; the recommended node is a hint, not a lock.
 */
import type { Tables } from "@/types/supabase";
import {
  ieltsTextActivityEstimatedMinutes,
  isIeltsFirstTextActivityType,
} from "@/lib/ielts/learn/text-activities";

// ── Row shapes (the repository selects exactly these columns) ────────────────
export type LearnCourseRow = Pick<Tables<"courses">, "id" | "title" | "slug" | "sort_order">;
export type LearnModuleRow = Pick<
  Tables<"course_modules">,
  "id" | "course_id" | "title" | "description" | "sort_order"
>;
export type LearnActivityRow = Pick<
  Tables<"activities">,
  | "id"
  | "module_id"
  | "title"
  | "description"
  | "activity_type"
  | "content"
  | "phase"
  | "duration_minutes"
  | "order_index"
>;
export type LearnAttemptRow = Pick<
  Tables<"activity_attempts">,
  "activity_id" | "completed_at" | "score" | "max_score"
>;
export type LearnSkillStateRow = Pick<
  Tables<"ielts_skill_states">,
  "subskill_key" | "skill" | "module" | "mastery_score" | "confidence" | "evidence_count"
>;
export type LearnSubskillRow = Pick<
  Tables<"ielts_subskills">,
  "key" | "label_en" | "label_vi" | "skill"
>;

// ── Mastery model (research learn-mode-activities.md §"Mastery model") ────────
// `ielts_skill_states.mastery_score` is normalised 0–1; the research labels are
// on a 0–100 scale: 0–39 focus, 40–64 building, 65–84 test-ready, 85–100 mastered.
export type MasteryLevel = "untouched" | "focus" | "building" | "test_ready" | "mastered";

export function masteryLevel(
  masteryScore: number | null,
  evidenceCount: number,
): MasteryLevel {
  if (!evidenceCount || masteryScore === null) return "untouched";
  const pct = masteryScore * 100;
  if (pct < 40) return "focus";
  if (pct < 65) return "building";
  if (pct < 85) return "test_ready";
  return "mastered";
}

export interface SubskillMastery {
  key: string;
  skill: string;
  labelEn: string;
  labelVi: string;
  masteryPercent: number; // 0–100, rounded
  confidence: number; // 0–1
  evidenceCount: number;
  level: MasteryLevel;
}

// ── Lesson / unit / path views ───────────────────────────────────────────────
export interface LearnLesson {
  id: string;
  title: string;
  description: string | null;
  activityType: string;
  phase: string | null;
  estimatedMinutes: number;
  isCompleted: boolean;
  scorePercent: number | null; // best completed score ratio (0–100), null if never completed
  subskillKeys: string[];
  isRecommended: boolean;
  href: string;
}

export interface LearnUnit {
  id: string;
  title: string;
  description: string | null;
  lessons: LearnLesson[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  isComplete: boolean;
  isRecommended: boolean; // contains the recommended next lesson
  subskillMastery: SubskillMastery[]; // mastery for the subskills this unit trains
  href: string;
}

export interface LearnRecommendation {
  unitId: string;
  unitTitle: string;
  lessonId: string;
  lessonTitle: string;
  estimatedMinutes: number;
  href: string;
}

export interface LearnPathView {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  units: LearnUnit[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  isComplete: boolean;
  recommended: LearnRecommendation | null;
  masteryOverview: SubskillMastery[]; // distinct subskills trained across the path
}

export function lessonHref(activityId: string): string {
  return `/ielts/learn/lessons/${activityId}`;
}

export function unitHref(moduleId: string): string {
  return `/ielts/learn/units/${moduleId}`;
}

/** Default lesson length when an activity has no authored `duration_minutes`. */
export function lessonEstimatedMinutes(activity: {
  duration_minutes: number | null;
  activity_type: string;
}): number {
  if (activity.duration_minutes && activity.duration_minutes > 0) {
    return activity.duration_minutes;
  }
  return isIeltsFirstTextActivityType(activity.activity_type)
    ? ieltsTextActivityEstimatedMinutes(activity.activity_type)
    : 4;
}

/**
 * Pull the subskill keys an activity trains out of its (jsonb, untyped) content.
 * IELTS text activities carry `sources: [{ subskillKey }]`; we read defensively
 * so malformed content degrades to "no tagged subskills" rather than throwing.
 */
export function activitySubskillKeys(content: unknown): string[] {
  const sources = (content as { sources?: unknown } | null)?.sources;
  if (!Array.isArray(sources)) return [];
  const keys: string[] = [];
  for (const source of sources) {
    const key = (source as { subskillKey?: unknown } | null)?.subskillKey;
    if (typeof key === "string" && key.length > 0) keys.push(key);
  }
  return [...new Set(keys)];
}

function roundPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Best completed score ratio (0–100) for each activity, from the learner's own
 * completed attempts. Only attempts with a `completed_at` count; the highest
 * ratio wins so a re-take never lowers the displayed score.
 */
function bestScoreByActivity(attempts: LearnAttemptRow[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const attempt of attempts) {
    if (!attempt.completed_at) continue;
    const max = attempt.max_score ?? 0;
    const ratio = max > 0 ? ((attempt.score ?? 0) / max) * 100 : 0;
    const current = best.get(attempt.activity_id);
    if (current === undefined || ratio > current) {
      best.set(attempt.activity_id, ratio);
    }
  }
  return best;
}

/**
 * Build the view-ready mastery rows for a set of subskill keys, in the order the
 * keys are given (deduped). A subskill with no skill-state row reads as
 * `untouched` with 0% — never a fabricated band. When a learner has both an
 * academic and general-training state for the same key, the one with the most
 * evidence wins (ties → first seen).
 */
/** Index states by subskill key, keeping the most-evidenced row when modules collide. */
function indexStatesByKey(
  skillStates: LearnSkillStateRow[],
): Map<string, LearnSkillStateRow> {
  const map = new Map<string, LearnSkillStateRow>();
  for (const state of skillStates) {
    const existing = map.get(state.subskill_key);
    if (!existing || state.evidence_count > existing.evidence_count) {
      map.set(state.subskill_key, state);
    }
  }
  return map;
}

/** Skill comes from the state row, else the subskill dictionary, else the key prefix. */
function resolveSkill(
  key: string,
  state: LearnSkillStateRow | undefined,
  dict: LearnSubskillRow | undefined,
): string {
  if (state) return state.skill;
  if (dict) return dict.skill;
  return key.split(":")[0] || "reading";
}

function toSubskillMastery(
  key: string,
  state: LearnSkillStateRow | undefined,
  dict: LearnSubskillRow | undefined,
): SubskillMastery {
  const masteryScore = state?.mastery_score ?? null;
  const evidenceCount = state?.evidence_count ?? 0;
  const labelEn = dict?.label_en ?? key;
  return {
    key,
    skill: resolveSkill(key, state, dict),
    labelEn,
    labelVi: dict?.label_vi ?? labelEn,
    masteryPercent: roundPercent((masteryScore ?? 0) * 100),
    confidence: state?.confidence ?? 0,
    evidenceCount,
    level: masteryLevel(masteryScore, evidenceCount),
  };
}

export function buildSubskillMastery(
  subskillKeys: string[],
  skillStates: LearnSkillStateRow[],
  subskills: LearnSubskillRow[],
): SubskillMastery[] {
  const stateByKey = indexStatesByKey(skillStates);
  const dictByKey = new Map(subskills.map((row) => [row.key, row]));
  const seen = new Set<string>();
  const result: SubskillMastery[] = [];
  for (const key of subskillKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(toSubskillMastery(key, stateByKey.get(key), dictByKey.get(key)));
  }
  return result;
}

/** Weakest-first ordering for surfacing focus areas; stable on ties by label. */
export function focusFirst(masteries: SubskillMastery[]): SubskillMastery[] {
  const rank: Record<MasteryLevel, number> = {
    focus: 0,
    building: 1,
    untouched: 2,
    test_ready: 3,
    mastered: 4,
  };
  return [...masteries].sort((a, b) => {
    if (rank[a.level] !== rank[b.level]) return rank[a.level] - rank[b.level];
    if (a.masteryPercent !== b.masteryPercent) return a.masteryPercent - b.masteryPercent;
    return a.labelEn.localeCompare(b.labelEn);
  });
}

function buildLessons(
  activities: LearnActivityRow[],
  bestScore: Map<string, number>,
): LearnLesson[] {
  return [...activities]
    .sort((a, b) => a.order_index - b.order_index)
    .map((activity) => {
      const score = bestScore.get(activity.id);
      return {
        id: activity.id,
        title: activity.title,
        description: activity.description,
        activityType: activity.activity_type,
        phase: activity.phase,
        estimatedMinutes: lessonEstimatedMinutes(activity),
        isCompleted: score !== undefined,
        scorePercent: score !== undefined ? roundPercent(score) : null,
        subskillKeys: activitySubskillKeys(activity.content),
        isRecommended: false,
        href: lessonHref(activity.id),
      };
    });
}

function summarizeUnit(
  module: LearnModuleRow,
  lessons: LearnLesson[],
  skillStates: LearnSkillStateRow[],
  subskills: LearnSubskillRow[],
): LearnUnit {
  const completedCount = lessons.filter((lesson) => lesson.isCompleted).length;
  const totalCount = lessons.length;
  const unitKeys = lessons.flatMap((lesson) => lesson.subskillKeys);
  return {
    id: module.id,
    title: module.title,
    description: module.description,
    lessons,
    completedCount,
    totalCount,
    progressPercent: totalCount > 0 ? roundPercent((completedCount / totalCount) * 100) : 0,
    isComplete: totalCount > 0 && completedCount === totalCount,
    isRecommended: false,
    subskillMastery: buildSubskillMastery(unitKeys, skillStates, subskills),
    href: unitHref(module.id),
  };
}

/**
 * Find the recommended next lesson: the first not-yet-completed lesson in path
 * order (unit `sort_order`, then lesson `order_index`). Mutates the matched
 * lesson/unit `isRecommended` flags and returns the recommendation, or null when
 * every lesson is complete (or the path is empty).
 */
export function applyRecommendation(units: LearnUnit[]): LearnRecommendation | null {
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (!lesson.isCompleted) {
        lesson.isRecommended = true;
        unit.isRecommended = true;
        return {
          unitId: unit.id,
          unitTitle: unit.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          estimatedMinutes: lesson.estimatedMinutes,
          href: lesson.href,
        };
      }
    }
  }
  return null;
}

export interface BuildLearnPathInput {
  course: LearnCourseRow;
  modules: LearnModuleRow[];
  activities: LearnActivityRow[];
  attempts: LearnAttemptRow[];
  skillStates: LearnSkillStateRow[];
  subskills: LearnSubskillRow[];
}

/** Stitch one IELTS course's units + lessons + the learner's progress + mastery. */
export function buildLearnPath(input: BuildLearnPathInput): LearnPathView {
  const bestScore = bestScoreByActivity(input.attempts);
  const activitiesByModule = new Map<string, LearnActivityRow[]>();
  for (const activity of input.activities) {
    const list = activitiesByModule.get(activity.module_id) ?? [];
    list.push(activity);
    activitiesByModule.set(activity.module_id, list);
  }

  const units = [...input.modules]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((module) => {
      const lessons = buildLessons(activitiesByModule.get(module.id) ?? [], bestScore);
      return summarizeUnit(module, lessons, input.skillStates, input.subskills);
    });

  const recommended = applyRecommendation(units);

  const totalCount = units.reduce((sum, unit) => sum + unit.totalCount, 0);
  const completedCount = units.reduce((sum, unit) => sum + unit.completedCount, 0);
  const pathKeys = units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.subskillKeys));

  return {
    courseId: input.course.id,
    courseTitle: input.course.title,
    courseSlug: input.course.slug,
    units,
    completedCount,
    totalCount,
    progressPercent: totalCount > 0 ? roundPercent((completedCount / totalCount) * 100) : 0,
    isComplete: totalCount > 0 && completedCount === totalCount,
    recommended,
    masteryOverview: buildSubskillMastery(pathKeys, input.skillStates, input.subskills),
  };
}

export interface BuildLearnUnitInput {
  module: LearnModuleRow;
  courseTitle: string;
  activities: LearnActivityRow[];
  attempts: LearnAttemptRow[];
  skillStates: LearnSkillStateRow[];
  subskills: LearnSubskillRow[];
}

export interface LearnUnitView {
  courseTitle: string;
  unit: LearnUnit;
  recommended: LearnRecommendation | null;
}

/** Single-unit view for the unit screen (recommendation scoped to this unit). */
export function buildLearnUnit(input: BuildLearnUnitInput): LearnUnitView {
  const bestScore = bestScoreByActivity(input.attempts);
  const lessons = buildLessons(input.activities, bestScore);
  const unit = summarizeUnit(input.module, lessons, input.skillStates, input.subskills);
  const recommended = applyRecommendation([unit]);
  return { courseTitle: input.courseTitle, unit, recommended };
}

// ── Lesson completion mastery delta (completion screen) ──────────────────────
export interface MasteryDelta {
  key: string;
  skill: string;
  labelEn: string;
  labelVi: string;
  beforePercent: number;
  afterPercent: number;
  deltaPercent: number;
  confidence: number;
  evidenceCount: number;
  level: MasteryLevel;
}

/**
 * Pair a before/after mastery snapshot into per-subskill deltas, in the order
 * the keys were trained. A subskill missing from either snapshot reads as 0% on
 * that side, so a first-ever attempt shows the full gain.
 */
function toMasteryDelta(
  key: string,
  after: SubskillMastery | undefined,
  before: SubskillMastery | undefined,
): MasteryDelta | null {
  const reference = after ?? before;
  if (!reference) return null;
  const beforePercent = before?.masteryPercent ?? 0;
  const afterPercent = after?.masteryPercent ?? beforePercent;
  return {
    key,
    skill: reference.skill,
    labelEn: reference.labelEn,
    labelVi: reference.labelVi,
    beforePercent,
    afterPercent,
    deltaPercent: afterPercent - beforePercent,
    confidence: after?.confidence ?? before?.confidence ?? 0,
    evidenceCount: after?.evidenceCount ?? before?.evidenceCount ?? 0,
    level: reference.level,
  };
}

export function diffMastery(
  subskillKeys: string[],
  before: SubskillMastery[],
  after: SubskillMastery[],
): MasteryDelta[] {
  const beforeByKey = new Map(before.map((row) => [row.key, row]));
  const afterByKey = new Map(after.map((row) => [row.key, row]));
  const seen = new Set<string>();
  const result: MasteryDelta[] = [];
  for (const key of subskillKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const delta = toMasteryDelta(key, afterByKey.get(key), beforeByKey.get(key));
    if (delta) result.push(delta);
  }
  return result;
}
