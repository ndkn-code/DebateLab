"use client";

import { Link } from "@/i18n/navigation";
import {
  BarChart3,
  Layers3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CourseArtwork,
  resolveCourseArtworkVariant,
} from "@/components/courses/course-artwork";
import type { CourseLibraryItem } from "@/lib/api/courses";

const STATUS_BADGE_STYLES = {
  "in-progress": "bg-white text-[#4d86f7]",
  "not-started": "bg-white/92 text-[#7f8ea6]",
  completed: "bg-white text-[#2ca655]",
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
    <div className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white shadow-[0_14px_28px_-20px_rgba(31,55,113,0.42)]">
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
          stroke="#4d86f7"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold text-[#316bdc]">
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
      ? "border border-[#9fc0ff] bg-white text-[#3c74e3]"
      : "bg-[#4d86f7] text-white";

  const cardContent = (
    <article
      className={cn(
        "flex h-full flex-col rounded-[18px] border bg-white shadow-[0_18px_44px_-34px_rgba(31,55,113,0.34)] transition-all duration-200",
        course.status === "in-progress"
          ? "border-[#89b0ff] shadow-[0_20px_46px_-32px_rgba(77,134,247,0.42)]"
          : "border-[#dfe8f8]",
        !isMock && "hover:-translate-y-0.5 hover:border-[#89b0ff]"
      )}
    >
      <div className="relative mx-3 mt-3 overflow-hidden rounded-[14px]">
        <div className="aspect-[1.82/1]">
          <CourseArtwork variant={artworkVariant} />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1835]/28 via-transparent to-transparent" />

        <div
          className={cn(
            "absolute left-3 top-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-[0_10px_18px_-14px_rgba(12,27,62,0.4)]",
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
        <h3 className="text-[1.18rem] font-semibold tracking-[-0.03em] text-[#14244a]">
          {course.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-[15px] leading-8 text-[#66758d]">
          {course.description || descriptionFallbackLabel}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#718096]">
            <span className="inline-flex items-center gap-1.5">
              <Layers3 className="h-3.5 w-3.5 text-[#7c8faa]" />
              {modulesCountLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-[#7c8faa]" />
              {difficultyLabel}
            </span>
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 rounded-[10px] px-4 py-2 text-[13px] font-semibold shadow-[0_14px_24px_-18px_rgba(77,134,247,0.45)]",
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
