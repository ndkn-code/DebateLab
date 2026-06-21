"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Check, Clock3, Play, Sparkles } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LearnLesson } from "@/lib/ielts/learner/learn-path";

const KNOWN_ACTIVITY_TYPES = new Set([
  "ielts_vocab_collocation",
  "ielts_paraphrase_transform",
  "ielts_gap_fill",
]);

/** A single lesson node inside a unit. */
export function LessonRow({ lesson, index }: { lesson: LearnLesson; index: number }) {
  const t = useTranslations("dashboard.ielts.learn");
  const typeLabel = KNOWN_ACTIVITY_TYPES.has(lesson.activityType)
    ? t(`activity.${lesson.activityType}`)
    : t("activity.generic");

  return (
    <Link
      href={lesson.href}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border bg-surface-container p-4 transition-all hover:-translate-y-0.5 hover:shadow-token-card",
        lesson.isRecommended ? "border-primary" : "border-outline-variant hover:border-primary",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-2xl type-body-sm font-bold tabular-nums",
          lesson.isCompleted
            ? "bg-success-container text-success-dim"
            : lesson.isRecommended
              ? "bg-primary text-on-primary"
              : "bg-surface-container-high text-on-surface-variant",
        )}
      >
        {lesson.isCompleted ? (
          <Check className="size-5" />
        ) : lesson.isRecommended ? (
          <Play className="size-4" />
        ) : (
          index + 1
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="type-body font-semibold text-on-surface">{lesson.title}</h3>
          {lesson.isRecommended ? (
            <Badge variant="primary">
              <Sparkles className="size-3" />
              {t("recommended_badge")}
            </Badge>
          ) : null}
          {lesson.isCompleted && lesson.scorePercent !== null ? (
            <Badge variant="success">{t("score_value", { count: lesson.scorePercent })}</Badge>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 type-caption text-on-surface-variant">
          <span>{typeLabel}</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3" />
            {t("minutes", { count: lesson.estimatedMinutes })}
          </span>
        </div>
      </div>

      <ArrowRight className="size-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
