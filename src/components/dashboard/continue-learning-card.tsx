"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BookOpen,
  Mic2,
  Scale,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { EnrollmentWithCourse } from "@/lib/api/dashboard";

const CATEGORY_META = {
  debate: {
    icon: Scale,
    gradient: "from-primary via-primary-dim to-[#1f2f8c]",
  },
  "public-speaking": {
    icon: Mic2,
    gradient: "from-secondary via-secondary-dim to-[#1c4a40]",
  },
} as const;

interface ContinueLearningCardProps {
  enrollments: EnrollmentWithCourse[];
  compact?: boolean;
}

function getCategoryLabel(
  category: string,
  speakingLabel: string,
  debateLabel: string
) {
  return category === "debate" ? debateLabel : speakingLabel;
}

export function ContinueLearningCard({
  enrollments,
  compact = false,
}: ContinueLearningCardProps) {
  const t = useTranslations("dashboard.home");
  const tc = useTranslations("dashboard.courses");
  const sortedEnrollments = [...enrollments].sort(
    (left, right) =>
      right.progress_percent - left.progress_percent ||
      left.course_title.localeCompare(right.course_title)
  );
  const featuredCourse = sortedEnrollments[0];
  const additionalCourses = sortedEnrollments.slice(1, 3);

  if (!featuredCourse) {
    return (
      <section
        className={cn(
          "rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest soft-shadow",
          compact ? "p-5" : "p-6 sm:p-7"
        )}
      >
        <div className="flex h-full flex-col justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <BookOpen className="h-3.5 w-3.5" />
              {t("continue_learning")}
            </span>
            <h2 className={cn("font-semibold text-on-surface", compact ? "mt-3 text-xl" : "mt-4 text-2xl")}>
              {t("start_first_course")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
              {t("course_empty_student_note")}
            </p>
          </div>

          <Link href="/courses">
            <Button className="w-full bg-primary text-on-primary sm:w-auto">
              {t("browse_courses")}
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  const categoryMeta =
    CATEGORY_META[
      featuredCourse.course_category as keyof typeof CATEGORY_META
    ] ?? CATEGORY_META.debate;
  const Icon = categoryMeta.icon;
  const categoryLabel = getCategoryLabel(
    featuredCourse.course_category,
    tc("tab_speaking"),
    tc("tab_debate")
  );

  if (compact) {
    return (
      <section className="rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-low p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {t("continue_learning")}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-on-surface">
              {t("continue_course")}
            </h2>
          </div>

          <Badge variant="outline" className="px-2.5 py-1 text-xs">
            {t("active_courses", { count: sortedEnrollments.length })}
          </Badge>
        </div>

        <div className="overflow-hidden rounded-[1.4rem] border border-outline-variant/15 bg-surface-container-lowest">
          <div className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)]">
            <div className="relative min-h-[180px] overflow-hidden">
              {featuredCourse.course_thumbnail_url ? (
                <Image
                  src={featuredCourse.course_thumbnail_url}
                  alt={featuredCourse.course_title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 220px"
                />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center bg-gradient-to-br text-white",
                    categoryMeta.gradient
                  )}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                    <Icon className="h-7 w-7" />
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-[#11152e]/80 via-[#11152e]/15 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                  {categoryLabel}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col justify-between p-4">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">
                  {featuredCourse.course_title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {t("course_preview_note")}
                </p>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-on-surface-variant">
                    <span>{t("course_progress_label")}</span>
                    <span>{featuredCourse.progress_percent}%</span>
                  </div>
                  <Progress value={featuredCourse.progress_percent} className="h-2.5" />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <Link href="/courses">
                  <Button className="w-full gap-2 bg-primary text-on-primary sm:w-auto">
                    <ArrowRight className="h-4 w-4" />
                    {t("open_course")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {additionalCourses.length > 0 ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {additionalCourses.map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-outline-variant/10 bg-surface-container-lowest p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-on-surface">
                    {course.course_title}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {getCategoryLabel(
                      course.course_category,
                      tc("tab_speaking"),
                      tc("tab_debate")
                    )}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-semibold text-on-surface">
                  {course.progress_percent}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[1.15rem] border border-dashed border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("single_active_course")}
            </span>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-5 soft-shadow sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("continue_learning")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">
            {t("continue_course")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {t("continue_learning_subtitle")}
          </p>
        </div>

        <Badge variant="outline" className="px-2.5 py-1 text-xs">
          {t("active_courses", { count: sortedEnrollments.length })}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-low">
        <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="relative aspect-[16/10] overflow-hidden">
            {featuredCourse.course_thumbnail_url ? (
              <Image
                src={featuredCourse.course_thumbnail_url}
                alt={featuredCourse.course_title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 28vw"
              />
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center bg-gradient-to-br text-white",
                  categoryMeta.gradient
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Icon className="h-8 w-8" />
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#11152e]/85 via-[#11152e]/25 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                {categoryLabel}
              </Badge>
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                {t("course_progress_label")}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col justify-between p-5 sm:p-6">
            <div>
              <h3 className="text-xl font-semibold text-on-surface">
                {featuredCourse.course_title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {t("course_preview_note")}
              </p>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm text-on-surface-variant">
                  <span>{t("course_progress_label")}</span>
                  <span>{featuredCourse.progress_percent}%</span>
                </div>
                <Progress value={featuredCourse.progress_percent} className="h-2.5" />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link href="/courses">
                <Button className="w-full gap-2 bg-primary text-on-primary">
                  <ArrowRight className="h-4 w-4" />
                  {t("open_course")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {additionalCourses.length > 0 ? (
        <div className="mt-4 space-y-2">
          {additionalCourses.map((course) => (
            <div
              key={course.id}
              className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-low p-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-on-surface">
                  {course.course_title}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {getCategoryLabel(
                    course.course_category,
                    tc("tab_speaking"),
                    tc("tab_debate")
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden w-28 sm:block">
                  <Progress value={course.progress_percent} className="h-2" />
                </div>
                <span className="text-sm font-semibold text-on-surface">
                  {course.progress_percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[1.25rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("single_active_course")}
          </span>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Link
          href="/courses"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("see_all")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
