"use client";

import { curveNatural } from "@visx/curve";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  ChartTooltip,
  Grid,
  XAxis,
} from "@/components/charts";
import { ChartCard, ChartEmpty } from "@/components/data-viz";

interface Props {
  title: string;
  data: { date: string; count: number }[];
  color?: string;
}

export function TrendChart({
  title,
  data,
  color = "var(--chart-line-primary)",
}: Props) {
  const t = useTranslations("admin.overview");
  const locale = useLocale();
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date),
  }));

  return (
    <ChartCard title={title} bodyClassName="h-[220px]">
      {formatted.length === 0 ? (
        <ChartEmpty title={t("noTrendData")} />
      ) : (
        <AreaChart
          data={formatted}
          dateLabelFormatter={formatDate}
          margin={{ top: 16, right: 24, bottom: 36, left: 36 }}
          style={{ aspectRatio: "auto", height: "100%" }}
        >
          <Grid horizontal />
          <Area
            dataKey="count"
            curve={curveNatural}
            fill={color}
            fillOpacity={0.35}
            stroke={color}
            strokeWidth={2.5}
          />
          <XAxis />
          <ChartTooltip
            showDatePill={false}
            content={({ point }) => {
              const pointDate =
                point.date instanceof Date
                  ? point.date
                  : new Date(String(point.date ?? ""));
              return (
                <div className="space-y-1 px-3 py-2">
                  <p className="type-caption text-chart-tooltip-text">
                    {new Intl.DateTimeFormat(locale, {
                      weekday: "short",
                      month: "short",
                      timeZone: "UTC",
                      day: "numeric",
                      year: "numeric",
                    }).format(pointDate)}
                  </p>
                  <p className="type-label text-chart-tooltip-text">
                    {title}: {Number(point.count ?? 0).toLocaleString(locale)}
                  </p>
                </div>
              );
            }}
          />
        </AreaChart>
      )}
    </ChartCard>
  );
}
