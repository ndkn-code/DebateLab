"use client";

import { Info, Star } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SKILL_UI_META } from "@/lib/analytics/skill-metadata";
import type { DashboardSkillSnapshot } from "@/lib/api/dashboard";

const CHART_SIZE = 396;
const CHART_CENTER = CHART_SIZE / 2;
const CHART_MAX_RADIUS = 130;

function labelPositionForIndex(index: number) {
  const radius = CHART_MAX_RADIUS + 30;
  const angle = -Math.PI / 2 + (index * (Math.PI * 2)) / 5;
  const x = CHART_CENTER + Math.cos(angle) * radius;
  const y = CHART_CENTER + Math.sin(angle) * radius;

  if (index === 0) return { x, y, textAnchor: "middle" as const };
  if (index === 1 || index === 2) return { x, y, textAnchor: "start" as const };
  return { x, y, textAnchor: "end" as const };
}

function pointForValue(index: number, value: number) {
  const centerX = CHART_CENTER;
  const centerY = CHART_CENTER;
  const radius = CHART_MAX_RADIUS * (value / 100);
  const angle = -Math.PI / 2 + (index * (Math.PI * 2)) / 5;

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

function polygonPoints(values: number[]) {
  return values
    .map((value, index) => {
      const point = pointForValue(index, value);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export function SkillSnapshotCard({
  snapshot,
  compact = false,
}: {
  snapshot: DashboardSkillSnapshot;
  compact?: boolean;
}) {
  const t = useTranslations("dashboard.home");
  const values = snapshot.metrics.map((metric) =>
    metric.coverage > 0 ? metric.value : 0
  );

  return (
    <section className="rounded-[1.45rem] border border-outline-variant/20 bg-surface-container-lowest shadow-token-panel">
      <div className={compact ? "grid gap-4 p-4 2xl:grid-cols-[minmax(230px,0.9fr)_minmax(220px,0.78fr)]" : "grid gap-6 p-5 md:grid-cols-[minmax(320px,1.08fr)_minmax(280px,0.92fr)] md:gap-7 md:p-6"}>
        <div>
          <div className={compact ? "mb-2 flex items-center gap-2" : "mb-3 flex items-center gap-2"}>
            <h2 className="type-title text-on-surface">
              {t("skill_snapshot_title")}
            </h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-outline-variant/20 text-on-surface-variant transition-colors hover:bg-surface-container-low">
                  <Info className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>{t("skill_snapshot_hint")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {snapshot.confidence}%
            </span>
          </div>

          {snapshot.sourceSessions === 0 ? (
            <div className={compact ? "flex h-[180px] flex-col items-center justify-center rounded-[1rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-4 text-center" : "flex h-[220px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-5 text-center"}>
              <p className="text-sm font-medium text-on-surface">
                {t("skill_snapshot_empty_title")}
              </p>
              <p className={compact ? "mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant" : "mt-2 text-sm leading-6 text-on-surface-variant"}>
                {t("skill_snapshot_empty_body")}
              </p>
            </div>
          ) : (
            <div className={compact ? "mt-2" : "mt-5"}>
              <svg
                viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
                className={compact ? "mx-auto block h-[230px] w-full max-w-[290px]" : "mx-auto block h-[370px] w-full max-w-[418px] 2xl:h-[320px] 2xl:max-w-[370px]"}
                aria-hidden="true"
              >
                {[1, 2, 3, 4].map((step) => {
                  const ringValue = 25 * step;
                  return (
                    <polygon
                      key={step}
                      points={polygonPoints(Array(5).fill(ringValue))}
                      fill={step % 2 === 0 ? "rgba(168,240,215,0.12)" : "transparent"}
                      stroke="rgba(65,80,105,0.18)"
                      strokeWidth="1"
                    />
                  );
                })}

                {values.map((_, index) => {
                  const start = pointForValue(index, 100);
                  return (
                    <line
                      key={index}
                      x1={CHART_CENTER}
                      y1={CHART_CENTER}
                      x2={start.x}
                      y2={start.y}
                      stroke="rgba(65,80,105,0.18)"
                      strokeWidth="1"
                    />
                  );
                })}

                <polygon
                  points={polygonPoints(values)}
                  fill="rgba(0,184,217,0.16)"
                  stroke="rgba(7,136,160,0.95)"
                  strokeWidth="2"
                />

                {snapshot.metrics.map((metric, index) => {
                  const point = pointForValue(
                    index,
                    metric.coverage > 0 ? metric.value : 0
                  );
                  return (
                    <circle
                      key={metric.key}
                      cx={point.x}
                      cy={point.y}
                      r="3.6"
                      fill="rgba(7,136,160,1)"
                    />
                  );
                })}

                {snapshot.metrics.map((metric, index) => {
                  const position = labelPositionForIndex(index);
                  return (
                    <text
                      key={`${metric.key}-label`}
                      x={position.x}
                      y={position.y}
                      textAnchor={position.textAnchor}
                      className="type-caption fill-primary dark:fill-on-surface-variant"
                    >
                      {t(`skill_labels.${metric.key}`)}
                    </text>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <div className={compact ? "flex flex-col 2xl:border-l 2xl:border-outline-variant/20 2xl:pl-4" : "flex flex-col md:border-l md:border-outline-variant/20 md:pl-6 md:pt-8"}>
          <div className="divide-y divide-outline-variant/18">
            {snapshot.metrics.map((metric) => (
              <div
                key={metric.key}
                className={compact ? "flex items-center justify-between gap-3 py-2.5 first:pt-0" : "flex items-center justify-between gap-4 py-4 first:pt-1"}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${SKILL_UI_META[metric.key].dotClassName}`}
                  />
                  <span className={compact ? "type-body-sm font-medium text-on-surface" : "type-body font-medium text-on-surface"}>
                    {t(`skill_labels.${metric.key}`)}
                  </span>
                </div>
                <p className="shrink-0 text-right">
                  <span className={compact ? "type-body font-semibold text-on-surface" : "type-body-lg font-semibold text-on-surface"}>
                    {metric.coverage > 0 ? Math.round(metric.value) : "—"}
                  </span>
                  {metric.coverage > 0 ? (
                    <span className="ml-1 text-sm text-on-surface-variant">/100</span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-auto border-t border-outline-variant/18 pt-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-on-surface">
                {t("overall_score")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Star className="h-4 w-4 fill-current" />
                <span className="text-xl font-semibold">
                  {snapshot.overallScore != null ? Math.round(snapshot.overallScore) : "—"}
                </span>
                <span className="text-sm text-on-surface-variant">/100</span>
              </span>
            </div>

            <Link href="/profile" className="mt-3 flex justify-end">
              <Button
                variant="outline"
                className="rounded-xl border-primary/20 bg-primary-container text-primary shadow-token-primary hover:bg-primary hover:text-on-primary dark:bg-primary-container/70"
              >
                {t("view_details")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
