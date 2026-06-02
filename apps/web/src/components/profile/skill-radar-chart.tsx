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
          <PolarGrid stroke="#DEE8F8" />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fill: "#415069", fontSize: 13, fontWeight: 500 }}
          />
          <Radar
            name="Skills"
            dataKey="value"
            stroke="#3E78EC"
            fill="#4D86F7"
            fillOpacity={0.24}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
