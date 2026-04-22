"use client";

import { Info, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DashboardSkillSnapshot } from "@/lib/api/dashboard";

const SKILL_COLORS = {
  clarity: "bg-[#3E78EC]",
  logic: "bg-[#4D86F7]",
  rebuttal: "bg-[#F5B942]",
  evidence: "bg-[#34C759]",
  delivery: "bg-[#7B61FF]",
} as const;

const CHART_SIZE = 360;
const CHART_CENTER = CHART_SIZE / 2;
const CHART_MAX_RADIUS = 118;

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
  const radius = CHART_MAX_RADIUS * (value / 5);
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
}: {
  snapshot: DashboardSkillSnapshot;
}) {
  const t = useTranslations("dashboard.home");
  const values = snapshot.metrics.map((metric) => metric.value);

  return (
    <section className="rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-lowest shadow-[0_28px_80px_-52px_rgba(22,39,91,0.45)]">
      <div className="grid gap-6 p-5 md:grid-cols-[minmax(320px,1.08fr)_minmax(280px,0.92fr)] md:gap-7 md:p-6">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-on-surface">
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
          </div>

          {snapshot.sourceSessions === 0 ? (
            <div className="flex h-[220px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-5 text-center">
              <p className="text-sm font-medium text-on-surface">
                {t("skill_snapshot_empty_title")}
              </p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {t("skill_snapshot_empty_body")}
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <svg
                viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
                className="mx-auto block h-[336px] w-full max-w-[380px]"
                aria-hidden="true"
              >
                {[1, 2, 3, 4].map((step) => {
                  const ringValue = (5 / 4) * step;
                  return (
                    <polygon
                      key={step}
                      points={polygonPoints(Array(5).fill(ringValue))}
                      fill={step % 2 === 0 ? "rgba(169,198,251,0.12)" : "transparent"}
                      stroke="rgba(77,134,247,0.16)"
                      strokeWidth="1"
                    />
                  );
                })}

                {values.map((_, index) => {
                  const start = pointForValue(index, 5);
                  return (
                    <line
                      key={index}
                      x1={CHART_CENTER}
                      y1={CHART_CENTER}
                      x2={start.x}
                      y2={start.y}
                      stroke="rgba(77,134,247,0.18)"
                      strokeWidth="1"
                    />
                  );
                })}

                <polygon
                  points={polygonPoints(values)}
                  fill="rgba(77,134,247,0.16)"
                  stroke="rgba(62,120,236,0.95)"
                  strokeWidth="2"
                />

                {snapshot.metrics.map((metric, index) => {
                  const point = pointForValue(index, metric.value);
                  return (
                    <circle
                      key={metric.key}
                      cx={point.x}
                      cy={point.y}
                      r="3.6"
                      fill="rgba(62,120,236,1)"
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
                      className="fill-[#415069] text-[11px] font-medium"
                    >
                      {t(`skill_labels.${metric.key}`)}
                    </text>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col md:border-l md:border-outline-variant/10 md:pl-6 md:pt-8">
          <div className="divide-y divide-outline-variant/10">
            {snapshot.metrics.map((metric) => (
              <div
                key={metric.key}
                className="flex items-center justify-between gap-4 py-4 first:pt-1"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${SKILL_COLORS[metric.key]}`}
                  />
                  <span className="text-[0.95rem] font-medium text-on-surface">
                    {t(`skill_labels.${metric.key}`)}
                  </span>
                </div>
                <p className="shrink-0 text-right">
                  <span className="text-[1.05rem] font-semibold text-on-surface">
                    {metric.value.toFixed(1)}
                  </span>
                  <span className="ml-1 text-sm text-on-surface-variant">/ 5</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/10 pt-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-on-surface">
                {t("overall_score")}
              </span>
              <span className="inline-flex items-center gap-2 text-primary">
                <Star className="h-4 w-4 fill-current" />
                <span className="text-xl font-semibold">
                  {snapshot.overallScore?.toFixed(1) ?? "—"}
                </span>
                <span className="text-sm text-on-surface-variant">/ 5</span>
              </span>
            </div>

            <Link href="/profile">
              <Button
                variant="outline"
                className="rounded-xl border-outline-variant/20 bg-surface-container-lowest"
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
