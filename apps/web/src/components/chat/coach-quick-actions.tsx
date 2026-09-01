"use client";

import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Lightbulb,
  MessageSquareText,
  Scale,
  Sparkles,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { PracticeTrack } from "@/types";

export type CoachQuickActionVariant =
  | "general"
  | "dashboard"
  | "course"
  | PracticeTrack;

interface CoachQuickActionsProps {
  variant?: CoachQuickActionVariant;
  onSelect: (prompt: string) => void;
  className?: string;
  compact?: boolean;
  layout?: "pills" | "cards";
  prompts?: string[];
  disabled?: boolean;
}

const ACTIONS_BY_VARIANT = {
  general: ["debate_stance", "weighing", "clearer_english", "stronger_opening"],
  dashboard: [
    "speech_structure",
    "debate_stance",
    "weighing",
    "clearer_english",
  ],
  debate: ["debate_stance", "weighing", "rebuild_argument", "test_assumptions"],
  speaking: [
    "clearer_english",
    "speech_structure",
    "stronger_opening",
    "sound_confident",
  ],
  course: ["lesson_key_idea", "lesson_examples", "lesson_quiz", "lesson_drill"],
} as const;

const QUICK_ACTION_ICONS = [
  MessageSquareText,
  Scale,
  Lightbulb,
  Sparkles,
] as const;

export function CoachQuickActions({
  variant = "general",
  onSelect,
  className,
  compact = false,
  layout = "pills",
  prompts,
  disabled = false,
}: CoachQuickActionsProps) {
  const t = useTranslations("dashboard.chat.quick_actions");
  const actionKeys = ACTIONS_BY_VARIANT[variant];
  const translate = (key: string) => t(key as never);

  return (
    <div
      className={cn(
        layout === "cards"
          ? "grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2"
          : "flex flex-wrap gap-2",
        className,
      )}
    >
      {actionKeys.map((actionKey, index) => {
        const Icon = QUICK_ACTION_ICONS[index % QUICK_ACTION_ICONS.length];
        const prompt = prompts?.[index] ?? translate(`${actionKey}.prompt`);

        return (
          <button
            key={actionKey}
            disabled={disabled}
            onClick={() => onSelect(prompt)}
            className={cn(
              layout === "cards"
                ? "group flex min-h-[58px] items-center justify-between gap-3 rounded-control border border-outline-variant/25 bg-surface px-3.5 py-3 text-left text-sm font-medium text-on-surface shadow-token-card transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-60"
                : "rounded-control border border-outline-variant bg-surface-container-lowest px-3 py-2 text-left type-label font-medium text-on-surface-variant transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-on-surface disabled:pointer-events-none disabled:opacity-60",
              compact && "px-3 py-1.5 text-xs",
            )}
          >
            {layout === "cards" ? (
              <>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">
                    {translate(`${actionKey}.label`)}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-on-surface-variant/55 transition-transform group-hover:translate-x-0.5" />
              </>
            ) : (
              translate(`${actionKey}.label`)
            )}
          </button>
        );
      })}
    </div>
  );
}
