"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseCard } from "@/components/courses/course-card";
import type { Course, Enrollment } from "@/types/database";

interface CourseListContentProps {
  courses: Course[];
  enrollments: Enrollment[];
}

export function CourseListContent({
  courses,
  enrollments,
}: CourseListContentProps) {
  const t = useTranslations("dashboard.courses");
  const tp = useTranslations("dashboard.practice");
  const [category, setCategory] = useState("all");

  const CATEGORIES = [
    { value: "all", label: t("tab_all") },
    { value: "debate", label: t("tab_debate") },
    { value: "public-speaking", label: t("tab_speaking") },
  ];

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return tp("difficulty_beginner");
      case "intermediate":
        return tp("difficulty_intermediate");
      case "advanced":
        return tp("difficulty_advanced");
      default:
        return difficulty;
    }
  };

  const enrollmentMap = new Map(
    enrollments.map((e) => [e.course_id, e])
  );

  const filtered =
    category === "all"
      ? courses
      : courses.filter((c) => c.category === category);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface sm:text-3xl">
          {t("page_headline")}
        </h1>
        <p className="mt-1 text-on-surface-variant">
          {t("page_subtitle")}
        </p>
      </div>

      {/* Category Filter */}
      <div className="scrollbar-hide -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px]",
              category === cat.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest p-12 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-primary/30" />
          <p className="font-medium text-on-surface">{t("empty")}</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t("empty_subtitle")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => {
            const enrollment = enrollmentMap.get(course.id);

            return (
              <CourseCard
                key={course.id}
                course={course}
                enrollment={enrollment}
                difficultyLabel={getDifficultyLabel(course.difficulty)}
                categoryLabel={
                  course.category === "debate"
                    ? t("tab_debate")
                    : t("tab_speaking")
                }
                descriptionFallbackLabel={t("description_fallback")}
                startLabel={t("start")}
                continueLabel={t("continue")}
                completedLabel={t("completed")}
                progressLabel={t("progress")}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
