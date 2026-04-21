"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Mic2,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Course, Enrollment } from "@/types";

const DIFFICULTY_COLORS = {
  beginner: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
  intermediate: "border-amber-500/20 bg-amber-500/10 text-amber-600",
  advanced: "border-rose-500/20 bg-rose-500/10 text-rose-500",
} as const;

const CATEGORY_META = {
  debate: {
    icon: Scale,
    gradient: "from-primary/90 via-primary-dim to-[#1f2f8c]",
  },
  "public-speaking": {
    icon: Mic2,
    gradient: "from-secondary via-secondary-dim to-[#1c4a40]",
  },
} as const;

interface CourseCardProps {
  course: Course;
  enrollment?: Enrollment;
  difficultyLabel: string;
  categoryLabel: string;
  descriptionFallbackLabel: string;
  startLabel: string;
  continueLabel: string;
  completedLabel: string;
  progressLabel: string;
}

export function CourseCard({
  course,
  enrollment,
  difficultyLabel,
  categoryLabel,
  descriptionFallbackLabel,
  startLabel,
  continueLabel,
  completedLabel,
  progressLabel,
}: CourseCardProps) {
  const isEnrolled = !!enrollment;
  const isCompleted = enrollment?.status === "completed";
  const categoryMeta =
    CATEGORY_META[course.category as keyof typeof CATEGORY_META] ??
    CATEGORY_META.debate;
  const Icon = categoryMeta.icon;
  const ctaLabel = isCompleted
    ? completedLabel
    : isEnrolled
      ? continueLabel
      : startLabel;

  return (
    <Link href={`/courses/${course.slug}`} className="block h-full">
      <article className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 soft-shadow">
        <div className="relative aspect-[16/10] overflow-hidden">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
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
            <Badge
              variant="outline"
              className={cn(
                "border-white/20 bg-white/10 text-white backdrop-blur-sm",
                DIFFICULTY_COLORS[course.difficulty]
              )}
            >
              {difficultyLabel}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/20 bg-white/10 text-white backdrop-blur-sm"
            >
              {categoryLabel}
            </Badge>
            {isCompleted && (
              <Badge
                variant="outline"
                className="border-emerald-300/30 bg-emerald-500/15 text-emerald-50 backdrop-blur-sm"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {completedLabel}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h3 className="text-lg font-semibold text-on-surface transition-colors group-hover:text-primary">
            {course.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-on-surface-variant">
            {course.description || descriptionFallbackLabel}
          </p>

          <div className="mt-5 flex items-center gap-4 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {course.estimated_hours}h
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {categoryLabel}
            </span>
          </div>

          <div className="mt-auto pt-6">
            {isEnrolled && !isCompleted ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span>{progressLabel}</span>
                  <span>{enrollment.progress_percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${enrollment.progress_percent}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-sm font-medium text-on-surface transition-colors group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary">
              <span>{ctaLabel}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
