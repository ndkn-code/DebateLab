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
    <div className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white shadow-token-card">
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
          stroke="#e1ebfb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#00B8D9"
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
        "flex h-full flex-col rounded-[18px] border bg-white shadow-token-card transition-all duration-200",
        course.status === "in-progress"
          ? "border-outline-variant shadow-token-primary"
          : "border-outline-variant",
        !isMock && "hover:-translate-y-0.5 hover:border-outline-variant"
      )}
    >
      <div className="relative mx-3 mt-3 overflow-hidden rounded-[14px]">
        <div className="aspect-[1.82/1]">
          <CourseArtwork variant={artworkVariant} />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1835]/28 via-transparent to-transparent" />

        <div
          className={cn(
            "type-eyebrow absolute left-3 top-3 inline-flex rounded-full px-3 py-1 font-semibold shadow-token-card",
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
              "type-label inline-flex shrink-0 rounded-[10px] px-4 py-2 shadow-token-primary",
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
