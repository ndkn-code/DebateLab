"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { Brain } from "lucide-react";
import type { SkillData } from "./profile-content";

interface SkillRadarProps {
  skills: SkillData;
}

export function SkillRadar({ skills }: SkillRadarProps) {
  const hasEnoughData = skills.total_sessions >= 3;

  const data = [
    { skill: "Content", value: Math.round(skills.content) },
    { skill: "Structure", value: Math.round(skills.structure) },
    { skill: "Language", value: Math.round(skills.language) },
    { skill: "Persuasion", value: Math.round(skills.persuasion) },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        Skill Breakdown
      </h2>

      {!hasEnoughData ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
            <Brain className="h-6 w-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            Complete a few debates to see your skill profile!
          </p>
          <p className="mt-1 text-xs text-gray-400">
            At least 3 sessions needed
          </p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="skill"
                tick={{ fill: "#6b7280", fontSize: 13, fontWeight: 500 }}
              />
              <Radar
                name="Skills"
                dataKey="value"
                stroke="#2f4fdd"
                fill="#2f4fdd"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
