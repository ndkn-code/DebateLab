"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Check, Sparkles } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LearnUnit } from "@/lib/ielts/learner/learn-path";
import { focusFirst } from "@/lib/ielts/learner/learn-path";
import { MASTERY_BADGE_VARIANT, subskillLabel } from "./mastery-display";

/** A unit (course module) node on the Learn path home. */
export function UnitCard({ unit, index }: { unit: LearnUnit; index: number }) {
  const t = useTranslations("dashboard.ielts.learn");
  const locale = useLocale();
  const chips = focusFirst(unit.subskillMastery).slice(0, 3);

  return (
    <Link
      href={unit.href}
      className={cn(
        "group flex flex-col gap-4 rounded-3xl border bg-surface-container p-5 transition-all hover:-translate-y-0.5 hover:shadow-token-card",
        unit.isRecommended ? "border-primary" : "border-outline-variant hover:border-primary",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl type-title font-bold tabular-nums",
            unit.isComplete
              ? "bg-success-container text-success-dim"
              : "bg-primary-container text-on-primary-container",
          )}
        >
          {unit.isComplete ? <Check className="size-5" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-title font-semibold text-on-surface">{unit.title}</h3>
            {unit.isRecommended ? (
              <Badge variant="primary">
                <Sparkles className="size-3" />
                {t("recommended_badge")}
              </Badge>
            ) : null}
          </div>
          {unit.description ? (
            <p className="mt-1 type-body-sm text-on-surface-variant line-clamp-2">
              {unit.description}
            </p>
          ) : null}
        </div>
        <ArrowRight className="size-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between type-caption text-on-surface-variant">
          <span>{t("unit_lessons", { count: unit.totalCount })}</span>
          <span className="font-semibold tabular-nums">
            {unit.completedCount}/{unit.totalCount}
          </span>
        </div>
        <Progress
          value={unit.progressPercent}
          tone={unit.isComplete ? "success" : "primary"}
          aria-label={t("unit_progress", { completed: unit.completedCount, total: unit.totalCount })}
        />
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((mastery) => (
            <Badge key={mastery.key} variant={MASTERY_BADGE_VARIANT[mastery.level]}>
              {subskillLabel(mastery, locale)}
            </Badge>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
