"use client";

import { curveNatural } from "@visx/curve";
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

export function TrendChart({ title, data, color = "var(--chart-line-primary)" }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date),
  }));

  return (
    <ChartCard title={title} bodyClassName="h-[250px]">
      {formatted.length === 0 ? (
        <ChartEmpty title="No trend data yet" />
      ) : (
        <AreaChart
          data={formatted}
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
            rows={(point) => [
              {
                color,
                label: title,
                value: Number(point.count ?? 0),
              },
            ]}
          />
        </AreaChart>
      )}
    </ChartCard>
  );
}
