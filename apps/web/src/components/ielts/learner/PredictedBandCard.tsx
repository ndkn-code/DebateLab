"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "@/components/ui/icons";
import {
  Bar,
  BarChart,
  BarYAxis,
  ChartTooltip,
  Grid,
  Ring,
  RingCenter,
  RingChart,
} from "@/components/charts";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBand } from "@/lib/ielts/learner/summary";
import type {
  IeltsPredictionCardView,
  IeltsPredictionSkillRow,
} from "@/lib/ielts/home/prediction-card";
import type { IeltsHomePlanSummary } from "@/lib/ielts/home/plan-summary";
import { IELTS_SKILL_ICON } from "./skill-icon";

const CONFIDENCE_LEVEL: Record<
  IeltsPredictionCardView["overall"]["status"],
  "low" | "medium" | "high"
> = {
  diagnostic_needed: "low",
  low_confidence: "low",
  medium_confidence: "medium",
  high_confidence: "high",
};

type SkillBandDatum = {
  label: string;
  band: number;
  target: number;
  displayBand: string;
  hasEvidence: boolean;
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

function SkillBandTooltip({ point }: { point: Record<string, unknown> }) {
  const label = typeof point.label === "string" ? point.label : "Skill";
  const displayBand =
    typeof point.displayBand === "string" ? point.displayBand : formatBand(null);
  const target = typeof point.target === "number" ? point.target : 0;
  const hasEvidence = Boolean(point.hasEvidence);

  return (
    <div className="min-w-40 px-3 py-2.5">
      <p className="type-caption font-semibold uppercase text-chart-tooltip-muted">
        {label}
      </p>
      <p className="mt-1 type-body-sm font-semibold text-chart-tooltip-foreground">
        {hasEvidence ? displayBand : "No evidence yet"}
      </p>
      <p className="mt-1 type-caption text-chart-tooltip-muted">
        Target {formatBand(target)}
      </p>
    </div>
  );
}

function SkillBandChart({
  skills,
  targetBand,
}: {
  skills: IeltsPredictionSkillRow[];
  targetBand: number;
}) {
  const t = useTranslations("dashboard.ielts");
  const data: SkillBandDatum[] = skills.map((row) => ({
    label: t(`skill_${row.skill}`),
    band: row.band ?? 0,
    target: targetBand,
    displayBand: formatBand(row.band),
    hasEvidence: row.hasEvidence,
  }));

  return (
    <div className="h-56">
      <BarChart
        aspectRatio="unset"
        className="h-full"
        data={data}
        margin={{ top: 12, right: 20, bottom: 12, left: 92 }}
        orientation="horizontal"
        stacked={false}
        xDataKey="label"
      >
        <Grid horizontal={false} vertical />
        <Bar dataKey="band" fill="var(--chart-line-primary)" lineCap="round" />
        <Bar dataKey="target" fill="var(--chart-line-secondary)" lineCap="round" />
        <BarYAxis />
        <ChartTooltip
          content={({ point }) => <SkillBandTooltip point={point} />}
          showCrosshair={false}
          showDatePill={false}
          showDots={false}
        />
      </BarChart>
    </div>
  );
}

function SkillRow({ row }: { row: IeltsPredictionSkillRow }) {
  const t = useTranslations("dashboard.ielts");
  const Icon = IELTS_SKILL_ICON[row.skill];
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="truncate type-body-sm font-medium text-on-surface">
          {t(`skill_${row.skill}`)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-right">
        {row.hasEvidence ? (
          <TrendChip direction={row.trend} />
        ) : (
          <span className="type-caption text-on-surface-variant">
            {t("skill_no_evidence")}
          </span>
        )}
        <span className="min-w-9 type-title font-semibold tabular-nums text-on-surface">
          {formatBand(row.band)}
        </span>
      </div>
    </div>
  );
}

function targetCaption(
  t: ReturnType<typeof useTranslations>,
  overall: IeltsPredictionCardView["overall"],
): string {
  if (overall.targetDelta === null) return t("target_band_label", { band: formatBand(overall.targetBand) });
  if (overall.meetsTarget) return t("target_on_track");
  return t("target_gap", { gap: Math.abs(overall.targetDelta).toFixed(1) });
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
              <span className="type-body-sm font-medium text-on-surface-variant">
                {targetCaption(t, overall)}
              </span>
              {countdown ? (
                <span className="type-body-sm text-on-surface-variant">· {countdown}</span>
              ) : null}
              <TrendChip direction={overall.trend} />
            </div>
          </div>
          <SkillBandChart skills={view.skills} targetBand={overall.targetBand} />
          <div className="grid gap-2 sm:grid-cols-2">
            {view.skills.map((row) => (
              <SkillRow key={row.skill} row={row} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
