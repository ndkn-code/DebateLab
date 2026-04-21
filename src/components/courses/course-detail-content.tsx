"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Layers3,
  Mic2,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enrollAction } from "@/app/actions/enrollment";
import { CourseLearningPath } from "@/components/courses/course-learning-path";
import type { CourseWithModules } from "@/lib/api/courses";

const DIFFICULTY_COLORS = {
  beginner: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  intermediate: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  advanced: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

interface CourseDetailContentProps {
  course: CourseWithModules;
}

export function CourseDetailContent({ course }: CourseDetailContentProps) {
  const t = useTranslations("dashboard.courses");
  const tp = useTranslations("dashboard.practice");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEnrolled, setIsEnrolled] = useState(!!course.enrollment);

  const handleEnroll = () => {
    startTransition(async () => {
      await enrollAction(course.id);
      setIsEnrolled(true);
      router.refresh();
    });
  };

  const totalLessons = course.total_lessons;
  const totalActivities = course.total_activities ?? 0;
  const totalContent = totalLessons + totalActivities;
  const completedLessons = course.completed_lessons;
  const progress = course.enrollment?.progress_percent ?? 0;
  const totalDurationMinutes = course.modules.reduce(
    (sum, m) =>
      sum + (m.activities ?? []).reduce((s, a) => s + (a.duration_minutes ?? 0), 0),
    0
  );
  const estimatedHours =
    course.estimated_hours ||
    (totalDurationMinutes > 0
      ? Math.round((totalDurationMinutes / 60) * 10) / 10
      : 0);
  const difficultyLabel =
    course.difficulty === "beginner"
      ? tp("difficulty_beginner")
      : course.difficulty === "intermediate"
        ? tp("difficulty_intermediate")
        : tp("difficulty_advanced");
  const categoryLabel =
    course.category === "debate" ? t("tab_debate") : t("tab_speaking");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Back link */}
      <Link
        href="/courses"
        className="mb-6 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.back")}
      </Link>

      <section className="mb-10 overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest soft-shadow">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2 py-0.5",
                  DIFFICULTY_COLORS[course.difficulty]
                )}
              >
                {difficultyLabel}
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {categoryLabel}
              </Badge>
              {course.enrollment?.status === "completed" ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t("detail.completed")}
                </Badge>
              ) : null}
            </div>

            <h1 className="text-3xl font-bold text-on-surface sm:text-4xl">
              {course.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-base">
              {course.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                {estimatedHours > 0
                  ? t("detail.total_hours", { hours: estimatedHours })
                  : t("detail.self_paced")}
              </span>
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {t("detail.learning_steps", { count: totalContent })}
              </span>
              <span className="inline-flex items-center gap-2">
                <Layers3 className="h-4 w-4" />
                {t("detail.modules", { count: course.modules.length })}
              </span>
            </div>
          </div>

          <div className="border-t border-outline-variant/10 bg-surface-container-low p-6 lg:border-l lg:border-t-0 sm:p-8">
            <div className="overflow-hidden rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest">
              <div className="relative aspect-[16/10] overflow-hidden">
                {course.thumbnail_url ? (
                  <Image
                    src={course.thumbnail_url}
                    alt={course.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary via-primary-dim to-[#1f2f8c] text-white">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                      {course.category === "public-speaking" ? (
                        <Mic2 className="h-8 w-8" />
                      ) : (
                        <Scale className="h-8 w-8" />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 p-5">
                {!isEnrolled ? (
                  <>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {t("detail.unlock_title")}
                      </p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {t("detail.unlock_subtitle")}
                      </p>
                    </div>
                    <Button
                      onClick={handleEnroll}
                      disabled={isPending}
                      className="w-full bg-primary text-on-primary"
                      size="lg"
                    >
                      {isPending ? t("detail.enrolling") : t("detail.enroll")}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm text-on-surface-variant">
                      <span>{t("detail.course_progress")}</span>
                      <span>{t("detail.complete", { progress })}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-container p-4 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                          {t("detail.completed")}
                        </p>
                        <p className="mt-1 font-semibold text-on-surface">
                          {t("detail.completed_lessons", {
                            completed: completedLessons,
                            total: totalLessons,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                          {t("detail.activities")}
                        </p>
                        <p className="mt-1 font-semibold text-on-surface">
                          {t("detail.activities_available", { count: totalActivities })}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("detail.guided_progression")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">
            {t("detail.follow_title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {t("detail.follow_subtitle")}
          </p>
        </div>

        <CourseLearningPath course={course} />
      </section>
    </div>
  );
}
