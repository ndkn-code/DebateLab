"use client";

import { Info, Star } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { RadarArea, RadarAxis, RadarChart, RadarGrid, RadarLabels } from "@/components/charts";
import { ChartCard, ChartEmpty } from "@/components/data-viz";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SKILL_UI_META } from "@/lib/analytics/skill-metadata";
import type { DashboardSkillSnapshot } from "@/lib/api/dashboard";

export function SkillSnapshotCard({
  snapshot,
  compact = false,
}: {
  snapshot: DashboardSkillSnapshot;
  compact?: boolean;
}) {
  const t = useTranslations("dashboard.home");
  const radarMetrics = snapshot.metrics.map((metric) => ({
    key: metric.key,
    label: t(`skill_labels.${metric.key}`),
  }));
  const radarData = [
    {
      label: t("skill_snapshot_title"),
      color: "var(--chart-line-primary)",
      values: Object.fromEntries(
        snapshot.metrics.map((metric) => [
          metric.key,
          metric.coverage > 0 ? metric.value : 0,
        ])
      ),
    },
  ];

  return (
    <ChartCard className="rounded-[1.45rem] p-0 shadow-token-panel">
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
            <ChartEmpty
              title={t("skill_snapshot_empty_title")}
              description={t("skill_snapshot_empty_body")}
              className={compact ? "h-[180px] rounded-[1rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-4" : "h-[220px] rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-5"}
            />
          ) : (
            <div className={compact ? "mt-2 flex justify-center" : "mt-5 flex justify-center"}>
              <RadarChart
                data={radarData}
                metrics={radarMetrics}
                size={compact ? 232 : 312}
                margin={compact ? 46 : 58}
                className="max-w-full"
              >
                <RadarGrid stroke="var(--chart-grid)" strokeOpacity={1} />
                <RadarAxis stroke="var(--chart-grid)" strokeOpacity={1} />
                <RadarLabels fontSize={compact ? 9 : 10} offset={compact ? 16 : 20} />
                <RadarArea index={0} color="var(--chart-line-primary)" />
              </RadarChart>
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
    </ChartCard>
  );
}
