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

export interface CourseWithModules extends Course {
  modules: (CourseModule & { lessons: Lesson[] })[];
  enrollment?: Enrollment | null;
  total_lessons: number;
  completed_lessons: number;
}

export interface LessonWithContext extends Lesson {
  module: CourseModule;
  course: Course;
  quiz_questions: QuizQuestion[];
  progress: LessonProgress | null;
  prev_lesson: { slug: string; title: string } | null;
  next_lesson: { slug: string; title: string } | null;
}

// ── Courses ──────────────────────────────────────────────────────────

export async function getCourses(userId?: string) {
  const supabase = await createClient();

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .eq("is_published", true)
    .order("created_at");

  if (error) throw error;

  if (!userId || !courses) return { courses: courses ?? [], enrollments: [] };

  // Fetch user enrollments
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId);

  return { courses, enrollments: enrollments ?? [] };
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

  // Fetch modules with lessons
  const { data: modules } = await supabase
    .from("course_modules")
    .select("*, lessons(*)")
    .eq("course_id", course.id)
    .order("order_index");

  // Sort lessons within each module
  const sortedModules = (modules ?? []).map((m: CourseModule & { lessons: Lesson[] }) => ({
    ...m,
    lessons: (m.lessons ?? []).sort(
      (a: Lesson, b: Lesson) => a.order_index - b.order_index
    ),
  }));

  // Count total lessons
  const totalLessons = sortedModules.reduce(
    (sum: number, m: { lessons: Lesson[] }) => sum + m.lessons.length,
    0
  );

  // Fetch enrollment and progress if logged in
  let enrollment: Enrollment | null = null;
  let completedLessons = 0;

  if (userId) {
    const { data: enrollmentData } = await supabase
      .from("enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .single();

    enrollment = enrollmentData;

    if (enrollment) {
      // Count completed lessons
      const allLessonIds = sortedModules.flatMap((m: { lessons: Lesson[] }) =>
        m.lessons.map((l: Lesson) => l.id)
      );

      if (allLessonIds.length > 0) {
        const { count } = await supabase
          .from("lesson_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed")
          .in("lesson_id", allLessonIds);

        completedLessons = count ?? 0;
      }
    }
  }

  return {
    ...course,
    modules: sortedModules,
    enrollment,
    total_lessons: totalLessons,
    completed_lessons: completedLessons,
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

  // Get all modules and lessons for this course (for navigation)
  const { data: modules } = await supabase
    .from("course_modules")
    .select("*, lessons(*)")
    .eq("course_id", course.id)
    .order("order_index");

  if (!modules) return null;

  // Flatten and sort all lessons
  const allLessons: { lesson: Lesson; module: CourseModule }[] = [];
  for (const mod of modules) {
    const sorted = ((mod as CourseModule & { lessons: Lesson[] }).lessons ?? []).sort(
      (a: Lesson, b: Lesson) => a.order_index - b.order_index
    );
    for (const lesson of sorted) {
      allLessons.push({ lesson, module: mod });
    }
  }

  // Find the target lesson
  const idx = allLessons.findIndex((l) => l.lesson.slug === lessonSlug);
  if (idx === -1) return null;

  const { lesson, module } = allLessons[idx];

  // Get quiz questions if quiz type
  let quizQuestions: QuizQuestion[] = [];
  if (lesson.type === "quiz") {
    const { data } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("lesson_id", lesson.id)
      .order("order_index");
    quizQuestions = data ?? [];
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

  // Build prev/next
  const prev = idx > 0 ? allLessons[idx - 1] : null;
  const next = idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

  return {
    ...lesson,
    module,
    course,
    quiz_questions: quizQuestions,
    progress,
    prev_lesson: prev
      ? { slug: prev.lesson.slug, title: prev.lesson.title }
      : null,
    next_lesson: next
      ? { slug: next.lesson.slug, title: next.lesson.title }
      : null,
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

  if (error) throw error;

  // Log activity
  await supabase.from("activity_logs").insert({
    user_id: userId,
    activity_type: "course_enrolled",
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

  if (progressError) throw progressError;

  // Calculate XP (25 base + up to 25 bonus for score)
  const xpEarned = score != null ? 25 + Math.round((score / 100) * 25) : 25;

  // Log activity
  await supabase.from("activity_logs").insert({
    user_id: userId,
    activity_type: "lesson_completed",
    reference_id: lessonId,
    reference_type: "lesson",
    xp_earned: xpEarned,
    metadata: { score, time_spent_seconds: timeSpentSeconds },
  });

  // Award XP to profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, level")
    .eq("id", userId)
    .single();

  if (profile) {
    const newXp = (profile.xp ?? 0) + xpEarned;
    const newLevel = Math.floor(newXp / 500) + 1;

    await supabase
      .from("profiles")
      .update({ xp: newXp, level: newLevel })
      .eq("id", userId);

    if (newLevel > (profile.level ?? 1)) {
      await supabase.from("activity_logs").insert({
        user_id: userId,
        activity_type: "level_up",
        xp_earned: 0,
        metadata: { new_level: newLevel },
      });
    }
  }

  // Update daily stats
  const today = new Date().toISOString().split("T")[0];
  const { data: existingStats } = await supabase
    .from("daily_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  if (existingStats) {
    await supabase
      .from("daily_stats")
      .update({
        xp_earned: (existingStats.xp_earned ?? 0) + xpEarned,
      })
      .eq("id", existingStats.id);
  } else {
    await supabase.from("daily_stats").insert({
      user_id: userId,
      date: today,
      sessions_completed: 0,
      practice_minutes: 0,
      xp_earned: xpEarned,
    });
  }

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
    await supabase.from("activity_logs").insert({
      user_id: userId,
      activity_type: "course_completed",
      reference_id: courseId,
      reference_type: "course",
      xp_earned: 100,
      metadata: {},
    });

    // Award course completion XP
    const { data: profile } = await supabase
      .from("profiles")
      .select("xp, level")
      .eq("id", userId)
      .single();

    if (profile) {
      const newXp = (profile.xp ?? 0) + 100;
      const newLevel = Math.floor(newXp / 500) + 1;
      await supabase
        .from("profiles")
        .update({ xp: newXp, level: newLevel })
        .eq("id", userId);
    }
  }
}

export async function getLessonProgress(userId: string, lessonIds: string[]) {
  if (lessonIds.length === 0) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);

  return data ?? [];
}
