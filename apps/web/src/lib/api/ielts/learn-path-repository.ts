/**
 * Learner-shell reads for the IELTS Learn-mode path (WS-6.2.3 / WS-D.6).
 *
 * Learn reuses the existing `courses → course_modules → activities` spine: an
 * IELTS course (`subject = 'ielts'`, published) is a guided path, its modules are
 * units, and its activities are micro-lessons. All reads are RLS-respecting and
 * own-scoped — `activity_attempts` and `ielts_skill_states` are SELECT-own, and
 * published courses/modules + non-archived activities are world-readable — so a
 * learner only ever sees their own progress and mastery. No answer keys are
 * touched. The view-shaping (stitch + sort + recommend) lives in the pure,
 * unit-tested `lib/ielts/learner/learn-path` module; this file only fetches and
 * delegates.
 */
import "server-only";

import type { Tables } from "@/types/supabase";
import {
  activitySubskillKeys,
  buildLearnPath,
  buildLearnUnit,
  buildSubskillMastery,
  lessonEstimatedMinutes,
  type LearnActivityRow,
  type LearnAttemptRow,
  type LearnCourseRow,
  type LearnModuleRow,
  type LearnPathView,
  type LearnSkillStateRow,
  type LearnSubskillRow,
  type LearnUnitView,
  type SubskillMastery,
} from "@/lib/ielts/learner/learn-path";
import { resolveIeltsClient, type IeltsDbClient } from "./client";

const COURSE_COLUMNS = "id, title, slug, sort_order";
const MODULE_COLUMNS = "id, course_id, title, description, sort_order";
const ACTIVITY_COLUMNS =
  "id, module_id, title, description, activity_type, content, phase, duration_minutes, order_index";
const ATTEMPT_COLUMNS = "activity_id, completed_at, score, max_score";
const STATE_COLUMNS = "subskill_key, skill, module, mastery_score, confidence, evidence_count";
const SUBSKILL_COLUMNS = "key, label_en, label_vi, skill";

export interface IeltsLearnPathData {
  /** The primary guided path (first published IELTS course), or null when none is seeded. */
  path: LearnPathView | null;
}

export interface IeltsLearnLessonData {
  activity: {
    id: string;
    title: string;
    description: string | null;
    activityType: string;
    content: Tables<"activities">["content"];
    phase: string | null;
    estimatedMinutes: number;
  };
  courseId: string;
  courseTitle: string;
  unit: { id: string; title: string };
  pathHref: string;
  unitHref: string;
  nextLessonHref: string | null;
  subskillKeys: string[];
  beforeMastery: SubskillMastery[];
}

/** Own-scoped mastery snapshot for a set of subskill keys (RLS-own SELECT). */
export async function loadSubskillMasteryForUser(
  userId: string,
  subskillKeys: string[],
  client: IeltsDbClient,
): Promise<SubskillMastery[]> {
  if (subskillKeys.length === 0) return [];
  const [statesResult, subskillsResult] = await Promise.all([
    client
      .from("ielts_skill_states")
      .select(STATE_COLUMNS)
      .eq("user_id", userId)
      .in("subskill_key", subskillKeys),
    client.from("ielts_subskills").select(SUBSKILL_COLUMNS).in("key", subskillKeys),
  ]);
  if (statesResult.error) {
    throw new Error(`loadSubskillMasteryForUser (states): ${statesResult.error.message}`);
  }
  if (subskillsResult.error) {
    throw new Error(`loadSubskillMasteryForUser (subskills): ${subskillsResult.error.message}`);
  }
  return buildSubskillMastery(
    subskillKeys,
    (statesResult.data ?? []) as LearnSkillStateRow[],
    (subskillsResult.data ?? []) as LearnSubskillRow[],
  );
}

async function loadModuleActivities(
  moduleIds: string[],
  client: IeltsDbClient,
): Promise<LearnActivityRow[]> {
  if (moduleIds.length === 0) return [];
  const { data, error } = await client
    .from("activities")
    .select(ACTIVITY_COLUMNS)
    .in("module_id", moduleIds)
    .eq("is_archived", false)
    .order("order_index", { ascending: true });
  if (error) throw new Error(`loadModuleActivities: ${error.message}`);
  return (data ?? []) as LearnActivityRow[];
}

async function loadCompletedAttempts(
  userId: string,
  activityIds: string[],
  client: IeltsDbClient,
): Promise<LearnAttemptRow[]> {
  if (activityIds.length === 0) return [];
  const { data, error } = await client
    .from("activity_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .in("activity_id", activityIds);
  if (error) throw new Error(`loadCompletedAttempts: ${error.message}`);
  return (data ?? []) as LearnAttemptRow[];
}

async function loadMasteryInputs(
  userId: string,
  subskillKeys: string[],
  client: IeltsDbClient,
): Promise<{ skillStates: LearnSkillStateRow[]; subskills: LearnSubskillRow[] }> {
  if (subskillKeys.length === 0) return { skillStates: [], subskills: [] };
  const [statesResult, subskillsResult] = await Promise.all([
    client
      .from("ielts_skill_states")
      .select(STATE_COLUMNS)
      .eq("user_id", userId)
      .in("subskill_key", subskillKeys),
    client.from("ielts_subskills").select(SUBSKILL_COLUMNS).in("key", subskillKeys),
  ]);
  if (statesResult.error) throw new Error(`loadMasteryInputs (states): ${statesResult.error.message}`);
  if (subskillsResult.error) {
    throw new Error(`loadMasteryInputs (subskills): ${subskillsResult.error.message}`);
  }
  return {
    skillStates: (statesResult.data ?? []) as LearnSkillStateRow[],
    subskills: (subskillsResult.data ?? []) as LearnSubskillRow[],
  };
}

function distinctKeys(activities: LearnActivityRow[]): string[] {
  return [...new Set(activities.flatMap((activity) => activitySubskillKeys(activity.content)))];
}

/** The home payload: the first published IELTS course shaped into a guided path. */
export async function getIeltsLearnPathData(
  userId: string,
  client?: IeltsDbClient,
): Promise<IeltsLearnPathData> {
  const supabase = await resolveIeltsClient(client);

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("subject", "ielts")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .limit(1);
  if (coursesError) throw new Error(`getIeltsLearnPathData (courses): ${coursesError.message}`);

  const course = (courses ?? [])[0] as LearnCourseRow | undefined;
  if (!course) return { path: null };

  const { data: modulesData, error: modulesError } = await supabase
    .from("course_modules")
    .select(MODULE_COLUMNS)
    .eq("course_id", course.id)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (modulesError) throw new Error(`getIeltsLearnPathData (modules): ${modulesError.message}`);

  const modules = (modulesData ?? []) as LearnModuleRow[];
  const activities = await loadModuleActivities(
    modules.map((module) => module.id),
    supabase,
  );

  const [attempts, masteryInputs] = await Promise.all([
    loadCompletedAttempts(userId, activities.map((activity) => activity.id), supabase),
    loadMasteryInputs(userId, distinctKeys(activities), supabase),
  ]);

  return {
    path: buildLearnPath({
      course,
      modules,
      activities,
      attempts,
      skillStates: masteryInputs.skillStates,
      subskills: masteryInputs.subskills,
    }),
  };
}

/** Verify a module belongs to a published IELTS course, then shape the unit screen. */
export async function getIeltsLearnUnitData(
  userId: string,
  moduleId: string,
  client?: IeltsDbClient,
): Promise<LearnUnitView | null> {
  const supabase = await resolveIeltsClient(client);

  const { data: moduleRow, error: moduleError } = await supabase
    .from("course_modules")
    .select(`${MODULE_COLUMNS}, is_archived`)
    .eq("id", moduleId)
    .maybeSingle();
  if (moduleError) throw new Error(`getIeltsLearnUnitData (module): ${moduleError.message}`);
  if (!moduleRow || moduleRow.is_archived) return null;

  const course = await loadIeltsCourse(moduleRow.course_id, supabase);
  if (!course) return null;

  const activities = await loadModuleActivities([moduleId], supabase);
  const [attempts, masteryInputs] = await Promise.all([
    loadCompletedAttempts(userId, activities.map((activity) => activity.id), supabase),
    loadMasteryInputs(userId, distinctKeys(activities), supabase),
  ]);

  return buildLearnUnit({
    module: moduleRow as LearnModuleRow,
    courseTitle: course.title,
    activities,
    attempts,
    skillStates: masteryInputs.skillStates,
    subskills: masteryInputs.subskills,
  });
}

/** Shape one lesson: the activity to play, navigation, and the before-mastery snapshot. */
export async function getIeltsLearnLessonData(
  userId: string,
  activityId: string,
  client?: IeltsDbClient,
): Promise<IeltsLearnLessonData | null> {
  const supabase = await resolveIeltsClient(client);

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select(`${ACTIVITY_COLUMNS}, is_archived`)
    .eq("id", activityId)
    .maybeSingle();
  if (activityError) throw new Error(`getIeltsLearnLessonData (activity): ${activityError.message}`);
  if (!activity || activity.is_archived) return null;

  const { data: moduleRow, error: moduleError } = await supabase
    .from("course_modules")
    .select("id, course_id, title")
    .eq("id", activity.module_id)
    .maybeSingle();
  if (moduleError) throw new Error(`getIeltsLearnLessonData (module): ${moduleError.message}`);
  if (!moduleRow) return null;

  const course = await loadIeltsCourse(moduleRow.course_id, supabase);
  if (!course) return null;

  // Sibling lessons drive the "next lesson" CTA on the completion screen.
  const { data: siblings, error: siblingsError } = await supabase
    .from("activities")
    .select("id, order_index")
    .eq("module_id", activity.module_id)
    .eq("is_archived", false)
    .order("order_index", { ascending: true });
  if (siblingsError) throw new Error(`getIeltsLearnLessonData (siblings): ${siblingsError.message}`);

  const ordered = (siblings ?? []) as Array<{ id: string; order_index: number }>;
  const currentIdx = ordered.findIndex((row) => row.id === activityId);
  const nextSibling = currentIdx >= 0 ? ordered[currentIdx + 1] : undefined;

  const subskillKeys = activitySubskillKeys(activity.content);
  const beforeMastery = await loadSubskillMasteryForUser(userId, subskillKeys, supabase);

  return {
    activity: {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      activityType: activity.activity_type,
      content: activity.content,
      phase: activity.phase,
      estimatedMinutes: lessonEstimatedMinutes(activity),
    },
    courseId: moduleRow.course_id,
    courseTitle: course.title,
    unit: { id: moduleRow.id, title: moduleRow.title },
    pathHref: "/ielts/learn",
    unitHref: `/ielts/learn/units/${moduleRow.id}`,
    nextLessonHref: nextSibling ? `/ielts/learn/lessons/${nextSibling.id}` : null,
    subskillKeys,
    beforeMastery,
  };
}

async function loadIeltsCourse(
  courseId: string,
  client: IeltsDbClient,
): Promise<{ id: string; title: string } | null> {
  const { data, error } = await client
    .from("courses")
    .select("id, title, subject, is_published")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw new Error(`loadIeltsCourse: ${error.message}`);
  if (!data || data.subject !== "ielts" || !data.is_published) return null;
  return { id: data.id, title: data.title };
}
