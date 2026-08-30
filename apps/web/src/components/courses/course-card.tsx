"use client";

import { Link } from "@/i18n/navigation";
import {
  BarChart3,
  Layers3,
} from "@/components/ui/icons";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import {
  CourseArtwork,
  resolveCourseArtworkVariant,
} from "@/components/courses/course-artwork";
import type { CourseLibraryItem } from "@/lib/api/courses";

const STATUS_BADGE_STYLES = {
  "in-progress": "bg-white text-primary",
  "not-started": "bg-white/92 text-on-surface-variant",
  completed: "bg-white text-on-surface-variant",
} as const;

interface CourseCardProps {
  course: CourseLibraryItem;
  statusLabel: string;
  difficultyLabel: string;
  descriptionFallbackLabel: string;
  startLabel: string;
  continueLabel: string;
  reviewLabel: string;
  modulesCountLabel: string;
}

function ProgressRing({ progress }: { progress: number }) {
  const size = 52;
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);

  return (
    <div className="relative flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-outline-variant bg-white">
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-container-high)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="type-caption absolute font-semibold text-on-surface-variant">
        {progress}%
      </span>
    </div>
  );
}

export function CourseCard({
  course,
  statusLabel,
  difficultyLabel,
  descriptionFallbackLabel,
  startLabel,
  continueLabel,
  reviewLabel,
  modulesCountLabel,
}: CourseCardProps) {
  const isMock = course.isMock === true;
  const artworkVariant = resolveCourseArtworkVariant(course);
  const ctaLabel =
    course.status === "completed"
      ? reviewLabel
      : course.status === "in-progress"
        ? continueLabel
        : startLabel;
  const actionClasses =
    course.status === "not-started"
      ? "border border-outline-variant bg-white text-on-surface-variant"
      : "bg-primary text-white";

  const cardContent = (
    <article
      className={cn(
        "flex h-full flex-col rounded-[10px] border bg-white shadow-none transition-[border-color,background-color,transform] duration-150",
        course.status === "in-progress"
          ? "border-primary/50"
          : "border-outline-variant",
        !isMock && "hover:-translate-y-0.5 hover:border-primary/40"
      )}
    >
      <div className="relative mx-3 mt-3 overflow-hidden rounded-[14px]">
        <div className="aspect-[1.82/1]">
          <CourseArtwork variant={artworkVariant} />
        </div>

        <div className="absolute inset-0 bg-surface-container/20" />

        <div
          className={cn(
            "type-caption absolute left-3 top-3 inline-flex h-5 items-center rounded-[6px] px-2 font-medium",
            STATUS_BADGE_STYLES[course.status]
          )}
        >
          {statusLabel}
        </div>

        {course.status !== "not-started" ? (
          <div className="absolute right-3 top-3">
            <ProgressRing progress={course.progressPercent} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
        <Heading level={4} as="h3" className="text-on-surface-variant">
          {course.title}
        </Heading>
        <Text className="mt-2 line-clamp-2 leading-8 text-on-surface-variant">
          {course.description || descriptionFallbackLabel}
        </Text>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div className="type-caption flex flex-wrap items-center gap-4 text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <Layers3 className="h-3.5 w-3.5 text-on-surface-variant" />
              {modulesCountLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-on-surface-variant" />
              {difficultyLabel}
            </span>
          </div>

          <span
            className={cn(
              "type-label inline-flex h-8 shrink-0 items-center rounded-[10px] px-3",
              actionClasses
            )}
          >
            {ctaLabel}
          </span>
        </div>
      </div>
    </article>
  );

  return isMock ? (
    cardContent
  ) : (
    <Link href={course.ctaHref} className="block h-full">
      {cardContent}
    </Link>
  );
}
