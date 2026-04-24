import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_MOCK_COURSES, type SeedCourse } from "./library-mock-courses";

type SeedableSupabaseClient = SupabaseClient;

export interface SeedLibraryMockCoursesOptions {
  createdBy?: string | null;
  userId?: string | null;
  logger?: Pick<Console, "log" | "warn">;
}

export interface SeedLibraryMockCoursesResult {
  createdCourseSlugs: string[];
  updatedCourseSlugs: string[];
  enrollmentBootstrapped: boolean;
}

export async function seedLibraryMockCourses(
  supabase: SeedableSupabaseClient,
  options: SeedLibraryMockCoursesOptions = {}
): Promise<SeedLibraryMockCoursesResult> {
  const logger = options.logger;
  const existingCourseRows = await supabase
    .from("courses")
    .select("id, slug")
    .in(
      "slug",
      LIBRARY_MOCK_COURSES.map((course) => course.slug)
    );

  if (existingCourseRows.error) {
    throw new Error(existingCourseRows.error.message);
  }

  const existingCoursesBySlug = new Map(
    (existingCourseRows.data ?? []).map((course) => [course.slug, course.id] as const)
  );
  const createdCourseSlugs: string[] = [];
  const updatedCourseSlugs: string[] = [];
  const lessonIdsByCourseSlug = new Map<string, string[]>();
  const courseIdsBySlug = new Map<string, string>();

  for (const [courseIndex, course] of LIBRARY_MOCK_COURSES.entries()) {
    const courseId = await upsertCourse(supabase, course, {
      createdBy: options.createdBy ?? null,
      existingCourseId: existingCoursesBySlug.get(course.slug) ?? null,
      sortOrder: courseIndex + 1,
    });

    courseIdsBySlug.set(course.slug, courseId);

    if (existingCoursesBySlug.has(course.slug)) {
      updatedCourseSlugs.push(course.slug);
      logger?.log(`Updated mock course "${course.title}"`);
    } else {
      createdCourseSlugs.push(course.slug);
      logger?.log(`Created mock course "${course.title}"`);
    }

    const existingModulesRes = await supabase
      .from("course_modules")
      .select("id, title, sort_order")
      .eq("course_id", courseId);

    if (existingModulesRes.error) {
      throw new Error(existingModulesRes.error.message);
    }

    const existingModules = existingModulesRes.data ?? [];
    const lessonIds: string[] = [];

    for (const courseModule of course.modules) {
      const existingModule =
        existingModules.find((entry) => entry.sort_order === courseModule.order_index) ??
        existingModules.find((entry) => entry.title === courseModule.title) ??
        null;

      const moduleId = await upsertModule(
        supabase,
        courseId,
        courseModule,
        existingModule?.id ?? null
      );
      const existingLessonsRes = await supabase
        .from("lessons")
        .select("id, slug")
        .eq("module_id", moduleId);

      if (existingLessonsRes.error) {
        throw new Error(existingLessonsRes.error.message);
      }

      const existingLessons = existingLessonsRes.data ?? [];

      for (const lesson of courseModule.lessons) {
        const existingLesson =
          existingLessons.find((entry) => entry.slug === lesson.slug) ?? null;
        const lessonId = await upsertLesson(
          supabase,
          moduleId,
          lesson,
          existingLesson?.id ?? null
        );

        lessonIds.push(lessonId);
      }
    }

    lessonIdsByCourseSlug.set(course.slug, lessonIds);
  }

  const enrollmentBootstrapped = options.userId
    ? await bootstrapLibraryDemoProgress(supabase, {
        userId: options.userId,
        courseIdsBySlug,
        lessonIdsByCourseSlug,
      })
    : false;

  return {
    createdCourseSlugs,
    updatedCourseSlugs,
    enrollmentBootstrapped,
  };
}

async function upsertCourse(
  supabase: SeedableSupabaseClient,
  course: SeedCourse,
  options: {
    createdBy: string | null;
    existingCourseId: string | null;
    sortOrder: number;
  }
) {
  const payload = {
    title: course.title,
    slug: course.slug,
    description: course.description,
    short_description: course.description,
    category: course.category,
    difficulty: course.difficulty,
    estimated_hours: course.estimated_hours,
    is_published: course.is_published,
    is_free: true,
    sort_order: options.sortOrder,
    visibility: "public",
    is_archived: false,
    tags: [],
    metadata: {
      dev_mock: true,
      seeded_for: "course-library",
    },
  };

  if (options.existingCourseId) {
    const { data, error } = await supabase
      .from("courses")
      .update(payload)
      .eq("id", options.existingCourseId)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to update course "${course.title}": ${error.message}`);
    }

    return data.id as string;
  }

  const { data, error } = await supabase
    .from("courses")
    .insert({
      ...payload,
      ...(options.createdBy ? { created_by: options.createdBy } : {}),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create course "${course.title}": ${error.message}`);
  }

  return data.id as string;
}

async function upsertModule(
  supabase: SeedableSupabaseClient,
  courseId: string,
  module: SeedCourse["modules"][number],
  existingModuleId: string | null
) {
  const payload = {
    course_id: courseId,
    title: module.title,
    description: module.description,
    sort_order: module.order_index,
    access_level: module.order_index === 0 ? "free" : "locked",
    is_archived: false,
  };

  if (existingModuleId) {
    const { data, error } = await supabase
      .from("course_modules")
      .update(payload)
      .eq("id", existingModuleId)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to update module "${module.title}": ${error.message}`);
    }

    return data.id as string;
  }

  const { data, error } = await supabase
    .from("course_modules")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create module "${module.title}": ${error.message}`);
  }

  return data.id as string;
}

async function upsertLesson(
  supabase: SeedableSupabaseClient,
  moduleId: string,
  lesson: SeedCourse["modules"][number]["lessons"][number],
  existingLessonId: string | null
) {
  const payload = {
    module_id: moduleId,
    title: lesson.title,
    slug: lesson.slug,
    type: lesson.type,
    content: lesson.content,
    video_url: lesson.video_url,
    duration_minutes: lesson.duration_minutes,
    order_index: lesson.order_index,
    is_published: lesson.is_published,
  };

  if (existingLessonId) {
    const { data, error } = await supabase
      .from("lessons")
      .update(payload)
      .eq("id", existingLessonId)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to update lesson "${lesson.title}": ${error.message}`);
    }

    return data.id as string;
  }

  const { data, error } = await supabase
    .from("lessons")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create lesson "${lesson.title}": ${error.message}`);
  }

  return data.id as string;
}

async function bootstrapLibraryDemoProgress(
  supabase: SeedableSupabaseClient,
  options: {
    userId: string;
    courseIdsBySlug: Map<string, string>;
    lessonIdsByCourseSlug: Map<string, string[]>;
  }
) {
  const demoCourseSlug = "public-speaking-mastery";
  const courseId = options.courseIdsBySlug.get(demoCourseSlug);
  const lessonIds = options.lessonIdsByCourseSlug.get(demoCourseSlug) ?? [];

  if (!courseId) {
    return false;
  }

  const existingEnrollmentRes = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", options.userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingEnrollmentRes.error) {
    throw new Error(existingEnrollmentRes.error.message);
  }

  const enrollmentPayload = {
    user_id: options.userId,
    course_id: courseId,
    status: "active",
    progress_percent: 30,
  };

  if (existingEnrollmentRes.data?.id) {
    const { error } = await supabase
      .from("enrollments")
      .update(enrollmentPayload)
      .eq("id", existingEnrollmentRes.data.id);

    if (error) {
      throw new Error(`Failed to update demo enrollment: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from("enrollments").insert(enrollmentPayload);

    if (error) {
      throw new Error(`Failed to create demo enrollment: ${error.message}`);
    }
  }

  const completedLessonIds = lessonIds.slice(0, 2);
  const completedAt = new Date().toISOString();

  for (const lessonId of completedLessonIds) {
    const existingProgressRes = await supabase
      .from("lesson_progress")
      .select("id")
      .eq("user_id", options.userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (existingProgressRes.error) {
      throw new Error(existingProgressRes.error.message);
    }

    const progressPayload = {
      user_id: options.userId,
      lesson_id: lessonId,
      status: "completed",
      time_spent_seconds: 600,
      completed_at: completedAt,
    };

    if (existingProgressRes.data?.id) {
      const { error } = await supabase
        .from("lesson_progress")
        .update(progressPayload)
        .eq("id", existingProgressRes.data.id);

      if (error) {
        throw new Error(`Failed to update demo lesson progress: ${error.message}`);
      }
    } else {
      const { error } = await supabase.from("lesson_progress").insert(progressPayload);

      if (error) {
        throw new Error(`Failed to create demo lesson progress: ${error.message}`);
      }
    }
  }

  return true;
}
