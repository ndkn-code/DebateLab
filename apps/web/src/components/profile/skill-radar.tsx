"use client";

import { useTranslations } from "next-intl";
import { Brain } from "@/components/ui/icons";
import {
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
} from "@/components/charts";
import type { SkillData } from "./profile-content";

interface SkillRadarProps {
  skills: SkillData;
}

export function SkillRadar({ skills }: SkillRadarProps) {
  const t = useTranslations("dashboard.profile");
  const hasEnoughData = skills.total_sessions >= 3;

  const metrics = [
    { key: "content", label: t("skill_content") },
    { key: "structure", label: t("skill_structure") },
    { key: "language", label: t("skill_language") },
    { key: "persuasion", label: t("skill_persuasion") },
  ];
  const data = [
    {
      label: t("skill_breakdown"),
      values: {
        content: Math.round(skills.content),
        structure: Math.round(skills.structure),
        language: Math.round(skills.language),
        persuasion: Math.round(skills.persuasion),
      },
      color: "var(--chart-line-primary)",
    },
  ];

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-token-card md:p-6">
      <h2 className="mb-4 text-base font-semibold text-on-surface">
        {t("skill_breakdown")}
      </h2>

      {!hasEnoughData ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container">
            <Brain className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-on-surface-variant">
            {t("skill_empty")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("skill_min_sessions")}
          </p>
        </div>
      ) : (
        <div className="flex h-64 w-full items-center justify-center">
          <RadarChart data={data} metrics={metrics} size={240}>
            <RadarGrid />
            <RadarAxis />
            <RadarLabels fontSize={11} offset={18} />
            <RadarArea index={0} color="var(--chart-line-primary)" />
          </RadarChart>
        </div>
      )}
    </div>
  );
}
