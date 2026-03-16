"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { BookOpen, Clock, BarChart3, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Course, Enrollment } from "@/types/database";

const CATEGORIES = [
  { value: "all", label: "All Courses" },
  { value: "debate", label: "Debate" },
  { value: "public-speaking", label: "Public Speaking" },
];

const DIFFICULTY_COLORS = {
  beginner: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  intermediate: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  advanced: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

interface CourseListContentProps {
  courses: Course[];
  enrollments: Enrollment[];
}

export function CourseListContent({
  courses,
  enrollments,
}: CourseListContentProps) {
  const [category, setCategory] = useState("all");

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
          Courses
        </h1>
        <p className="mt-1 text-on-surface-variant">
          Structured lessons to build your debate and speaking skills
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
          <p className="font-medium text-on-surface">No courses found</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Check back soon for new content
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => {
            const enrollment = enrollmentMap.get(course.id);
            const isEnrolled = !!enrollment;
            const isCompleted = enrollment?.status === "completed";

            return (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="group flex flex-col rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 transition-all hover:border-primary/20 soft-shadow"
              >
                {/* Top row: icon + badges */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container/30">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-2 py-0.5",
                        DIFFICULTY_COLORS[course.difficulty]
                      )}
                    >
                      {course.difficulty}
                    </Badge>
                  </div>
                </div>

                {/* Title & description */}
                <h3 className="mb-1 text-base font-semibold text-on-surface group-hover:text-primary transition-colors">
                  {course.title}
                </h3>
                <p className="mb-4 line-clamp-2 text-sm text-on-surface-variant">
                  {course.description}
                </p>

                {/* Meta */}
                <div className="mt-auto flex items-center gap-4 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {course.estimated_hours}h
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {course.category}
                  </span>
                </div>

                {/* Progress bar or CTA */}
                {isEnrolled && !isCompleted ? (
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[10px] text-on-surface-variant">
                      <span>Progress</span>
                      <span>{enrollment.progress_percent}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${enrollment.progress_percent}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : !isEnrolled ? (
                  <Button
                    size="sm"
                    className="mt-4 w-full bg-primary text-on-primary"
                  >
                    Start Course
                  </Button>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
