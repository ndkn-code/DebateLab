"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  LayoutGrid,
  Mic2,
  Scale,
  Sparkles,
} from "@/components/ui/icons";
import { Progress } from "@/components/ui/progress";
import { CourseCard } from "@/components/courses/course-card";
import { PageTransition } from "@/components/shared/page-motion";
import { ProductPageHeader } from "@/components/shared/product-layout";
import {
  CourseArtwork,
  resolveCourseArtworkVariant,
} from "@/components/courses/course-artwork";
import { cn } from "@/lib/utils";
import type {
  CourseCategory,
  CourseLibraryData,
  CourseLibraryItem,
} from "@/lib/api/courses";

interface CourseListContentProps {
  library: CourseLibraryData;
}

function getCourseCtaLabel(
  course: CourseLibraryItem,
  labels: { start: string; continueLearning: string; review: string }
) {
  if (course.status === "completed") return labels.review;
  if (course.status === "in-progress") return labels.continueLearning;
  return labels.start;
}

function getStatusLabel(
  course: CourseLibraryItem,
  t: ReturnType<typeof useTranslations>
) {
  if (course.status === "completed") return t("status.completed");
  if (course.status === "in-progress") return t("status.in_progress");
  return t("status.not_started");
}

function getDifficultyLabel(
  difficulty: CourseLibraryItem["difficulty"],
  t: ReturnType<typeof useTranslations>
) {
  if (difficulty === "beginner") return t("difficulty_beginner");
  if (difficulty === "intermediate") return t("difficulty_intermediate");
  return t("difficulty_advanced");
}

function getRecommendationReasons(
  course: CourseLibraryItem,
  t: ReturnType<typeof useTranslations>
) {
  const baseKey = `recommendation.reasons.${course.category}.${course.difficulty}` as const;

  return [
    t(`${baseKey}.one`),
    t(`${baseKey}.two`),
    t(`${baseKey}.three`),
  ];
}

function FeaturedCourseHero({ course }: { course: CourseLibraryItem }) {
  const t = useTranslations("dashboard.courses");
  const statusLabel = getStatusLabel(course, t);
  const ctaLabel = getCourseCtaLabel(course, {
    start: t("start"),
    continueLearning: t("hero.continue_learning"),
    review: t("review"),
  });

  return (
    <section className="overflow-hidden rounded-[20px] border border-outline-variant bg-white shadow-token-card">
      <div className="grid gap-0 2xl:grid-cols-[248px_minmax(0,1fr)_360px]">
        <div className="p-3">
          <div className="overflow-hidden rounded-[15px] border border-outline-variant">
            <div className="aspect-[1.13/1] xl:aspect-[1.16/1]">
              <CourseArtwork variant={resolveCourseArtworkVariant(course)} />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center px-6 py-6 xl:py-7">
          <div
            className={cn(
              "inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
              course.status === "in-progress"
                ? "bg-primary-container text-primary"
                : course.status === "completed"
                  ? "bg-surface-container text-on-surface-variant"
                  : "bg-surface-container text-on-surface-variant"
            )}
          >
            {statusLabel}
          </div>

          <h2 className="mt-4 text-[1.75rem] font-semibold text-on-surface-variant sm:text-[2rem]">
            {course.title}
          </h2>
          <p className="mt-3 max-w-[520px] text-[15px] leading-8 text-on-surface-variant">
            {course.description || t("description_fallback")}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4 xl:flex-nowrap">
            <span className="shrink-0 text-[15px] font-semibold text-primary">
              {course.progressPercent}% {t("hero.complete")}
            </span>
            <Progress
              value={course.progressPercent}
              className="h-2.5 w-full max-w-[190px] min-w-[140px] bg-surface-container [&>div]:bg-primary"
            />
            <span className="shrink-0 text-[15px] text-on-surface-variant">
              {course.completedLessonCount} / {course.lessonCount} {t("modules_label")}
            </span>
          </div>
        </div>

        <div className="border-t border-outline-variant px-7 py-6 2xl:border-l 2xl:border-t-0 2xl:py-7">
          <div className="flex h-full flex-col justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
                <BookOpenCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[1.45rem] font-semibold tracking-[-0.03em] text-on-surface-variant">
                  {t("hero.next_up")}
                </p>
                {course.nextLesson ? (
                  <>
                    <p className="mt-2 text-[15px] leading-7 text-on-surface-variant">
                      {course.nextLesson.title}
                    </p>
                    <p className="mt-1 text-[15px] text-on-surface-variant">
                      {t("estimated_minutes", {
                        minutes: course.nextLesson.durationMinutes,
                      })}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[15px] leading-7 text-on-surface-variant">
                    {t("hero.completed_description")}
                  </p>
                )}
              </div>
            </div>

            <HeroActionLink href={course.ctaHref} label={ctaLabel} disabled={course.isMock === true} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroActionLink({
  href,
  label,
  disabled = false,
}: {
  href: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3 text-[15px] font-semibold text-white shadow-token-primary transition-colors hover:bg-surface-container-high",
        disabled && "pointer-events-none opacity-80"
      )}
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function RecommendationPanel({ course }: { course: CourseLibraryItem }) {
  const t = useTranslations("dashboard.courses");
  const tp = useTranslations("dashboard.practice");
  const reasons = getRecommendationReasons(course, t);

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-[1.55rem] font-semibold tracking-[-0.03em] text-on-surface-variant">
          {t("recommendation.title")}
        </h2>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-outline-variant bg-white shadow-token-card">
        <div className="grid gap-4 p-3 lg:grid-cols-[118px_minmax(0,1fr)_320px_156px] lg:items-center lg:gap-5 lg:p-4">
          <div className="overflow-hidden rounded-[14px] border border-outline-variant">
            <div className="aspect-square">
              <CourseArtwork variant={resolveCourseArtworkVariant(course)} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-on-surface-variant">
                {course.title}
              </h3>
              <span className="rounded-full bg-primary-container px-3 py-1 text-[12px] font-medium text-primary">
                {getDifficultyLabel(course.difficulty, tp)}
              </span>
            </div>

            <p className="mt-2 max-w-[540px] text-[15px] leading-8 text-on-surface-variant">
              {course.description || t("description_fallback")}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-6 text-[14px] text-on-surface-variant">
              <span>{t("modules_count", { count: course.moduleCount })}</span>
              <span>{getDifficultyLabel(course.difficulty, tp)}</span>
            </div>
          </div>

          <div className="rounded-[16px] bg-surface-container px-5 py-4">
            <p className="text-[15px] font-medium text-on-surface-variant">
              {t("recommendation.why_course")}
            </p>
            <div className="mt-3 space-y-3">
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="flex items-start gap-2.5 text-[15px] leading-7 text-on-surface-variant"
                >
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex lg:justify-end">
            <Link
              href={course.isMock ? "#" : course.ctaHref}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-outline-variant bg-white px-6 py-3 text-[15px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container",
                course.isMock && "pointer-events-none"
              )}
            >
              {t("start")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CourseListContent({ library }: CourseListContentProps) {
  const t = useTranslations("dashboard.courses");
  const tp = useTranslations("dashboard.practice");
  const router = useRouter();
  const [category, setCategory] = useState<"all" | CourseCategory>("all");
  const hasTriggeredSeedSync = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (hasTriggeredSeedSync.current) return;
    if (!library.items.some((course) => course.isMock)) return;

    hasTriggeredSeedSync.current = true;

    void fetch("/api/dev/seed-library-courses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          return null;
        }

        router.refresh();
        return null;
      })
      .catch(() => {
        hasTriggeredSeedSync.current = false;
      });
  }, [library.items, router]);

  const filters = [
    { value: "all" as const, label: t("tab_all"), icon: LayoutGrid },
    { value: "debate" as const, label: t("tab_debate"), icon: Scale },
    { value: "public-speaking" as const, label: t("tab_speaking"), icon: Mic2 },
  ];

  const filteredCourses =
    category === "all"
      ? library.items
      : library.items.filter((course) => course.category === category);

  const gridCourses = filteredCourses
    .filter((course) => course.id !== library.recommendedCourse?.id)
    .slice(0, 4);

  return (
    <PageTransition className="min-h-full bg-surface-container px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-6xl">
        <ProductPageHeader
          title={t("page_headline")}
          icon={<BookOpenCheck />}
          className="mb-5"
        />

        {library.featuredCourse ? (
          <FeaturedCourseHero course={library.featuredCourse} />
        ) : null}

        <section className="mt-6">
          <div className="mb-5 flex flex-wrap gap-3">
            {filters.map((filter) => {
              const Icon = filter.icon;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setCategory(filter.value)}
                  className={cn(
                    "inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border px-5 py-2.5 text-[15px] font-medium transition-colors",
                    category === filter.value
                      ? "border-primary bg-primary text-white shadow-token-primary"
                      : "border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {filter.label}
                </button>
              );
            })}
          </div>

          <h2 className="mb-4 text-[1.6rem] font-semibold tracking-[-0.03em] text-on-surface-variant">
            {t("status.in_progress")}
          </h2>

          {gridCourses.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
              {gridCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  statusLabel={getStatusLabel(course, t)}
                  difficultyLabel={getDifficultyLabel(course.difficulty, tp)}
                  descriptionFallbackLabel={t("description_fallback")}
                  startLabel={t("start")}
                  continueLabel={t("continue")}
                  reviewLabel={t("review")}
                  modulesCountLabel={t("modules_count", {
                    count: course.moduleCount,
                  })}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-outline-variant bg-white px-6 py-10 text-center text-on-surface-variant">
              {t("empty_subtitle")}
            </div>
          )}
        </section>

        {library.recommendedCourse ? (
          <RecommendationPanel course={library.recommendedCourse} />
        ) : null}
      </div>
    </PageTransition>
  );
}
