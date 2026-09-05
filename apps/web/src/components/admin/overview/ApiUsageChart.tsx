"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  BarYAxis,
  ChartTooltip,
  Grid,
} from "@/components/charts";
import { ChartCard, ChartEmpty } from "@/components/data-viz";

const API_USAGE_COLOR = "var(--chart-line-primary)";

interface Props {
  data: { service: string; total_calls: number; total_cost: number }[];
}

export function ApiUsageChart({ data }: Props) {
  const t = useTranslations("admin.overview");
  const locale = useLocale();
  const totalCost = data.reduce((sum, d) => sum + d.total_cost, 0);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatted = data.map((d) => ({
    ...d,
    label: d.service.replace(/_/g, " "),
  }));

  return (
    <ChartCard
      title={t("apiUsage")}
      actions={
        <span className="type-caption font-medium text-on-surface-variant">
          {t("totalCost")}: {formatCurrency(totalCost)}
        </span>
      }
      bodyClassName="h-[220px]"
    >
      {data.length === 0 ? (
        <ChartEmpty title={t("noData")} />
      ) : (
        <BarChart
          data={formatted}
          xDataKey="label"
          orientation="horizontal"
          margin={{ top: 12, right: 28, bottom: 20, left: 118 }}
          aspectRatio="auto"
          className="h-full"
        >
          <Grid horizontal={false} vertical />
          <Bar dataKey="total_calls" fill={API_USAGE_COLOR} lineCap="round" />
          <BarYAxis />
          <ChartTooltip
            showDatePill={false}
            rows={(point) => [
              {
                color: API_USAGE_COLOR,
                label: t("calls"),
                value: Number(point.total_calls ?? 0).toLocaleString(locale),
              },
              {
                color: "var(--chart-line-secondary)",
                label: t("cost"),
                value: formatCurrency(Number(point.total_cost ?? 0)),
              },
            ]}
          />
        </BarChart>
      )}
    </ChartCard>
  );
}
