"use client";

import { useLocale, useTranslations } from "next-intl";
import { TrendingUp } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { MasteryLevel, SubskillMastery } from "@/lib/ielts/learner/learn-path";
import {
  MASTERY_BADGE_VARIANT,
  MASTERY_PROGRESS_TONE,
  subskillLabel,
} from "./mastery-display";

/**
 * One explainable mastery row: subskill name, its level chip, the mastery bar,
 * and the evidence/confidence it rests on (synthesis §2 — never a bare badge).
 * `delta` adds a "+N%" change marker for the lesson completion screen.
 */
export function MasteryRow({
  mastery,
  delta,
}: {
  mastery: SubskillMastery;
  delta?: number;
}) {
  const t = useTranslations("dashboard.ielts.learn");
  const locale = useLocale();
  const level: MasteryLevel = mastery.level;
  const hasEvidence = mastery.evidenceCount > 0;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-body-sm font-semibold text-on-surface">
            {subskillLabel(mastery, locale)}
          </p>
          <p className="type-caption text-on-surface-variant">{t(`skill_${mastery.skill}`)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {delta !== undefined && delta > 0 ? (
            <span className="inline-flex items-center gap-0.5 type-caption font-bold text-success">
              <TrendingUp className="size-3.5" />
              {t("delta_up", { count: delta })}
            </span>
          ) : null}
          <Badge variant={MASTERY_BADGE_VARIANT[level]}>{t(`mastery.${level}`)}</Badge>
        </div>
      </div>

      <Progress
        value={mastery.masteryPercent}
        tone={MASTERY_PROGRESS_TONE[level]}
        aria-label={t("mastery_label")}
      />

      <p className="type-caption text-on-surface-variant">
        {hasEvidence
          ? t("mastery_evidence", {
              count: mastery.evidenceCount,
              confidence: Math.round(mastery.confidence * 100),
            })
          : t("mastery_no_evidence")}
      </p>
    </div>
  );
}
