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
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CourseCard } from "@/components/courses/course-card";
import { PageTransition } from "@/components/shared/page-motion";
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
    <section className="overflow-hidden rounded-[20px] border border-[#dee8f8] bg-white shadow-[0_24px_50px_-42px_rgba(31,55,113,0.26)]">
      <div className="grid gap-0 xl:grid-cols-[248px_minmax(0,1fr)_440px]">
        <div className="p-3">
          <div className="overflow-hidden rounded-[15px] border border-[#e3ebfa]">
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
                ? "bg-[#edf4ff] text-[#4d86f7]"
                : course.status === "completed"
                  ? "bg-[#eaf9ee] text-[#2ca655]"
                  : "bg-[#f3f6fb] text-[#7f8ea6]"
            )}
          >
            {statusLabel}
          </div>

          <h2 className="mt-4 text-[2.1rem] font-semibold tracking-[-0.04em] text-[#14244a]">
            {course.title}
          </h2>
          <p className="mt-3 max-w-[520px] text-[15px] leading-8 text-[#66758d]">
            {course.description || t("description_fallback")}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4 xl:flex-nowrap">
            <span className="shrink-0 text-[15px] font-semibold text-[#4d86f7]">
              {course.progressPercent}% {t("hero.complete")}
            </span>
            <Progress
              value={course.progressPercent}
              className="h-2.5 w-full max-w-[190px] min-w-[140px] bg-[#e7eefb] [&>div]:bg-[#4d86f7]"
            />
            <span className="shrink-0 text-[15px] text-[#6b7b95]">
              {course.completedLessonCount} / {course.lessonCount} {t("modules_label")}
            </span>
          </div>
        </div>

        <div className="border-t border-[#edf3fd] px-7 py-6 xl:border-l xl:border-t-0 xl:py-7">
          <div className="flex h-full flex-col justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3f7ff] text-[#4d86f7]">
                <BookOpenCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[1.45rem] font-semibold tracking-[-0.03em] text-[#15254a]">
                  {t("hero.next_up")}
                </p>
                {course.nextLesson ? (
                  <>
                    <p className="mt-2 text-[15px] leading-7 text-[#4e6182]">
                      {course.nextLesson.title}
                    </p>
                    <p className="mt-1 text-[15px] text-[#7a8aa3]">
                      {t("estimated_minutes", {
                        minutes: course.nextLesson.durationMinutes,
                      })}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[15px] leading-7 text-[#66758d]">
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
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-[#4d86f7] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_18px_34px_-24px_rgba(77,134,247,0.65)] transition-colors hover:bg-[#3f78eb]",
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
        <Sparkles className="h-4 w-4 text-[#4d86f7]" />
        <h2 className="text-[1.55rem] font-semibold tracking-[-0.03em] text-[#15254a]">
          {t("recommendation.title")}
        </h2>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[#dee8f8] bg-white shadow-[0_24px_50px_-42px_rgba(31,55,113,0.24)]">
        <div className="grid gap-4 p-3 lg:grid-cols-[118px_minmax(0,1fr)_320px_156px] lg:items-center lg:gap-5 lg:p-4">
          <div className="overflow-hidden rounded-[14px] border border-[#e3ebfa]">
            <div className="aspect-square">
              <CourseArtwork variant={resolveCourseArtworkVariant(course)} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-[#14244a]">
                {course.title}
              </h3>
              <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-[12px] font-medium text-[#4d86f7]">
                {getDifficultyLabel(course.difficulty, tp)}
              </span>
            </div>

            <p className="mt-2 max-w-[540px] text-[15px] leading-8 text-[#66758d]">
              {course.description || t("description_fallback")}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-6 text-[14px] text-[#718096]">
              <span>{t("modules_count", { count: course.moduleCount })}</span>
              <span>{getDifficultyLabel(course.difficulty, tp)}</span>
            </div>
          </div>

          <div className="rounded-[16px] bg-[#f4f8ff] px-5 py-4">
            <p className="text-[15px] font-medium text-[#495d80]">
              {t("recommendation.why_course")}
            </p>
            <div className="mt-3 space-y-3">
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="flex items-start gap-2.5 text-[15px] leading-7 text-[#5f708b]"
                >
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#34c759]" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex lg:justify-end">
            <Link
              href={course.isMock ? "#" : course.ctaHref}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[#9fc0ff] bg-white px-6 py-3 text-[15px] font-semibold text-[#3c74e3] transition-colors hover:bg-[#f7fbff]",
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
    <PageTransition className="min-h-[calc(100dvh-3.5rem)] bg-[#f8fbff] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1240px]">
        <header className="mb-5">
          <h1 className="text-[2.45rem] font-semibold tracking-[-0.045em] text-[#14244a] sm:text-[2.8rem]">
            {t("page_headline")}
          </h1>
          <p className="mt-1 text-[16px] leading-8 text-[#66758d]">
            {t("page_subtitle")}
          </p>
        </header>

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
                      ? "border-[#4d86f7] bg-[#4d86f7] text-white shadow-[0_14px_26px_-18px_rgba(77,134,247,0.55)]"
                      : "border-[#dbe5f5] bg-white text-[#233a64] hover:bg-[#f7fbff]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {filter.label}
                </button>
              );
            })}
          </div>

          <h2 className="mb-4 text-[1.6rem] font-semibold tracking-[-0.03em] text-[#15254a]">
            {t("status.in_progress")}
          </h2>

          {gridCourses.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-4">
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
            <div className="rounded-[18px] border border-dashed border-[#dbe5f5] bg-white px-6 py-10 text-center text-[#66758d]">
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
