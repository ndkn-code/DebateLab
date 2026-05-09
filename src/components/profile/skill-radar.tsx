"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Brain } from "lucide-react";
import type { SkillData } from "./profile-content";

interface SkillRadarProps {
  skills: SkillData;
}

const RadarSkillChart = dynamic(
  () =>
    import("./skill-radar-chart").then((mod) => ({
      default: mod.RadarSkillChart,
    })),
  { ssr: false }
);

export function SkillRadar({ skills }: SkillRadarProps) {
  const t = useTranslations("dashboard.profile");
  const hasEnoughData = skills.total_sessions >= 3;

  const data = [
    { skill: t("skill_content"), value: Math.round(skills.content) },
    { skill: t("skill_structure"), value: Math.round(skills.structure) },
    { skill: t("skill_language"), value: Math.round(skills.language) },
    { skill: t("skill_persuasion"), value: Math.round(skills.persuasion) },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        {t("skill_breakdown")}
      </h2>

      {!hasEnoughData ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
            <Brain className="h-6 w-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            {t("skill_empty")}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {t("skill_min_sessions")}
          </p>
        </div>
      ) : (
        <RadarSkillChart data={data} />
      )}
    </div>
  );
}
