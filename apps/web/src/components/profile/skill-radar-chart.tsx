"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

interface RadarSkillChartProps {
  data: Array<{ skill: string; value: number }>;
}

export function RadarSkillChart({ data }: RadarSkillChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#CDECF3" />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fill: "#657B84", fontSize: 13, fontWeight: 500 }}
          />
          <Radar
            name="Skills"
            dataKey="value"
            stroke="#0788A0"
            fill="#00B8D9"
            fillOpacity={0.24}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
