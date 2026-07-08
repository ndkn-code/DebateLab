"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "@/components/ui/icons";
import { Ring, RingCenter, RingChart } from "@/components/charts";
import { buttonVariants } from "@/components/ui/button";
import { BandMeter } from "@/components/ielts/band-visuals";
import { cn } from "@/lib/utils";
import { formatBand } from "@/lib/ielts/learner/summary";
import type {
  IeltsPredictionCardView,
  IeltsPredictionSkillRow,
} from "@/lib/ielts/home/prediction-card";
import type { IeltsHomePlanSummary } from "@/lib/ielts/home/plan-summary";

const CONFIDENCE_LEVEL: Record<
  IeltsPredictionCardView["overall"]["status"],
  "low" | "medium" | "high"
> = {
  diagnostic_needed: "low",
  low_confidence: "low",
  medium_confidence: "medium",
  high_confidence: "high",
};

function TrendChip({ direction }: { direction: IeltsPredictionSkillRow["trend"] }) {
  const t = useTranslations("dashboard.ielts");
  if (direction === "unknown") return null;
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const tone =
    direction === "up"
      ? "text-success"
      : direction === "down"
        ? "text-error"
        : "text-on-surface-variant";
  return (
    <span className={cn("inline-flex items-center gap-1 type-caption font-medium", tone)}>
      <Icon className="size-3.5" aria-hidden />
      {t(`trend_${direction}`)}
    </span>
  );
}

function SkillStatus({ row }: { row: IeltsPredictionSkillRow }) {
  const t = useTranslations("dashboard.ielts");
  if (row.hasEvidence) return <TrendChip direction={row.trend} />;
  return (
    <span className="type-caption text-on-surface-variant">
      {t("skill_no_evidence")}
    </span>
  );
}

/**
 * Target status. When the learner is behind target we surface a warm coral
 * "focus" pill (secondary) so the eye lands on the gap to close; on-track and
 * no-target states stay quiet (a prediction card shouldn't shout when good).
 */
function TargetChip({
  overall,
}: {
  overall: IeltsPredictionCardView["overall"];
}) {
  const t = useTranslations("dashboard.ielts");
  if (overall.targetDelta === null) {
    return (
      <span className="type-body-sm font-medium text-on-surface-variant">
        {t("target_band_label", { band: formatBand(overall.targetBand) })}
      </span>
    );
  }
  if (overall.meetsTarget) {
    return (
      <span className="type-body-sm font-semibold text-success">
        {t("target_on_track")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 type-caption font-semibold text-on-secondary-container">
      {t("target_gap", { gap: Math.abs(overall.targetDelta).toFixed(1) })}
    </span>
  );
}

function countdownCaption(
  t: ReturnType<typeof useTranslations>,
  planSummary: IeltsHomePlanSummary | null,
): string | null {
  const days = planSummary?.testDateInDays;
  if (days === null || days === undefined) return null;
  if (days < 0) return t("test_passed");
  if (days === 0) return t("test_today");
  return t("test_countdown", { days });
}

/**
 * The learner's predicted-band card (WS-6.2.1): overall estimate with a
 * confidence range + trend + gap-to-target, and a per-skill breakdown.
 * Diagnostic-first — until there's real evidence it shows a "start diagnostic"
 * prompt instead of a band (phase-6-synthesis §2). Styled as an *estimate*
 * (`primary-container`, not the solid `primary` of an official result) so a
 * prediction is never mistaken for a graded band.
 */
export function PredictedBandCard({
  view,
  planSummary,
  diagnosticReady,
}: {
  view: IeltsPredictionCardView;
  planSummary: IeltsHomePlanSummary | null;
  diagnosticReady: boolean;
}) {
  const t = useTranslations("dashboard.ielts");
  const locale = useLocale();

  if (view.isDiagnosticFirst) {
    const reason =
      (locale === "vi"
        ? view.nextBestDiagnostic.reasonVi
        : view.nextBestDiagnostic.reasonEn) || t("hero_diagnostic_first");
    return (
      <section className="rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="type-eyebrow font-semibold uppercase text-primary">
              {t("predicted_title")}
            </p>
            <h2 className="mt-1 type-heading-md font-bold text-balance text-on-surface">
              {t("predicted_diagnostic_title")}
            </h2>
            <p className="mt-2 max-w-prose type-body-sm text-on-surface-variant">
              {reason}
            </p>
          </div>
          <Link
            href="/ielts/onboarding"
            className={cn(buttonVariants({ variant: "primary" }), "shrink-0")}
          >
            {diagnosticReady ? t("cta_start_diagnostic") : t("cta_view_plan")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    );
  }

  const overall = view.overall;
  const countdown = countdownCaption(t, planSummary);
  const ringData = [
    {
      label: t("predicted_title"),
      value: overall.band ?? 0,
      maxValue: 9,
      color: "var(--chart-line-primary)",
    },
  ];

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary-container p-6 text-center text-on-primary-container lg:w-64 lg:shrink-0">
          <span className="type-caption font-semibold uppercase text-on-primary-container">
            {t("predicted_title")}
          </span>
          <RingChart
            baseInnerRadius={48}
            data={ringData}
            size={176}
            strokeWidth={14}
          >
            <Ring index={0} />
            <RingCenter
              defaultLabel="Band"
              formatOptions={{
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              }}
              labelClassName="type-caption font-semibold text-on-primary-container"
              valueClassName="type-heading-xl font-bold tabular-nums text-on-primary-container"
            />
          </RingChart>
          {overall.rangeLabel ? (
            <span className="type-body-sm font-medium text-on-primary-container">
              {t("predicted_range", { range: overall.rangeLabel })}
            </span>
          ) : null}
          <span className="type-caption text-on-primary-container">
            {t(`confidence_level_${CONFIDENCE_LEVEL[overall.status]}`)} ·{" "}
            {t("prediction_confidence", { count: overall.confidencePercent })}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="type-heading-md font-semibold text-on-surface">
              {t("per_skill_title")}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <TargetChip overall={overall} />
              {countdown ? (
                <span className="type-body-sm text-on-surface-variant">· {countdown}</span>
              ) : null}
              <TrendChip direction={overall.trend} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {view.skills.map((row, index) => (
              <BandMeter
                accent={row.skill}
                band={row.band}
                className="bg-surface"
                delayMs={index * 60}
                key={row.skill}
                skill={t(`skill_${row.skill}`)}
                status={<SkillStatus row={row} />}
                target={overall.targetBand}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
