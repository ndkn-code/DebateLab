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
  clarity: "bg-primary",
  logic: "bg-[#4E72F5]",
  rebuttal: "bg-[#F59E0B]",
  evidence: "bg-[#22C55E]",
  delivery: "bg-[#8B5CF6]",
} as const;

const LABEL_POSITIONS = [
  { x: 110, y: 16, textAnchor: "middle" as const },
  { x: 210, y: 88, textAnchor: "start" as const },
  { x: 172, y: 202, textAnchor: "start" as const },
  { x: 48, y: 202, textAnchor: "end" as const },
  { x: 12, y: 88, textAnchor: "end" as const },
];

function pointForValue(index: number, value: number) {
  const centerX = 110;
  const centerY = 110;
  const radius = 72 * (value / 5);
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
      <div className="grid gap-6 p-5 md:grid-cols-[260px_minmax(0,1fr)] md:p-6">
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
            <svg
              viewBox="0 0 220 220"
              className="mx-auto block h-[220px] w-[220px]"
              aria-hidden="true"
            >
              {[1, 2, 3, 4].map((step) => {
                const ringValue = (5 / 4) * step;
                return (
                  <polygon
                    key={step}
                    points={polygonPoints(Array(5).fill(ringValue))}
                    fill={step % 2 === 0 ? "rgba(77,134,247,0.04)" : "transparent"}
                    stroke="rgba(77,134,247,0.14)"
                    strokeWidth="1"
                  />
                );
              })}

              {values.map((_, index) => {
                const start = pointForValue(index, 5);
                return (
                  <line
                    key={index}
                    x1="110"
                    y1="110"
                    x2={start.x}
                    y2={start.y}
                    stroke="rgba(77,134,247,0.18)"
                    strokeWidth="1"
                  />
                );
              })}

              <polygon
                points={polygonPoints(values)}
                fill="rgba(77,134,247,0.18)"
                stroke="rgba(47,79,221,0.95)"
                strokeWidth="2"
              />

              {snapshot.metrics.map((metric, index) => {
                const point = pointForValue(index, metric.value);
                return (
                  <circle
                    key={metric.key}
                    cx={point.x}
                    cy={point.y}
                    r="3.2"
                    fill="rgba(47,79,221,1)"
                  />
                );
              })}

              {snapshot.metrics.map((metric, index) => {
                const position = LABEL_POSITIONS[index];
                return (
                  <text
                    key={`${metric.key}-label`}
                    x={position.x}
                    y={position.y}
                    textAnchor={position.textAnchor}
                    className="fill-[#51617f] text-[12px] font-medium"
                  >
                    {t(`skill_labels.${metric.key}`)}
                  </text>
                );
              })}
            </svg>
          )}
        </div>

        <div className="flex flex-col">
          <div className="space-y-4">
            {snapshot.metrics.map((metric) => (
              <div
                key={metric.key}
                className="flex items-center justify-between gap-4 rounded-[1.1rem] border border-outline-variant/10 bg-surface-container-low px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${SKILL_COLORS[metric.key]}`}
                  />
                  <span className="text-sm font-medium text-on-surface">
                    {t(`skill_labels.${metric.key}`)}
                  </span>
                </div>
                <span className="text-base font-semibold text-on-surface">
                  {metric.value.toFixed(1)} <span className="text-sm text-on-surface-variant">/ 5</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-outline-variant/10 bg-surface-container-low px-4 py-3">
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
