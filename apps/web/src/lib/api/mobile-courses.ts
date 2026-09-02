import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MobileCourseActivityPhase,
  MobileCourseActivityType,
  MobileCourseCategory,
  MobileCourseDetail,
  MobileCourseEnrollResponse,
  MobileCourseEnrollment,
  MobileCourseLibraryItem,
  MobileCourseLibraryResponse,
  MobileCourseLibraryStatus,
  MobileCourseModuleAccessLevel,
  MobileCourseModuleSummary,
  MobileCourseUnitCompleteRequest,
  MobileCourseUnitCompleteResponse,
  MobileCourseUnitContent,
  MobileCourseUnitDetail,
  MobileCourseUnitKind,
  MobileCourseUnitLockReason,
  MobileCourseUnitResponse,
  MobileCourseUnitStartResponse,
  MobileCourseUnitSummary,
  MobileCourseVisibility,
  MobileDragOrderContent,
  MobileFillBlankContent,
  MobileFlashcardContent,
  MobileMatchingContent,
  MobileQuizContent,
  MobileQuizOption,
  MobileQuizQuestion,
} from "@thinkfy/shared/courses";

import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  canAccessModuleRecord,
  getUserEntitlement,
} from "@/lib/entitlements";
import { getCourseAccessMapFromRecords } from "@/lib/utils/courseAccess";

export class MobileCourseApiError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "mobile_course_error",
  ) {
    super(message);
    this.name = "MobileCourseApiError";
  }
}

type JsonRecord = Record<string, unknown>;

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  category: string | null;
  difficulty: string | null;
  estimated_hours: number | string | null;
  visibility: string | null;
  is_free: boolean | null;
  sort_order: number | null;
  created_at: string | null;
};

type ModuleRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
  access_level: string | null;
  is_archived: boolean | null;
  lessons?: LessonRow[];
  activities?: ActivityRow[];
};

type LessonRow = {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  slug: string;
  lesson_type?: string | null;
  type?: string | null;
  content?: unknown;
  content_body?: string | null;
  video_url?: string | null;
  video_duration_seconds?: number | null;
  practice_config?: JsonRecord | null;
  quiz_config?: JsonRecord | null;
  estimated_minutes?: number | null;
  duration_minutes?: number | null;
  sort_order?: number | null;
  order_index?: number | null;
  is_published?: boolean | null;
};

type ActivityRow = {
  id: string;
  module_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  phase: string | null;
  order_index: number | null;
  duration_minutes: number | null;
  is_archived: boolean | null;
  content: unknown;
  metadata: JsonRecord | null;
};

type QuizQuestionRow = {
  id: string;
  question_text?: string | null;
  question?: string | null;
  question_type?: string | null;
  type?: string | null;
  options?: unknown;
  correct_answer?: string | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  sort_order?: number | null;
  order_index?: number | null;
};

type Bundle = {
  courses: MobileCourseDetail[];
  courseBySlug: Map<string, MobileCourseDetail>;
};

const COURSE_SELECT =
  "id, slug, title, description, short_description, thumbnail_url, category, difficulty, estimated_hours, visibility, is_free, sort_order, created_at";
const MODULE_SELECT =
  "id, course_id, title, description, sort_order, access_level, is_archived, lessons(id, module_id, course_id, title, slug, lesson_type, content_body, video_url, video_duration_seconds, practice_config, quiz_config, estimated_minutes, sort_order, is_published), activities(id, module_id, activity_type, title, description, phase, order_index, duration_minutes, is_archived, content, metadata)";

function clampPercent(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(numeric) ? numeric : 0)));
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeCategory(value: string | null | undefined): MobileCourseCategory {
  const normalized = (value ?? "debate").trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "public-speaking") return "public-speaking";
  if (normalized === "argumentation") return "argumentation";
  if (normalized === "rhetoric") return "rhetoric";
  if (normalized === "critical-thinking") return "critical-thinking";
  return "debate";
}

function normalizeVisibility(value: string | null | undefined): MobileCourseVisibility {
  if (value === "premium" || value === "class_restricted") return value;
  return "public";
}

function normalizeAccessLevel(value: string | null | undefined): MobileCourseModuleAccessLevel {
  if (value === "free" || value === "premium") return value;
  return "locked";
}

function normalizePhase(value: string | null | undefined): MobileCourseActivityPhase {
  if (value === "practice" || value === "apply") return value;
  return "learn";
}

function normalizeLessonType(value: string | null | undefined) {
  if (value === "video" || value === "practice" || value === "quiz") return value;
  return "article";
}

function normalizeActivityType(value: string | null | undefined): MobileCourseActivityType {
  if (
    value === "quiz" ||
    value === "matching" ||
    value === "fill_blank" ||
    value === "drag_order" ||
    value === "flashcard"
  ) {
    return value;
  }
  return "lesson";
}

function getEstimatedHours(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Number(numeric) : 0;
}

function getLessonDuration(lesson: LessonRow) {
  return lesson.duration_minutes ?? lesson.estimated_minutes ?? 10;
}

function getLessonOrder(lesson: LessonRow) {
  return lesson.order_index ?? lesson.sort_order ?? 0;
}

function normalizeEnrollment(row: JsonRecord | null | undefined): MobileCourseEnrollment | null {
  if (!row) return null;

  return {
    id: asString(row.id),
    courseId: asString(row.course_id),
    status:
      row.status === "completed" || row.status === "paused"
        ? row.status
        : "active",
    progressPercent: clampPercent(row.progress_percent ?? row.progress_pct),
    startedAt: asString(row.started_at, "") || null,
    completedAt: asString(row.completed_at, "") || null,
    lastAccessedAt: asString(row.last_accessed_at, "") || null,
  };
}

function getUnitProgressCounts(modules: MobileCourseModuleSummary[]) {
  const units = modules.flatMap((module) => module.units);
  const completed = units.filter((unit) => unit.completed).length;
  return { units, completed, total: units.length };
}

function getLibraryStatus(
  enrollment: MobileCourseEnrollment | null,
  progressPercent: number,
): MobileCourseLibraryStatus {
  if (!enrollment) return "not-started";
  if (enrollment.status === "completed" || progressPercent >= 100) {
    return "completed";
  }
  return "in-progress";
}

function sortModules(modules: ModuleRow[]) {
  return [...modules]
    .filter((module) => module.is_archived !== true)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

function getFlatUnits(course: MobileCourseDetail) {
  return course.modules.flatMap((module) => module.units);
}

function getAdjacentUnits(course: MobileCourseDetail, unit: MobileCourseUnitSummary) {
  const units = getFlatUnits(course);
  const index = units.findIndex(
    (candidate) => candidate.id === unit.id && candidate.kind === unit.kind,
  );

  return {
    previousUnit: index > 0 ? units[index - 1] : null,
    nextUnit: index >= 0 && index < units.length - 1 ? units[index + 1] : null,
  };
}

function toLessonSummary(
  lesson: LessonRow,
  module: ModuleRow,
  completedLessonIds: Set<string>,
  moduleLocked: boolean,
  moduleLockReason: MobileCourseUnitLockReason,
): MobileCourseUnitSummary {
  const type = normalizeLessonType(lesson.lesson_type ?? lesson.type);
  const practiceDescription = asString(lesson.practice_config?.description);

  return {
    id: lesson.id,
    kind: "lesson",
    type,
    title: lesson.title,
    description:
      type === "practice"
        ? practiceDescription || lesson.content_body || null
        : lesson.content_body?.split(/\n\s*\n/)[0]?.replace(/^#+\s*/, "").slice(0, 180) ?? null,
    moduleId: module.id,
    moduleTitle: module.title,
    phase: type === "quiz" || type === "practice" ? "apply" : "learn",
    orderIndex: getLessonOrder(lesson),
    durationMinutes: getLessonDuration(lesson),
    completed: completedLessonIds.has(lesson.id),
    locked: moduleLocked,
    lockReason: moduleLocked ? moduleLockReason : null,
  };
}

function toActivitySummary(
  activity: ActivityRow,
  module: ModuleRow,
  completedActivityIds: Set<string>,
  moduleLocked: boolean,
  moduleLockReason: MobileCourseUnitLockReason,
): MobileCourseUnitSummary {
  return {
    id: activity.id,
    kind: "activity",
    type: normalizeActivityType(activity.activity_type),
    title: activity.title,
    description: activity.description,
    moduleId: module.id,
    moduleTitle: module.title,
    phase: normalizePhase(activity.phase),
    orderIndex: activity.order_index ?? 0,
    durationMinutes: activity.duration_minutes ?? 5,
    completed: completedActivityIds.has(activity.id),
    locked: moduleLocked,
    lockReason: moduleLocked ? moduleLockReason : null,
  };
}

function normalizeQuizOptions(options: unknown): MobileQuizOption[] {
  if (!Array.isArray(options)) return [];

  return options
    .map((option, index) => {
      if (typeof option === "string") {
        return { id: option, text: option };
      }
      const record = asRecord(option);
      const text = asString(record.text ?? record.label ?? record.value);
      const id = asString(record.id, text || `option-${index + 1}`);
      return text ? { id, text } : null;
    })
    .filter((option): option is MobileQuizOption => Boolean(option));
}

function normalizeQuizQuestions(rows: QuizQuestionRow[]): MobileQuizQuestion[] {
  return [...rows]
    .sort((left, right) => (left.sort_order ?? left.order_index ?? 0) - (right.sort_order ?? right.order_index ?? 0))
    .map((question) => {
      const type =
        question.question_type === "true_false" || question.type === "true_false"
          ? "true_false"
          : "multiple_choice";
      const fallbackOptions =
        type === "true_false"
          ? [
              { id: "true", text: "True" },
              { id: "false", text: "False" },
            ]
          : [];
      const options = normalizeQuizOptions(question.options);
      const correct = asString(question.correct_answer ?? question.correctAnswer);

      return {
        id: question.id,
        question: asString(question.question_text ?? question.question),
        type,
        options: options.length > 0 ? options : fallbackOptions,
        correctAnswer: correct,
        explanation: question.explanation ?? null,
      };
    });
}

function normalizeActivityQuizContent(content: JsonRecord): MobileQuizContent {
  const rawQuestions = Array.isArray(content.questions) ? content.questions : [];
  const questions = rawQuestions.map((item, index) => {
    const record = asRecord(item);
    const correct = asString(record.correctAnswer ?? record.correct_answer);
    return {
      id: asString(record.id, `question-${index + 1}`),
      question: asString(record.question ?? record.question_text),
      type: record.type === "true_false" ? "true_false" : "multiple_choice",
      options: normalizeQuizOptions(record.options),
      correctAnswer: correct,
      explanation: asString(record.explanation, "") || null,
    } satisfies MobileQuizQuestion;
  });

  return { questions };
}

function normalizeMatchingContent(content: JsonRecord): MobileMatchingContent {
  const pairs = Array.isArray(content.pairs) ? content.pairs : [];
  return {
    pairs: pairs.map((item, index) => {
      const record = asRecord(item);
      return {
        id: asString(record.id, `pair-${index + 1}`),
        left: asString(record.left),
        right: asString(record.right),
      };
    }),
  };
}

function normalizeFillBlankContent(content: JsonRecord): MobileFillBlankContent {
  const passages = Array.isArray(content.passages) ? content.passages : [];
  return {
    passages: passages.map((item, index) => {
      const passage = asRecord(item);
      const blanks = Array.isArray(passage.blanks) ? passage.blanks : [];
      return {
        id: asString(passage.id, `passage-${index + 1}`),
        text: asString(passage.text),
        blanks: blanks.map((blankItem, blankIndex) => {
          const blank = asRecord(blankItem);
          return {
            id: asString(blank.id, `blank-${blankIndex + 1}`),
            answer: asString(blank.answer),
            acceptedAnswers: Array.isArray(blank.acceptedAnswers)
              ? blank.acceptedAnswers.filter(
                  (answer): answer is string => typeof answer === "string",
                )
              : undefined,
            caseSensitive: blank.caseSensitive === true,
          };
        }),
      };
    }),
  };
}

function normalizeDragOrderContent(content: JsonRecord): MobileDragOrderContent {
  const items = Array.isArray(content.items) ? content.items : [];
  return {
    instruction: asString(content.instruction, "") || undefined,
    items: items.map((item, index) => {
      const record = asRecord(item);
      const order = Number(record.correctOrder ?? record.correct_order ?? index + 1);
      return {
        id: asString(record.id, `item-${index + 1}`),
        text: asString(record.text),
        correctOrder: Number.isFinite(order) ? order : index + 1,
      };
    }),
  };
}

function normalizeFlashcardContent(content: JsonRecord): MobileFlashcardContent {
  const cards = Array.isArray(content.cards) ? content.cards : [];
  return {
    cards: cards.map((item, index) => {
      const record = asRecord(item);
      return {
        id: asString(record.id, `card-${index + 1}`),
        front: asString(record.front),
        back: asString(record.back),
      };
    }),
  };
}

function normalizeQuizAnswers(responses: JsonRecord) {
  const rawAnswers = responses.answers;
  const answerByQuestion = new Map<string, string>();

  if (Array.isArray(rawAnswers)) {
    for (const rawAnswer of rawAnswers) {
      const answer = asRecord(rawAnswer);
      const questionId = asString(answer.questionId);
      const selected = asString(answer.selectedOptionId ?? answer.answer);
      if (questionId && selected) answerByQuestion.set(questionId, selected);
    }
  } else {
    for (const [key, value] of Object.entries(asRecord(rawAnswers ?? responses))) {
      if (typeof value === "string") answerByQuestion.set(key, value);
    }
  }

  return answerByQuestion;
}

async function gradeQuizSubmission(
  supabase: SupabaseClient,
  lessonId: string,
  responses: JsonRecord,
) {
  const { data, error } = await supabase.rpc(
    "grade_curriculum_quiz_submission",
    {
      p_lesson_id: lessonId,
      p_answers: Object.fromEntries(normalizeQuizAnswers(responses)),
    },
  );
  if (error) {
    throw new MobileCourseApiError(
      "Unable to grade quiz.",
      500,
      "quiz_grade_failed",
    );
  }

  const results = (data ?? []) as Array<{
    is_correct: boolean;
    points: number;
    max_points: number;
  }>;
  const score = results.reduce(
    (total, result) => total + (result.is_correct ? result.points : 0),
    0,
  );
  const maxScore = results.reduce((total, result) => total + result.max_points, 0);
  return { score, maxScore };
}

function scoreMatching(content: MobileMatchingContent, responses: JsonRecord) {
  const matches = asRecord(responses.matches);
  return {
    score: content.pairs.filter((pair) => matches[pair.id] === pair.id).length,
    maxScore: content.pairs.length,
  };
}

function scoreFillBlank(content: MobileFillBlankContent, responses: JsonRecord) {
  const answers = asRecord(responses.answers);
  const blanks = content.passages.flatMap((passage) => passage.blanks);
  const equals = (left: string, right: string, caseSensitive: boolean) =>
    caseSensitive ? left === right : left.toLowerCase() === right.toLowerCase();

  return {
    score: blanks.filter((blank) => {
      const answer = asString(answers[blank.id]).trim();
      if (!answer) return false;
      return (
        equals(answer, blank.answer, blank.caseSensitive) ||
        (blank.acceptedAnswers ?? []).some((candidate) =>
          equals(answer, candidate, blank.caseSensitive),
        )
      );
    }).length,
    maxScore: blanks.length,
  };
}

function scoreDragOrder(content: MobileDragOrderContent, responses: JsonRecord) {
  const order = Array.isArray(responses.order)
    ? responses.order.filter((item): item is string => typeof item === "string")
    : [];
  const itemById = new Map(content.items.map((item) => [item.id, item]));

  return {
    score: order.filter(
      (id, index) => itemById.get(id)?.correctOrder === index + 1,
    ).length,
    maxScore: content.items.length,
  };
}

function scoreFlashcard(content: MobileFlashcardContent, responses: JsonRecord) {
  const gotOnFirst = Number(responses.gotOnFirst ?? 0);
  return {
    score: Math.max(
      0,
      Math.min(content.cards.length, Number.isFinite(gotOnFirst) ? Math.floor(gotOnFirst) : 0),
    ),
    maxScore: content.cards.length,
  };
}

function calculateUnitXp(
  type: string,
  score: number | null,
  maxScore: number | null,
) {
  if (type === "article" || type === "video" || type === "practice" || type === "lesson") {
    return 25;
  }
  if (type === "flashcard") {
    return maxScore && maxScore > 0 && score != null
      ? Math.round((score / maxScore) * 10)
      : 5;
  }
  return maxScore && maxScore > 0 && score != null
    ? Math.round((score / maxScore) * 15)
    : 0;
}

function normalizeResponses(value: unknown) {
  const responses = asRecord(value);
  if (JSON.stringify(responses).length > 64 * 1024) {
    throw new MobileCourseApiError("Activity response is too large.", 413, "response_too_large");
  }
  return responses;
}

async function logEvent(
  supabase: SupabaseClient,
  userId: string,
  eventName: string,
  featureArea: "courses" | "activities",
  metadata: JsonRecord,
  durationMs?: number | null,
) {
  await recordAnalyticsEvent(supabase, userId, {
    eventName,
    featureArea,
    durationMs: durationMs ?? null,
    metadata,
  }).catch(() => null);
}

async function ignoreQuery(promise: PromiseLike<unknown>) {
  try {
    await promise;
  } catch {
    // Secondary analytics/activity logs should not block the student flow.
  }
}

async function getBundle(
  supabase: SupabaseClient,
  userId: string,
  slug?: string,
): Promise<Bundle> {
  let courseQuery = supabase
    .from("courses")
    .select(COURSE_SELECT)
    .eq("is_published", true)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (slug) courseQuery = courseQuery.eq("slug", slug);

  const { data: rawCourses, error } = await courseQuery;
  if (error) {
    throw new MobileCourseApiError("Unable to load courses.", 500, "courses_unavailable");
  }

  const courseRows = (rawCourses ?? []) as CourseRow[];
  const accessMap = await getCourseAccessMapFromRecords(
    supabase,
    userId,
    courseRows.map((course) => ({
      id: course.id,
      visibility: normalizeVisibility(course.visibility),
    })),
  );
  const courses = courseRows.filter((course) => accessMap.get(course.id));
  const courseIds = courses.map((course) => course.id);

  const [
    enrollmentRes,
    modulesRes,
    profileRes,
    entitlement,
  ] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("enrollments").select("*").eq("user_id", userId).in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
    courseIds.length > 0
      ? supabase.from("course_modules").select(MODULE_SELECT).in("course_id", courseIds)
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    getUserEntitlement(supabase, userId),
  ]);

  const enrollmentByCourseId = new Map(
    ((enrollmentRes.data ?? []) as JsonRecord[]).flatMap((row) => {
      const enrollment = normalizeEnrollment(row);
      return enrollment ? [[enrollment.courseId, enrollment] as const] : [];
    }),
  );
  const modules = sortModules((modulesRes.data ?? []) as ModuleRow[]);
  const modulesByCourseId = new Map<string, ModuleRow[]>();
  for (const courseModule of modules) {
    const list = modulesByCourseId.get(courseModule.course_id) ?? [];
    list.push(courseModule);
    modulesByCourseId.set(courseModule.course_id, list);
  }

  const lessonIds = modules.flatMap((module) =>
    (module.lessons ?? [])
      .filter((lesson) => lesson.is_published !== false)
      .map((lesson) => lesson.id),
  );
  const activityIds = modules.flatMap((module) =>
    (module.activities ?? [])
      .filter((activity) => activity.is_archived !== true)
      .map((activity) => activity.id),
  );

  const [lessonProgressRes, activityAttemptsRes] = await Promise.all([
    lessonIds.length > 0
      ? supabase
          .from("lesson_progress")
          .select("lesson_id, status")
          .eq("user_id", userId)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    activityIds.length > 0
      ? supabase
          .from("activity_attempts")
          .select("activity_id")
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .in("activity_id", activityIds)
      : Promise.resolve({ data: [] }),
  ]);

  const completedLessonIds = new Set(
    ((lessonProgressRes.data ?? []) as JsonRecord[])
      .filter((row) => row.status === "completed")
      .map((row) => asString(row.lesson_id)),
  );
  const completedActivityIds = new Set(
    ((activityAttemptsRes.data ?? []) as JsonRecord[]).map((row) =>
      asString(row.activity_id),
    ),
  );

  const role = asString(profileRes.data?.role);
  const courseDetails = courses.map((course) => {
    const courseModules = modulesByCourseId.get(course.id) ?? [];
    const mobileModules: MobileCourseModuleSummary[] = courseModules.map((module) => {
      const accessLevel = normalizeAccessLevel(module.access_level);
      const moduleAccessible = canAccessModuleRecord({
        role,
        accessLevel,
        entitlement,
      });
      const lockReason: MobileCourseUnitLockReason = moduleAccessible
        ? null
        : accessLevel === "premium"
          ? "premium_required"
          : "module_locked";
      const lessonUnits = (module.lessons ?? [])
        .filter((lesson) => lesson.is_published !== false)
        .map((lesson) =>
          toLessonSummary(
            lesson,
            module,
            completedLessonIds,
            !moduleAccessible,
            lockReason,
          ),
        );
      const activityUnits = (module.activities ?? [])
        .filter((activity) => activity.is_archived !== true)
        .map((activity) =>
          toActivitySummary(
            activity,
            module,
            completedActivityIds,
            !moduleAccessible,
            lockReason,
          ),
        );

      return {
        id: module.id,
        title: module.title,
        description: module.description,
        orderIndex: module.sort_order ?? 0,
        accessLevel,
        locked: !moduleAccessible,
        lockReason,
        units: [...lessonUnits, ...activityUnits].sort(
          (left, right) =>
            left.orderIndex - right.orderIndex ||
            left.kind.localeCompare(right.kind),
        ),
      };
    });
    const enrollment = enrollmentByCourseId.get(course.id) ?? null;
    const { units, completed, total } = getUnitProgressCounts(mobileModules);
    const derivedProgress = total > 0 ? clampPercent((completed / total) * 100) : 0;
    const progressPercent = Math.max(enrollment?.progressPercent ?? 0, derivedProgress);
    const status = getLibraryStatus(enrollment, progressPercent);
    const nextUnit =
      units.find((unit) => !unit.locked && !unit.completed) ??
      units.find((unit) => !unit.locked) ??
      null;
    const estimatedHours = getEstimatedHours(course.estimated_hours);
    const totalDurationMinutes = units.reduce(
      (sum, unit) => sum + unit.durationMinutes,
      0,
    );

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      shortDescription: course.short_description,
      thumbnailUrl: course.thumbnail_url,
      category: normalizeCategory(course.category),
      difficulty:
        course.difficulty === "advanced" || course.difficulty === "beginner"
          ? course.difficulty
          : "intermediate",
      estimatedHours:
        estimatedHours || (totalDurationMinutes > 0 ? totalDurationMinutes / 60 : 0),
      moduleCount: mobileModules.length,
      unitCount: total,
      completedUnitCount: completed,
      totalDurationMinutes,
      progressPercent,
      status,
      isEnrolled: Boolean(enrollment),
      visibility: normalizeVisibility(course.visibility),
      isFree: course.is_free !== false,
      nextUnit,
      enrollment,
      modules: mobileModules,
      currentUnit: nextUnit,
    } satisfies MobileCourseDetail;
  });

  return {
    courses: courseDetails,
    courseBySlug: new Map(courseDetails.map((course) => [course.slug, course])),
  };
}

async function getCourseOrThrow(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
) {
  const bundle = await getBundle(supabase, userId, slug);
  const course = bundle.courseBySlug.get(slug);
  if (!course) {
    throw new MobileCourseApiError("Course not found.", 404, "not_found");
  }
  return course;
}

function getUnitOrThrow(
  course: MobileCourseDetail,
  unitKind: MobileCourseUnitKind,
  unitId: string,
) {
  const unit = getFlatUnits(course).find(
    (candidate) => candidate.kind === unitKind && candidate.id === unitId,
  );
  if (!unit) {
    throw new MobileCourseApiError("Unit not found.", 404, "not_found");
  }
  if (unit.locked) {
    throw new MobileCourseApiError(
      unit.lockReason === "premium_required"
        ? "This unit requires premium access."
        : "This unit is locked.",
      403,
      unit.lockReason ?? "unit_locked",
    );
  }
  return unit;
}

async function buildUnitDetail(
  supabase: SupabaseClient,
  userId: string,
  course: MobileCourseDetail,
  unit: MobileCourseUnitSummary,
): Promise<MobileCourseUnitDetail> {
  const { previousUnit, nextUnit } = getAdjacentUnits(course, unit);
  let content: MobileCourseUnitContent;

  if (unit.kind === "lesson") {
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", unit.id)
      .eq("course_id", course.id)
      .maybeSingle();
    if (error || !lesson) {
      throw new MobileCourseApiError("Unit not found.", 404, "not_found");
    }
    const lessonRow = lesson as LessonRow;
    const type = normalizeLessonType(lessonRow.lesson_type ?? lessonRow.type);

    if (type === "quiz") {
      const { data: questionRows, error: questionError } = await supabase.rpc(
        "load_curriculum_quiz_questions",
        { p_lesson_id: unit.id },
      );
      if (questionError) {
        throw new MobileCourseApiError(
          "Unable to load quiz questions.",
          500,
          "quiz_load_failed",
        );
      }

      content = {
        type: "quiz",
        content: {
          questions: normalizeQuizQuestions((questionRows ?? []) as QuizQuestionRow[]),
        },
      };
    } else if (type === "practice") {
      const practiceConfig = asRecord(lessonRow.practice_config);
      content = {
        type: "practice",
        content: {
          description:
            asString(practiceConfig.description) ||
            lessonRow.content_body ||
            null,
          practiceConfig,
        },
      };
    } else {
      content = {
        type: "lesson",
        content: {
          type,
          markdown: lessonRow.content_body ?? null,
          videoUrl: lessonRow.video_url ?? null,
          videoDurationSeconds: lessonRow.video_duration_seconds ?? null,
        },
      };
    }
  } else {
    const { data: activity, error } = await supabase
      .from("activities")
      .select("*")
      .eq("id", unit.id)
      .eq("module_id", unit.moduleId)
      .maybeSingle();
    if (error || !activity) {
      throw new MobileCourseApiError("Unit not found.", 404, "not_found");
    }
    const activityRow = activity as ActivityRow;
    const activityType = normalizeActivityType(activityRow.activity_type);
    const rawContent = asRecord(activityRow.content);
    if (activityType === "quiz") {
      content = { type: "quiz", content: normalizeActivityQuizContent(rawContent) };
    } else if (activityType === "matching") {
      content = { type: "matching", content: normalizeMatchingContent(rawContent) };
    } else if (activityType === "fill_blank") {
      content = { type: "fill_blank", content: normalizeFillBlankContent(rawContent) };
    } else if (activityType === "drag_order") {
      content = { type: "drag_order", content: normalizeDragOrderContent(rawContent) };
    } else if (activityType === "flashcard") {
      content = { type: "flashcard", content: normalizeFlashcardContent(rawContent) };
    } else {
      content = {
        type: "lesson",
        content: {
          type: "article",
          markdown: asString(rawContent.body ?? rawContent.markdown ?? activityRow.description),
          videoUrl: null,
          videoDurationSeconds: null,
        },
      };
    }
  }

  return {
    ...unit,
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      progressPercent: course.progressPercent,
      isEnrolled: course.isEnrolled,
    },
    previousUnit,
    nextUnit,
    content,
  };
}

async function ensureEnrollment(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
) {
  const { data } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  const enrollment = normalizeEnrollment(data as JsonRecord | null);
  if (!enrollment) {
    throw new MobileCourseApiError("Enroll in this course first.", 409, "not_enrolled");
  }
  return enrollment;
}

async function awardXp(
  supabase: SupabaseClient,
  userId: string,
  xpEarned: number,
  minutes: number,
) {
  if (xpEarned <= 0) return;

  await supabase.rpc("increment_xp", { user_id: userId, amount: xpEarned });
  await supabase.rpc("upsert_daily_stats", {
    p_user_id: userId,
    p_sessions: 0,
    p_minutes: minutes,
    p_xp: xpEarned,
  });
}

async function recalculateCourseProgress(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
) {
  const [{ data: previousEnrollment }, { data: modules }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("status")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle(),
    supabase
      .from("course_modules")
      .select("id, lessons(id, is_published), activities(id, is_archived)")
      .eq("course_id", courseId)
      .eq("is_archived", false),
  ]);
  const moduleRows = (modules ?? []) as Array<{
    id: string;
    lessons?: Array<{ id: string; is_published?: boolean | null }>;
    activities?: Array<{ id: string; is_archived?: boolean | null }>;
  }>;
  const lessonIds = moduleRows.flatMap((module) =>
    (module.lessons ?? [])
      .filter((lesson) => lesson.is_published !== false)
      .map((lesson) => lesson.id),
  );
  const activityIds = moduleRows.flatMap((module) =>
    (module.activities ?? [])
      .filter((activity) => activity.is_archived !== true)
      .map((activity) => activity.id),
  );
  const [lessonProgressRes, activityAttemptsRes] = await Promise.all([
    lessonIds.length > 0
      ? supabase
          .from("lesson_progress")
          .select("lesson_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed")
          .in("lesson_id", lessonIds)
      : Promise.resolve({ count: 0 }),
    activityIds.length > 0
      ? supabase
          .from("activity_attempts")
          .select("activity_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .in("activity_id", activityIds)
      : Promise.resolve({ count: 0 }),
  ]);
  const total = lessonIds.length + activityIds.length;
  const completed = (lessonProgressRes.count ?? 0) + (activityAttemptsRes.count ?? 0);
  const progressPercent = total > 0 ? clampPercent((completed / total) * 100) : 0;
  const completedAt = progressPercent >= 100 ? new Date().toISOString() : null;

  await supabase
    .from("enrollments")
    .update({
      progress_percent: progressPercent,
      progress_pct: progressPercent,
      status: progressPercent >= 100 ? "completed" : "active",
      completed_at: completedAt,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("course_id", courseId);

  if (progressPercent >= 100 && previousEnrollment?.status !== "completed") {
    await ignoreQuery(supabase.from("activity_log").insert({
      user_id: userId,
      activity_type: "course_completed",
      reference_id: courseId,
      reference_type: "course",
      xp_earned: 100,
      metadata: {},
    }));
    await awardXp(supabase, userId, 100, 0).catch(() => null);
  }

  return progressPercent;
}

export async function getMobileCourseLibrary({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<MobileCourseLibraryResponse> {
  const bundle = await getBundle(supabase, userId);
  const items = bundle.courses.map((course): MobileCourseLibraryItem => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    category: course.category,
    difficulty: course.difficulty,
    estimatedHours: course.estimatedHours,
    moduleCount: course.moduleCount,
    unitCount: course.unitCount,
    completedUnitCount: course.completedUnitCount,
    totalDurationMinutes: course.totalDurationMinutes,
    progressPercent: course.progressPercent,
    status: course.status,
    isEnrolled: course.isEnrolled,
    visibility: course.visibility,
    isFree: course.isFree,
    nextUnit: course.nextUnit,
  }));
  const sortedItems = [...items].sort((left, right) => {
    const order: Record<MobileCourseLibraryStatus, number> = {
      "in-progress": 0,
      "not-started": 1,
      completed: 2,
    };
    return (
      order[left.status] - order[right.status] ||
      right.progressPercent - left.progressPercent ||
      left.title.localeCompare(right.title)
    );
  });
  const featuredCourse =
    sortedItems.find((item) => item.status === "in-progress") ??
    sortedItems.find((item) => item.status === "not-started") ??
    sortedItems[0] ??
    null;
  const recommendedCourse =
    sortedItems.find(
      (item) => item.id !== featuredCourse?.id && item.status !== "completed",
    ) ??
    sortedItems.find((item) => item.id !== featuredCourse?.id) ??
    null;

  return {
    items: sortedItems,
    featuredCourse,
    recommendedCourse,
  };
}

export async function getMobileCourseDetail({
  slug,
  supabase,
  userId,
}: {
  slug: string;
  supabase: SupabaseClient;
  userId: string;
}): Promise<MobileCourseDetail> {
  return getCourseOrThrow(supabase, userId, slug);
}

export async function getMobileCourseUnit({
  slug,
  supabase,
  unitId,
  unitKind,
  userId,
}: {
  slug: string;
  supabase: SupabaseClient;
  unitId: string;
  unitKind: MobileCourseUnitKind;
  userId: string;
}): Promise<MobileCourseUnitResponse> {
  const course = await getCourseOrThrow(supabase, userId, slug);
  const unit = getUnitOrThrow(course, unitKind, unitId);
  return {
    unit: await buildUnitDetail(supabase, userId, course, unit),
  };
}

export async function enrollMobileCourse({
  courseId,
  supabase,
  userId,
}: {
  courseId: string;
  supabase: SupabaseClient;
  userId: string;
}): Promise<MobileCourseEnrollResponse> {
  const bundle = await getBundle(supabase, userId);
  const course = bundle.courses.find((candidate) => candidate.id === courseId);
  if (!course) {
    throw new MobileCourseApiError("Course not found.", 404, "not_found");
  }

  const existing = course.enrollment;
  if (existing) {
    return { enrollment: existing, course, alreadyEnrolled: true };
  }

  const { data, error } = await supabase
    .from("enrollments")
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        status: "active",
        progress_percent: 0,
        progress_pct: 0,
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" },
    )
    .select()
    .single();

  if (error) {
    throw new MobileCourseApiError(
      "Unable to enroll in course.",
      500,
      "enrollment_failed",
    );
  }

  await ignoreQuery(supabase.from("activity_log").insert({
    user_id: userId,
    activity_type: "course_started",
    reference_id: courseId,
    reference_type: "course",
    xp_earned: 0,
    metadata: { source: "mobile" },
  }));
  await logEvent(supabase, userId, "course_started", "courses", {
    course_id: courseId,
    source: "mobile",
  });

  const refreshed = await getMobileCourseDetail({ slug: course.slug, supabase, userId });
  const enrollment = normalizeEnrollment(data as JsonRecord);
  if (!enrollment) {
    throw new MobileCourseApiError(
      "Unable to read enrollment.",
      500,
      "enrollment_failed",
    );
  }

  return { enrollment, course: refreshed, alreadyEnrolled: false };
}

export async function startMobileCourseUnit({
  slug,
  supabase,
  unitId,
  unitKind,
  userId,
}: {
  slug: string;
  supabase: SupabaseClient;
  unitId: string;
  unitKind: MobileCourseUnitKind;
  userId: string;
}): Promise<MobileCourseUnitStartResponse> {
  const course = await getCourseOrThrow(supabase, userId, slug);
  await ensureEnrollment(supabase, userId, course.id);
  const unit = getUnitOrThrow(course, unitKind, unitId);
  let attemptId: string | null = null;
  let resumed = false;

  if (unit.kind === "activity") {
    const { data: existing } = await supabase
      .from("activity_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("activity_id", unit.id)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      attemptId = existing[0].id as string;
      resumed = true;
    } else {
      const { count } = await supabase
        .from("activity_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("activity_id", unit.id);
      const { data, error } = await supabase
        .from("activity_attempts")
        .insert({
          user_id: userId,
          activity_id: unit.id,
          attempt_number: (count ?? 0) + 1,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw new MobileCourseApiError(
          "Unable to start activity.",
          500,
          "activity_start_failed",
        );
      }
      attemptId = data.id as string;
    }
  } else if (!unit.completed) {
    await ignoreQuery(
      supabase.from("lesson_progress").upsert(
        {
          user_id: userId,
          lesson_id: unit.id,
          course_id: course.id,
          status: "in_progress",
          time_spent_seconds: 0,
        },
        { onConflict: "user_id,lesson_id" },
      ),
    );
  }

  await logEvent(
    supabase,
    userId,
    unit.kind === "activity" ? "activity_started" : "module_viewed",
    unit.kind === "activity" ? "activities" : "courses",
    {
      course_id: course.id,
      unit_id: unit.id,
      unit_kind: unit.kind,
      unit_type: unit.type,
      source: "mobile",
      resumed,
    },
  );

  return {
    attemptId,
    unit: await buildUnitDetail(supabase, userId, course, unit),
    resumed,
  };
}

export async function completeMobileCourseUnit({
  body,
  slug,
  supabase,
  unitId,
  unitKind,
  userId,
}: {
  body: MobileCourseUnitCompleteRequest;
  slug: string;
  supabase: SupabaseClient;
  unitId: string;
  unitKind: MobileCourseUnitKind;
  userId: string;
}): Promise<MobileCourseUnitCompleteResponse> {
  const responses = normalizeResponses(body.responses);
  const timeSpentSeconds = Math.max(
    0,
    Math.min(
      24 * 60 * 60,
      Math.floor(Number.isFinite(body.timeSpentSeconds) ? body.timeSpentSeconds ?? 0 : 0),
    ),
  );
  const course = await getCourseOrThrow(supabase, userId, slug);
  await ensureEnrollment(supabase, userId, course.id);
  const unit = getUnitOrThrow(course, unitKind, unitId);
  let score: number | null = null;
  let maxScore: number | null = null;
  let xpEarned = 0;
  let alreadyCompleted = unit.completed;

  if (!alreadyCompleted) {
    if (unit.kind === "lesson") {
      const detail = await buildUnitDetail(supabase, userId, course, unit);
      if (detail.content.type === "quiz") {
        const result = await gradeQuizSubmission(supabase, unit.id, responses);
        score = result.maxScore > 0
          ? Math.round((result.score / result.maxScore) * 100)
          : null;
        maxScore = 100;
      }
      xpEarned = calculateUnitXp(unit.type, score, maxScore);
      const { error } = await supabase
        .from("lesson_progress")
        .upsert(
          {
            user_id: userId,
            lesson_id: unit.id,
            course_id: course.id,
            status: "completed",
            score,
            quiz_answers: responses,
            time_spent_seconds: timeSpentSeconds,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,lesson_id" },
        );
      if (error) {
        throw new MobileCourseApiError(
          "Unable to complete lesson.",
          500,
          "lesson_complete_failed",
        );
      }
      await ignoreQuery(supabase.from("activity_log").insert({
        user_id: userId,
        activity_type: "lesson_completed",
        reference_id: unit.id,
        reference_type: "lesson",
        xp_earned: xpEarned,
        metadata: { score, time_spent_seconds: timeSpentSeconds, source: "mobile" },
      }));
    } else {
      const detail = await buildUnitDetail(supabase, userId, course, unit);
      if (detail.content.type === "quiz") {
        const result = await gradeQuizSubmission(supabase, unit.id, responses);
        score = result.score;
        maxScore = result.maxScore;
      } else if (detail.content.type === "matching") {
        const result = scoreMatching(detail.content.content, responses);
        score = result.score;
        maxScore = result.maxScore;
      } else if (detail.content.type === "fill_blank") {
        const result = scoreFillBlank(detail.content.content, responses);
        score = result.score;
        maxScore = result.maxScore;
      } else if (detail.content.type === "drag_order") {
        const result = scoreDragOrder(detail.content.content, responses);
        score = result.score;
        maxScore = result.maxScore;
      } else if (detail.content.type === "flashcard") {
        const result = scoreFlashcard(detail.content.content, responses);
        score = result.score;
        maxScore = result.maxScore;
      } else {
        score = 1;
        maxScore = 1;
      }
      xpEarned = calculateUnitXp(unit.type, score, maxScore);

      let attemptId = body.attemptId ?? null;
      if (attemptId) {
        const { data: existingAttempt } = await supabase
          .from("activity_attempts")
          .select("id, completed_at, score, max_score")
          .eq("id", attemptId)
          .eq("user_id", userId)
          .eq("activity_id", unit.id)
          .maybeSingle();
        if (!existingAttempt) {
          throw new MobileCourseApiError("Activity attempt not found.", 404, "attempt_not_found");
        }
        if (existingAttempt.completed_at) {
          alreadyCompleted = true;
          score = existingAttempt.score as number | null;
          maxScore = existingAttempt.max_score as number | null;
          xpEarned = 0;
        }
      } else {
        const { data: existing } = await supabase
          .from("activity_attempts")
          .select("id")
          .eq("user_id", userId)
          .eq("activity_id", unit.id)
          .is("completed_at", null)
          .order("created_at", { ascending: false })
          .limit(1);
        attemptId = existing?.[0]?.id ?? null;
      }

      if (!alreadyCompleted) {
        if (attemptId) {
          const { error } = await supabase
            .from("activity_attempts")
            .update({
              completed_at: new Date().toISOString(),
              score,
              max_score: maxScore,
              is_passed: maxScore ? (score ?? 0) >= maxScore * 0.6 : false,
              responses,
              time_spent_seconds: timeSpentSeconds,
            })
            .eq("id", attemptId)
            .eq("user_id", userId)
            .is("completed_at", null);
          if (error) {
            throw new MobileCourseApiError(
              "Unable to complete activity.",
              500,
              "activity_complete_failed",
            );
          }
        } else {
          const { count } = await supabase
            .from("activity_attempts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("activity_id", unit.id);
          const { error } = await supabase.from("activity_attempts").insert({
            user_id: userId,
            activity_id: unit.id,
            completed_at: new Date().toISOString(),
            score,
            max_score: maxScore,
            is_passed: maxScore ? (score ?? 0) >= maxScore * 0.6 : false,
            attempt_number: (count ?? 0) + 1,
            responses,
            time_spent_seconds: timeSpentSeconds,
          });
          if (error) {
            throw new MobileCourseApiError(
              "Unable to complete activity.",
              500,
              "activity_complete_failed",
            );
          }
        }
        await ignoreQuery(supabase.from("activity_log").insert({
          user_id: userId,
          activity_type: "lesson_completed",
          reference_id: unit.id,
          reference_type: "activity",
          xp_earned: xpEarned,
          metadata: { score, maxScore, timeSpentSeconds, source: "mobile" },
        }));
      }
    }

    if (xpEarned > 0) {
      await awardXp(
        supabase,
        userId,
        xpEarned,
        Math.round(timeSpentSeconds / 60),
      );
    }
  }

  await recalculateCourseProgress(supabase, userId, course.id);
  await logEvent(
    supabase,
    userId,
    unit.kind === "activity" ? "activity_completed" : "activity_completed",
    unit.kind === "activity" ? "activities" : "courses",
    {
      course_id: course.id,
      unit_id: unit.id,
      unit_kind: unit.kind,
      unit_type: unit.type,
      score,
      max_score: maxScore,
      xp_earned: xpEarned,
      already_completed: alreadyCompleted,
      source: "mobile",
    },
    timeSpentSeconds * 1000,
  );

  const refreshedCourse = await getMobileCourseDetail({ slug, supabase, userId });
  const refreshedUnit = getUnitOrThrow(refreshedCourse, unitKind, unitId);

  return {
    unit: await buildUnitDetail(supabase, userId, refreshedCourse, refreshedUnit),
    course: refreshedCourse,
    score,
    maxScore,
    xpEarned,
    alreadyCompleted,
    nextUnit: getAdjacentUnits(refreshedCourse, refreshedUnit).nextUnit,
  };
}
