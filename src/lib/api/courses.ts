import { createClient } from "@/lib/supabase/server";
import type {
  Course,
  CourseModule,
  Lesson,
  QuizQuestion,
  Enrollment,
  LessonProgress,
} from "@/types/database";

// ── Query types ──────────────────────────────────────────────────────

export interface ActivitySummary {
  id: string;
  title: string;
  activity_type: string;
  phase: string;
  duration_minutes: number;
  order_index: number;
  completed?: boolean;
}

export interface CourseLessonSummary extends Lesson {
  progress: LessonProgress | null;
}

export interface CourseModuleSummary extends CourseModule {
  lessons: CourseLessonSummary[];
  activities?: ActivitySummary[];
}

export interface CourseWithModules extends Course {
  modules: CourseModuleSummary[];
  enrollment?: Enrollment | null;
  total_lessons: number;
  completed_lessons: number;
  total_activities: number;
}

export interface CourseReaderLessonItem {
  id: string;
  title: string;
  slug: string;
  type: Lesson["type"];
  durationMinutes: number;
  lessonNumber: number;
  moduleId: string;
  moduleTitle: string;
  completed: boolean;
  current: boolean;
  locked: boolean;
  href: string | null;
}

export interface CourseReaderAdjacentLesson {
  id: string;
  title: string;
  slug: string;
  type: Lesson["type"];
  durationMinutes: number;
  lessonNumber: number;
  moduleTitle: string;
  summary: string | null;
  href: string;
}

export interface CourseReaderData extends CourseWithModules {
  selectedLesson: LessonWithContext | null;
  selectedLessonSlug: string | null;
  lessonItems: CourseReaderLessonItem[];
  prevLesson: CourseReaderAdjacentLesson | null;
  nextLesson: CourseReaderAdjacentLesson | null;
  isPreview: boolean;
}

export type CourseCategory = "debate" | "public-speaking";
export type CourseLibraryStatus = "in-progress" | "not-started" | "completed";

export interface CourseLibraryNextLesson {
  title: string;
  slug: string;
  durationMinutes: number;
  href: string;
}

export interface CourseLibraryItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: CourseCategory;
  difficulty: Course["difficulty"];
  estimatedHours: number;
  moduleCount: number;
  lessonCount: number;
  completedLessonCount: number;
  totalDurationMinutes: number;
  progressPercent: number;
  status: CourseLibraryStatus;
  isEnrolled: boolean;
  courseHref: string;
  ctaHref: string;
  nextLesson: CourseLibraryNextLesson | null;
  artworkVariant?:
    | "lighthouse"
    | "microphone"
    | "puzzle"
    | "mountain"
    | "brain";
  isMock?: boolean;
}

export interface CourseLibraryData {
  items: CourseLibraryItem[];
  featuredCourse: CourseLibraryItem | null;
  recommendedCourse: CourseLibraryItem | null;
}

export interface LessonWithContext extends Lesson {
  module: CourseModule;
  course: Course;
  quiz_questions: QuizQuestion[];
  progress: LessonProgress | null;
  prev_lesson: { slug: string; title: string } | null;
  next_lesson: { slug: string; title: string } | null;
  moduleLessonIndex: number;
  moduleTotalLessons: number;
  moduleCompletedLessons: number;
  courseTotalLessons: number;
  courseCompletedLessons: number;
  courseProgressPercent: number;
}

type CourseModuleWithRelations = CourseModule & {
  lessons?: Lesson[];
  activities?: ActivitySummary[];
  sort_order?: number;
};

type LessonRecord = Partial<Lesson> & {
  course_id?: string;
  lesson_type?: Lesson["type"];
  content_body?: string | null;
  estimated_minutes?: number | null;
  sort_order?: number | null;
  practice_config?: Record<string, unknown> | null;
  quiz_config?: Record<string, unknown> | null;
};

type QuizQuestionRecord = Partial<QuizQuestion> & {
  sort_order?: number | null;
};

type EnrollmentRecord = Partial<Enrollment> & {
  progress_pct?: number | null;
  progress_percent?: number | null;
};

type FlatCourseLesson = {
  lesson: Lesson;
  module: CourseModule;
};

interface DevelopmentMockCourse {
  slug: string;
  title: string;
  description: string;
  category: CourseCategory;
  difficulty: Course["difficulty"];
  estimatedHours: number;
  moduleCount: number;
  lessonCount: number;
  completedLessonCount: number;
  progressPercent: number;
  status: CourseLibraryStatus;
  isEnrolled: boolean;
  artworkVariant: NonNullable<CourseLibraryItem["artworkVariant"]>;
  nextLesson?: {
    title: string;
    durationMinutes: number;
  } | null;
}

const DEVELOPMENT_LIBRARY_MOCK_COURSES: DevelopmentMockCourse[] = [
  {
    slug: "public-speaking-mastery",
    title: "Public Speaking Mastery",
    description:
      "Speak with confidence and deliver powerful, memorable speeches.",
    category: "public-speaking",
    difficulty: "beginner",
    estimatedHours: 3,
    moduleCount: 8,
    lessonCount: 10,
    completedLessonCount: 3,
    progressPercent: 30,
    status: "in-progress",
    isEnrolled: true,
    artworkVariant: "microphone",
    nextLesson: {
      title: "2. Vocal Variety and Pace",
      durationMinutes: 12,
    },
  },
  {
    slug: "logic-and-critical-thinking",
    title: "Logic & Critical Thinking",
    description:
      "Sharpen your reasoning and learn to spot strong vs. weak arguments.",
    category: "debate",
    difficulty: "beginner",
    estimatedHours: 4,
    moduleCount: 10,
    lessonCount: 10,
    completedLessonCount: 0,
    progressPercent: 0,
    status: "not-started",
    isEnrolled: false,
    artworkVariant: "puzzle",
    nextLesson: null,
  },
  {
    slug: "advanced-debate-strategies",
    title: "Advanced Debate Strategies",
    description:
      "Master advanced techniques and outsmart your opponents.",
    category: "debate",
    difficulty: "intermediate",
    estimatedHours: 5,
    moduleCount: 14,
    lessonCount: 14,
    completedLessonCount: 0,
    progressPercent: 0,
    status: "not-started",
    isEnrolled: false,
    artworkVariant: "mountain",
    nextLesson: null,
  },
  {
    slug: "rebuttals-that-win-arguments",
    title: "Rebuttals That Win Arguments",
    description:
      "Learn how to dismantle opposing arguments and present effective rebuttals.",
    category: "debate",
    difficulty: "intermediate",
    estimatedHours: 4,
    moduleCount: 9,
    lessonCount: 9,
    completedLessonCount: 0,
    progressPercent: 0,
    status: "not-started",
    isEnrolled: false,
    artworkVariant: "brain",
    nextLesson: null,
  },
];

const MIN_LIBRARY_ITEM_COUNT = 5;
const DEVELOPMENT_RECOMMENDED_COURSE_SLUG = "rebuttals-that-win-arguments";

function clampPercent(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function normalizeCourseCategory(category: string | null | undefined): CourseCategory {
  const normalized = (category ?? "debate").trim().toLowerCase().replace(/_/g, "-");
  return normalized === "public-speaking" ? "public-speaking" : "debate";
}

function normalizeCourseRecord<T extends Course>(course: T): T {
  return {
    ...course,
    category: normalizeCourseCategory(course.category),
  };
}

function normalizeEnrollment(enrollment: EnrollmentRecord | null | undefined): Enrollment | null {
  if (!enrollment) return null;

  return {
    ...(enrollment as Enrollment),
    progress_percent:
      typeof enrollment.progress_percent === "number"
        ? enrollment.progress_percent
        : typeof enrollment.progress_pct === "number"
          ? enrollment.progress_pct
          : 0,
  };
}

function getModuleSortOrder(module: CourseModuleWithRelations) {
  return typeof module.sort_order === "number"
    ? module.sort_order
    : typeof module.order_index === "number"
      ? module.order_index
      : 0;
}

function normalizeLessonRecord(lesson: LessonRecord): Lesson {
  const lessonType = lesson.type ?? lesson.lesson_type ?? "article";
  const content =
    lesson.content ??
    (lessonType === "article"
      ? { markdown: lesson.content_body ?? "" }
      : lessonType === "practice"
        ? {
            description:
              (lesson.practice_config?.description as string | undefined) ??
              lesson.content_body ??
              undefined,
            practice_config: lesson.practice_config ?? {},
          }
        : lessonType === "video"
          ? { description: lesson.content_body ?? "", notes: "" }
          : lesson.quiz_config ?? {});

  return {
    ...(lesson as Lesson),
    type: lessonType,
    content,
    video_url: lesson.video_url ?? null,
    duration_minutes:
      typeof lesson.duration_minutes === "number"
        ? lesson.duration_minutes
        : typeof lesson.estimated_minutes === "number"
          ? lesson.estimated_minutes
          : 10,
    order_index:
      typeof lesson.order_index === "number"
        ? lesson.order_index
        : typeof lesson.sort_order === "number"
          ? lesson.sort_order
          : 0,
  };
}

function normalizeQuizQuestionRecord(question: QuizQuestionRecord): QuizQuestion {
  return {
    ...(question as QuizQuestion),
    options: Array.isArray(question.options) ? question.options : null,
    order_index:
      typeof question.order_index === "number"
        ? question.order_index
        : typeof question.sort_order === "number"
          ? question.sort_order
          : 0,
  };
}

function sortModules(modules: CourseModuleWithRelations[]) {
  return [...modules]
    .sort((left, right) => getModuleSortOrder(left) - getModuleSortOrder(right))
    .map((courseModule) => {
      const normalizedLessons = (courseModule.lessons ?? []).map((lesson) =>
        normalizeLessonRecord(lesson as LessonRecord)
      );

      return {
        ...courseModule,
        order_index: getModuleSortOrder(courseModule),
        lessons: normalizedLessons.sort(
          (left, right) => left.order_index - right.order_index
        ),
        activities: [...(courseModule.activities ?? [])].sort(
          (left, right) => left.order_index - right.order_index
        ),
      };
    });
}

function extractFirstMarkdownParagraph(markdown: string) {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((section) =>
      section
        .replace(/^#+\s+/gm, "")
        .replace(/^[-*]\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/\*\*/g, "")
        .trim()
    )
    .filter((section) => section.length > 32);

  return paragraphs[0] ?? null;
}

function summarizeLessonContent(
  lesson: Pick<Lesson, "type" | "content">
) {
  if (lesson.type === "article") {
    const markdown = (lesson.content as { markdown?: string }).markdown ?? "";
    return extractFirstMarkdownParagraph(markdown);
  }

  if (lesson.type === "video") {
    return (lesson.content as { description?: string }).description ?? null;
  }

  if (lesson.type === "practice") {
    const content = lesson.content as {
      description?: string;
      practice_config?: { description?: string };
    };

    return content.practice_config?.description ?? content.description ?? null;
  }

  return null;
}

function shouldIncludeDevelopmentCourseLibraryMocks() {
  return process.env.NODE_ENV !== "production";
}

function createDevelopmentCourseLibraryItems(
  existingItems: CourseLibraryItem[]
) {
  const existingSlugs = new Set(existingItems.map((item) => item.slug));
  const remainingSlots = Math.max(MIN_LIBRARY_ITEM_COUNT - existingItems.length, 0);

  return DEVELOPMENT_LIBRARY_MOCK_COURSES.filter(
    (course) => !existingSlugs.has(course.slug)
  )
    .slice(0, remainingSlots)
    .map((course) => {
      const courseHref = `/courses/${course.slug}`;

      return {
        id: `mock-${course.slug}`,
        slug: course.slug,
        title: course.title,
        description: course.description,
        thumbnailUrl: null,
        category: course.category,
        difficulty: course.difficulty,
        estimatedHours: course.estimatedHours,
        moduleCount: course.moduleCount,
        lessonCount: course.lessonCount,
        completedLessonCount: course.completedLessonCount,
        totalDurationMinutes: course.estimatedHours * 60,
        progressPercent: course.progressPercent,
        status: course.status,
        isEnrolled: course.isEnrolled,
        courseHref,
        ctaHref: courseHref,
        nextLesson: course.nextLesson
          ? {
              ...course.nextLesson,
              slug: course.nextLesson.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, ""),
              href: courseHref,
            }
          : null,
        artworkVariant: course.artworkVariant,
        isMock: true,
      } satisfies CourseLibraryItem;
    });
}

function buildCourseLessonHref(courseSlug: string, lessonSlug: string) {
  return `/courses/${courseSlug}?lesson=${encodeURIComponent(lessonSlug)}`;
}

// ── Courses ──────────────────────────────────────────────────────────

export async function getCourses(userId?: string) {
  const supabase = await createClient();

  if (!userId) {
    const { data: courses, error } = await supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at");

    if (error) {
      return { courses: [], enrollments: [] };
    }
    return {
      courses: (courses ?? []).map((course) =>
        normalizeCourseRecord(course as Course)
      ),
      enrollments: [],
    };
  }

  // Fetch courses and enrollments in parallel
  const [coursesRes, enrollmentsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at"),
    supabase
      .from("enrollments")
      .select("*")
      .eq("user_id", userId),
  ]);

  if (coursesRes.error) {
    return { courses: [], enrollments: [] };
  }

  return {
    courses: (coursesRes.data ?? []).map((course) =>
      normalizeCourseRecord(course as Course)
    ),
    enrollments: (enrollmentsRes.data ?? []).flatMap((enrollment) => {
      const normalized = normalizeEnrollment(enrollment as EnrollmentRecord);
      return normalized ? [normalized] : [];
    }),
  };
}

export async function getCourseLibraryData(
  userId: string
): Promise<CourseLibraryData> {
  const supabase = await createClient();

  const [coursesRes, enrollmentsRes, modulesRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("created_at"),
    supabase.from("enrollments").select("*").eq("user_id", userId),
    supabase
      .from("course_modules")
      .select("*, lessons(*)")
      .order("sort_order"),
  ]);

  if (coursesRes.error) {
    return { items: [], featuredCourse: null, recommendedCourse: null };
  }

  const courses = (coursesRes.data ?? []).map((course) =>
    normalizeCourseRecord(course as Course)
  );
  const enrollments = new Map(
    (enrollmentsRes.data ?? []).flatMap((enrollment) => {
      const normalized = normalizeEnrollment(enrollment as EnrollmentRecord);
      return normalized ? [[normalized.course_id, normalized] as const] : [];
    })
  );
  const modules = sortModules((modulesRes.data ?? []) as CourseModuleWithRelations[]);
  const modulesByCourseId = new Map<string, CourseModuleWithRelations[]>();

  for (const courseModule of modules) {
    const moduleList = modulesByCourseId.get(courseModule.course_id) ?? [];
    moduleList.push(courseModule);
    modulesByCourseId.set(courseModule.course_id, moduleList);
  }

  const lessonIds = modules.flatMap((courseModule) =>
    (courseModule.lessons ?? []).map((lesson) => lesson.id)
  );
  const lessonProgressById = new Map<string, LessonProgress>();

  if (lessonIds.length > 0) {
    const { data: lessonProgressRows } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds);

    for (const row of lessonProgressRows ?? []) {
      lessonProgressById.set(row.lesson_id, row as LessonProgress);
    }
  }

  const libraryItems = courses.map((course) => {
    const courseModules = modulesByCourseId.get(course.id) ?? [];
    const lessons = courseModules.flatMap((courseModule) =>
      (courseModule.lessons ?? []).filter((lesson) => lesson.is_published !== false)
    );
    const enrollment = enrollments.get(course.id) ?? null;
    const completedLessonCount = lessons.filter(
      (lesson) => lessonProgressById.get(lesson.id)?.status === "completed"
    ).length;
    const derivedProgressPercent =
      lessons.length > 0
        ? clampPercent((completedLessonCount / lessons.length) * 100)
        : 0;
    const progressPercent = enrollment
      ? Math.max(
          clampPercent(enrollment.progress_percent),
          derivedProgressPercent
        )
      : 0;
    const courseHref = `/courses/${course.slug}`;
    const status: CourseLibraryStatus = enrollment
      ? enrollment.status === "completed" || progressPercent >= 100
        ? "completed"
        : "in-progress"
      : "not-started";
    const nextLessonRecord =
      status === "completed"
        ? null
        : lessons.find(
            (lesson) => lessonProgressById.get(lesson.id)?.status !== "completed"
          ) ??
          lessons[0] ??
          null;
    const nextLesson = nextLessonRecord
      ? {
          title: nextLessonRecord.title,
          slug: nextLessonRecord.slug,
          durationMinutes: nextLessonRecord.duration_minutes,
          href: buildCourseLessonHref(course.slug, nextLessonRecord.slug),
        }
      : null;
    const totalDurationMinutes = lessons.reduce(
      (sum, lesson) => sum + lesson.duration_minutes,
      0
    );

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnail_url,
      category: normalizeCourseCategory(course.category),
      difficulty: course.difficulty,
      estimatedHours: course.estimated_hours,
      moduleCount: courseModules.length,
      lessonCount: lessons.length,
      completedLessonCount,
      totalDurationMinutes,
      progressPercent,
      status,
      isEnrolled: !!enrollment,
      courseHref,
      ctaHref:
        enrollment && nextLesson ? nextLesson.href : courseHref,
      nextLesson,
    } satisfies CourseLibraryItem;
  });

  const sortedItems = [...libraryItems].sort((left, right) => {
    const statusOrder = {
      "in-progress": 0,
      "not-started": 1,
      completed: 2,
    } satisfies Record<CourseLibraryStatus, number>;

    return (
      statusOrder[left.status] - statusOrder[right.status] ||
      (right.progressPercent - left.progressPercent) ||
      left.title.localeCompare(right.title)
    );
  });

  const featuredCourse =
    sortedItems.find((item) => item.status === "in-progress") ??
    sortedItems.find((item) => item.status === "not-started") ??
    sortedItems[0] ??
    null;
  let recommendedCourse = featuredCourse
    ? sortedItems.find(
        (item) => item.id !== featuredCourse.id && item.status === "not-started"
      ) ??
      [...sortedItems]
        .filter((item) => item.id !== featuredCourse.id)
        .sort(
          (left, right) =>
            left.progressPercent - right.progressPercent ||
            left.title.localeCompare(right.title)
        )[0] ??
      null
    : null;

  const items =
    shouldIncludeDevelopmentCourseLibraryMocks()
      ? [...sortedItems, ...createDevelopmentCourseLibraryItems(sortedItems)]
      : sortedItems;

  if (shouldIncludeDevelopmentCourseLibraryMocks()) {
    recommendedCourse =
      items.find((item) => item.slug === DEVELOPMENT_RECOMMENDED_COURSE_SLUG) ??
      recommendedCourse;
  }

  return {
    items,
    featuredCourse,
    recommendedCourse,
  };
}

export async function getCourseBySlug(
  slug: string,
  userId?: string
): Promise<CourseWithModules | null> {
  const supabase = await createClient();

  // Fetch course
  const { data: course, error } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error || !course) return null;
  const normalizedCourse = normalizeCourseRecord(course as Course);

  // Fetch modules (with lessons AND activities) and enrollment in parallel
  const [modulesRes, enrollmentRes] = await Promise.all([
    supabase
      .from("course_modules")
      .select("*, lessons(*), activities(id, title, activity_type, phase, duration_minutes, order_index)")
      .eq("course_id", course.id)
      .order("sort_order"),
    userId
      ? supabase
          .from("enrollments")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", course.id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  // Sort lessons and activities within each module
  const sortedModules = sortModules(
    (modulesRes.data ?? []) as CourseModuleWithRelations[]
  );

  // Count total lessons + activities
  const totalLessons = sortedModules.reduce(
    (sum: number, m: { lessons: Lesson[] }) => sum + m.lessons.length,
    0
  );
  const totalActivities = sortedModules.reduce(
    (sum: number, m: { activities?: ActivitySummary[] }) => sum + (m.activities ?? []).length,
    0
  );

  const enrollment = normalizeEnrollment(enrollmentRes.data as EnrollmentRecord | null);
  let completedLessons = 0;
  let modulesWithProgress: CourseModuleSummary[] = sortedModules.map(
    (courseModule) => ({
      ...courseModule,
      lessons: courseModule.lessons.map((lesson) => ({
        ...lesson,
        progress: null,
      })),
    })
  );

  if (enrollment) {
    const allLessonIds = sortedModules.flatMap((m: { lessons: Lesson[] }) =>
      m.lessons.map((l: Lesson) => l.id)
    );
    const allActivityIds = sortedModules.flatMap(
      (m: { activities?: ActivitySummary[] }) => (m.activities ?? []).map((a) => a.id)
    );

    if (allLessonIds.length > 0) {
      const { data: progressRows, count } = await supabase
        .from("lesson_progress")
        .select("*", { count: "exact" })
        .eq("user_id", userId!)
        .in("lesson_id", allLessonIds);

      const progressByLessonId = new Map(
        (progressRows ?? []).map((progress) => [progress.lesson_id, progress])
      );

      completedLessons =
        progressRows?.filter((progress) => progress.status === "completed")
          .length ?? count ?? 0;

      modulesWithProgress = sortedModules.map((courseModule) => ({
        ...courseModule,
        lessons: courseModule.lessons.map((lesson) => ({
          ...lesson,
          progress: progressByLessonId.get(lesson.id) ?? null,
        })),
      }));
    }

    if (allActivityIds.length > 0) {
      const { data: activityAttempts } = await supabase
        .from("activity_attempts")
        .select("activity_id")
        .eq("user_id", userId!)
        .not("completed_at", "is", null)
        .in("activity_id", allActivityIds);

      const completedActivityIds = new Set(
        (activityAttempts ?? []).map((attempt) => attempt.activity_id)
      );

      modulesWithProgress = modulesWithProgress.map((courseModule) => ({
        ...courseModule,
        activities: (courseModule.activities ?? []).map((activity) => ({
          ...activity,
          completed: completedActivityIds.has(activity.id),
        })),
      }));
    }
  }

  return {
    ...normalizedCourse,
    modules: modulesWithProgress,
    enrollment,
    total_lessons: totalLessons,
    completed_lessons: completedLessons,
    total_activities: totalActivities,
  };
}

export async function getCourseReaderBySlug(
  slug: string,
  userId?: string,
  selectedLessonSlug?: string | null
): Promise<CourseReaderData | null> {
  const supabase = await createClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error || !course) return null;
  const normalizedCourse = normalizeCourseRecord(course as Course);

  const [modulesRes, enrollmentRes] = await Promise.all([
    supabase
      .from("course_modules")
      .select("*, lessons(*)")
      .eq("course_id", course.id)
      .order("sort_order"),
    userId
      ? supabase
          .from("enrollments")
          .select("*")
          .eq("user_id", userId)
          .eq("course_id", course.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sortedModules = sortModules(
    (modulesRes.data ?? []) as CourseModuleWithRelations[]
  );
  const modulesWithPublishedLessons = sortedModules.map((module) => ({
    ...module,
    lessons: (module.lessons ?? []).filter((lesson) => lesson.is_published !== false),
  }));
  const flatLessons: FlatCourseLesson[] = modulesWithPublishedLessons.flatMap((module) =>
    module.lessons.map((lesson) => ({
      lesson,
      module,
    }))
  );
  const allLessonIds = flatLessons.map((entry) => entry.lesson.id);
  const enrollment = normalizeEnrollment(
    enrollmentRes.data as EnrollmentRecord | null
  );
  const progressByLessonId = new Map<string, LessonProgress>();

  if (userId && allLessonIds.length > 0) {
    const { data: progressRows } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .in("lesson_id", allLessonIds);

    for (const progress of progressRows ?? []) {
      progressByLessonId.set(progress.lesson_id, progress as LessonProgress);
    }
  }

  const completedLessons = flatLessons.filter(
    (entry) => progressByLessonId.get(entry.lesson.id)?.status === "completed"
  ).length;
  const totalLessons = flatLessons.length;
  const courseProgressPercent =
    totalLessons > 0
      ? clampPercent((completedLessons / totalLessons) * 100)
      : 0;
  const resolvedEnrollment =
    enrollment && totalLessons > 0
      ? {
          ...enrollment,
          progress_percent: Math.max(
            clampPercent(enrollment.progress_percent),
            courseProgressPercent
          ),
        }
      : enrollment;
  const firstIncompleteIndex = flatLessons.findIndex(
    (entry) => progressByLessonId.get(entry.lesson.id)?.status !== "completed"
  );
  const fallbackIndex =
    firstIncompleteIndex >= 0
      ? firstIncompleteIndex
      : flatLessons.length > 0
        ? 0
        : -1;
  const paramIndex = selectedLessonSlug
    ? flatLessons.findIndex((entry) => entry.lesson.slug === selectedLessonSlug)
    : -1;
  const selectedIndex =
    paramIndex >= 0
      ? paramIndex
      : fallbackIndex;
  const activeIndex =
    firstIncompleteIndex >= 0
      ? firstIncompleteIndex
      : flatLessons.length - 1;

  const modulesWithProgress: CourseModuleSummary[] = modulesWithPublishedLessons.map(
    (module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        progress: progressByLessonId.get(lesson.id) ?? null,
      })),
      activities: [],
    })
  );

  const lessonItems: CourseReaderLessonItem[] = flatLessons.map((entry, index) => {
    const completed =
      progressByLessonId.get(entry.lesson.id)?.status === "completed";
    const current = index === selectedIndex;
    const locked = resolvedEnrollment
      ? index > activeIndex && !current
      : !current;

    return {
      id: entry.lesson.id,
      title: entry.lesson.title,
      slug: entry.lesson.slug,
      type: entry.lesson.type,
      durationMinutes: entry.lesson.duration_minutes,
      lessonNumber: index + 1,
      moduleId: entry.module.id,
      moduleTitle: entry.module.title,
      completed,
      current,
      locked,
      href:
        resolvedEnrollment && !locked
          ? buildCourseLessonHref(normalizedCourse.slug, entry.lesson.slug)
          : null,
    };
  });

  const selectedEntry =
    selectedIndex >= 0 ? flatLessons[selectedIndex] : null;
  const prevEntry = selectedIndex > 0 ? flatLessons[selectedIndex - 1] : null;
  const nextEntry =
    selectedIndex >= 0 && selectedIndex < flatLessons.length - 1
      ? flatLessons[selectedIndex + 1]
      : null;

  let selectedLesson: LessonWithContext | null = null;

  if (selectedEntry) {
    let quizQuestions: QuizQuestion[] = [];

    if (selectedEntry.lesson.type === "quiz") {
      const { data } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("lesson_id", selectedEntry.lesson.id)
        .order("sort_order");

      quizQuestions = (data ?? []).map((question) =>
        normalizeQuizQuestionRecord(question as QuizQuestionRecord)
      );
    }

    const moduleLessons = flatLessons.filter(
      (entry) => entry.module.id === selectedEntry.module.id
    );
    const moduleCompletedLessons = moduleLessons.filter(
      (entry) => progressByLessonId.get(entry.lesson.id)?.status === "completed"
    ).length;

    selectedLesson = {
      ...selectedEntry.lesson,
      module: selectedEntry.module,
      course: normalizedCourse,
      quiz_questions: quizQuestions,
      progress: progressByLessonId.get(selectedEntry.lesson.id) ?? null,
      prev_lesson: prevEntry
        ? { slug: prevEntry.lesson.slug, title: prevEntry.lesson.title }
        : null,
      next_lesson: nextEntry
        ? { slug: nextEntry.lesson.slug, title: nextEntry.lesson.title }
        : null,
      moduleLessonIndex:
        moduleLessons.findIndex(
          (entry) => entry.lesson.id === selectedEntry.lesson.id
        ) + 1,
      moduleTotalLessons: moduleLessons.length,
      moduleCompletedLessons,
      courseTotalLessons: totalLessons,
      courseCompletedLessons: completedLessons,
      courseProgressPercent:
        resolvedEnrollment?.progress_percent ?? courseProgressPercent,
    };
  }

  const toAdjacentLesson = (
    entry: FlatCourseLesson | null,
    index: number
  ): CourseReaderAdjacentLesson | null =>
    entry
      ? {
          id: entry.lesson.id,
          title: entry.lesson.title,
          slug: entry.lesson.slug,
          type: entry.lesson.type,
          durationMinutes: entry.lesson.duration_minutes,
          lessonNumber: index + 1,
          moduleTitle: entry.module.title,
          summary: summarizeLessonContent(entry.lesson),
          href: buildCourseLessonHref(normalizedCourse.slug, entry.lesson.slug),
        }
      : null;

  return {
    ...normalizedCourse,
    modules: modulesWithProgress,
    enrollment: resolvedEnrollment,
    total_lessons: totalLessons,
    completed_lessons: completedLessons,
    total_activities: 0,
    selectedLesson,
    selectedLessonSlug: selectedLesson?.slug ?? null,
    lessonItems,
    prevLesson: toAdjacentLesson(prevEntry, selectedIndex - 1),
    nextLesson: toAdjacentLesson(nextEntry, selectedIndex + 1),
    isPreview: !resolvedEnrollment,
  };
}

export async function getLessonBySlug(
  courseSlug: string,
  lessonSlug: string,
  userId?: string
): Promise<LessonWithContext | null> {
  const supabase = await createClient();

  // First get the course
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", courseSlug)
    .single();

  if (!course) return null;
  const normalizedCourse = normalizeCourseRecord(course as Course);

  // Get all modules and lessons for this course (for navigation)
  const { data: modules } = await supabase
    .from("course_modules")
    .select("*, lessons(*)")
    .eq("course_id", course.id)
    .order("sort_order");

  if (!modules) return null;
  const sortedModules = sortModules(
    modules as CourseModuleWithRelations[]
  );

  // Flatten and sort all lessons
  const allLessons: { lesson: Lesson; courseModule: CourseModule }[] = [];
  for (const courseModule of sortedModules) {
    for (const lesson of courseModule.lessons) {
      allLessons.push({ lesson, courseModule });
    }
  }

  // Find the target lesson
  const idx = allLessons.findIndex((l) => l.lesson.slug === lessonSlug);
  if (idx === -1) return null;

  const { lesson, courseModule } = allLessons[idx];

  // Get quiz questions if quiz type
  let quizQuestions: QuizQuestion[] = [];
  if (lesson.type === "quiz") {
    const { data } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("lesson_id", lesson.id)
      .order("sort_order");
    quizQuestions = (data ?? []).map((question) =>
      normalizeQuizQuestionRecord(question as QuizQuestionRecord)
    );
  }

  // Get progress if logged in
  let progress: LessonProgress | null = null;
  if (userId) {
    const { data } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id)
      .single();
    progress = data;
  }

  const moduleLessons = allLessons.filter(
    (entry) => entry.courseModule.id === courseModule.id
  );
  const moduleLessonIndex =
    moduleLessons.findIndex((entry) => entry.lesson.id === lesson.id) + 1;
  const moduleTotalLessons = moduleLessons.length;

  let courseCompletedLessons = 0;
  let moduleCompletedLessons = 0;

  if (userId) {
    const allLessonIds = allLessons.map((entry) => entry.lesson.id);

    if (allLessonIds.length > 0) {
      const { data: completedProgress } = await supabase
        .from("lesson_progress")
        .select("lesson_id, status")
        .eq("user_id", userId)
        .eq("status", "completed")
        .in("lesson_id", allLessonIds);

      const completedLessonIds = new Set(
        (completedProgress ?? []).map((entry) => entry.lesson_id)
      );

      courseCompletedLessons = completedLessonIds.size;
      moduleCompletedLessons = moduleLessons.filter((entry) =>
        completedLessonIds.has(entry.lesson.id)
      ).length;
    }
  }

  const courseTotalLessons = allLessons.length;
  const courseProgressPercent =
    courseTotalLessons > 0
      ? Math.round((courseCompletedLessons / courseTotalLessons) * 100)
      : 0;

  // Build prev/next
  const prev = idx > 0 ? allLessons[idx - 1] : null;
  const next = idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

  return {
    ...lesson,
    module: courseModule,
    course: normalizedCourse,
    quiz_questions: quizQuestions,
    progress,
    prev_lesson: prev
      ? { slug: prev.lesson.slug, title: prev.lesson.title }
      : null,
    next_lesson: next
      ? { slug: next.lesson.slug, title: next.lesson.title }
      : null,
    moduleLessonIndex,
    moduleTotalLessons,
    moduleCompletedLessons,
    courseTotalLessons,
    courseCompletedLessons,
    courseProgressPercent,
  };
}

// ── Enrollment ───────────────────────────────────────────────────────

export async function enrollInCourse(userId: string, courseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enrollments")
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        status: "active",
        progress_percent: 0,
      },
      { onConflict: "user_id,course_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Log activity
  await supabase.from("activity_log").insert({
    user_id: userId,
    activity_type: "course_started",
    reference_id: courseId,
    reference_type: "course",
    xp_earned: 0,
    metadata: {},
  });

  return data;
}

// ── Lesson progress ──────────────────────────────────────────────────

export async function markLessonComplete(
  userId: string,
  lessonId: string,
  courseId: string,
  score?: number,
  timeSpentSeconds?: number
) {
  const supabase = await createClient();

  // Upsert lesson progress
  const { error: progressError } = await supabase
    .from("lesson_progress")
    .upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        status: "completed",
        score: score ?? null,
        time_spent_seconds: timeSpentSeconds ?? 0,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" }
    );

  if (progressError) throw new Error(progressError.message);

  // Calculate XP (25 base + up to 25 bonus for score)
  const xpEarned = score != null ? 25 + Math.round((score / 100) * 25) : 25;

  // Log activity
  await supabase.from("activity_log").insert({
    user_id: userId,
    activity_type: "lesson_completed",
    reference_id: lessonId,
    reference_type: "lesson",
    xp_earned: xpEarned,
    metadata: { score, time_spent_seconds: timeSpentSeconds },
  });

  // Award XP atomically via RPC
  await supabase.rpc("increment_xp", { user_id: userId, amount: xpEarned });

  // Update daily stats atomically via RPC
  await supabase.rpc("upsert_daily_stats", {
    p_user_id: userId,
    p_sessions: 0,
    p_minutes: 0,
    p_xp: xpEarned,
  });

  // Recalculate course enrollment progress
  await recalculateCourseProgress(userId, courseId);

  return { xpEarned };
}

async function recalculateCourseProgress(userId: string, courseId: string) {
  const supabase = await createClient();

  // Get all lessons for this course
  const { data: modules } = await supabase
    .from("course_modules")
    .select("id, lessons(id)")
    .eq("course_id", courseId);

  const allLessonIds = (modules ?? []).flatMap(
    (m: { lessons: { id: string }[] }) => m.lessons.map((l) => l.id)
  );

  if (allLessonIds.length === 0) return;

  // Count completed
  const { count } = await supabase
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("lesson_id", allLessonIds);

  const progress = Math.round(((count ?? 0) / allLessonIds.length) * 100);

  const updateData: { progress_percent: number; status?: string; completed_at?: string } = {
    progress_percent: progress,
  };

  if (progress >= 100) {
    updateData.status = "completed";
    updateData.completed_at = new Date().toISOString();
  }

  await supabase
    .from("enrollments")
    .update(updateData)
    .eq("user_id", userId)
    .eq("course_id", courseId);

  // Log course completion
  if (progress >= 100) {
    await supabase.from("activity_log").insert({
      user_id: userId,
      activity_type: "course_completed",
      reference_id: courseId,
      reference_type: "course",
      xp_earned: 100,
      metadata: {},
    });

    // Award course completion XP atomically
    await supabase.rpc("increment_xp", { user_id: userId, amount: 100 });
  }
}

export async function getLessonProgress(userId: string, lessonIds: string[]) {
  if (lessonIds.length === 0) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("lesson_progress")
    .select("id, user_id, lesson_id, status, score, time_spent_seconds, completed_at")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);

  return data ?? [];
}
