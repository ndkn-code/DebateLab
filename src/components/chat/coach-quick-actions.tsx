"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { PracticeTrack } from "@/types";

type CoachQuickActionVariant = "general" | "course" | PracticeTrack;

interface CoachQuickActionsProps {
  variant?: CoachQuickActionVariant;
  onSelect: (prompt: string) => void;
  className?: string;
  compact?: boolean;
}

const ACTIONS_BY_VARIANT = {
  general: [
    "debate_stance",
    "weighing",
    "clearer_english",
    "stronger_opening",
  ],
  debate: [
    "debate_stance",
    "weighing",
    "rebuild_argument",
    "test_assumptions",
  ],
  speaking: [
    "clearer_english",
    "speech_structure",
    "stronger_opening",
    "sound_confident",
  ],
  course: [
    "lesson_key_idea",
    "lesson_examples",
    "lesson_quiz",
    "lesson_drill",
  ],
} as const;

export function CoachQuickActions({
  variant = "general",
  onSelect,
  className,
  compact = false,
}: CoachQuickActionsProps) {
  const t = useTranslations("dashboard.chat.quick_actions");
  const actionKeys = ACTIONS_BY_VARIANT[variant];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {actionKeys.map((actionKey) => (
        <button
          key={actionKey}
          onClick={() => onSelect(t(`${actionKey}.prompt`))}
          className={cn(
            "rounded-full border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-left text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-on-surface",
            compact && "px-3 py-1.5 text-xs"
          )}
        >
          {t(`${actionKey}.label`)}
        </button>
      ))}
    </div>
  );
}
