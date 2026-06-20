"use client";

import { useTranslations } from "next-intl";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface Props {
  /** Group rubric, e.g. "Questions 1–5 · Choose NO MORE THAN TWO WORDS". */
  instructions?: string | null;
  /** The question stem; omitted by renderers whose prompt is interactive. */
  prompt?: string | null;
  /** Word cap for text answers — shows a reminder hint when set. */
  wordLimit?: number | null;
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared chrome for every IELTS question renderer: group instructions, the stem,
 * an optional word-limit reminder, then the interactive answer area. Keeps the
 * type-specific renderers thin and visually consistent.
 */
export function QuestionShell({
  instructions,
  prompt,
  wordLimit,
  className,
  children,
}: Props) {
  const t = useTranslations("ielts.player");
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {instructions ? (
        <Text variant="caption" className="text-on-surface-variant uppercase tracking-wide">
          {instructions}
        </Text>
      ) : null}
      {prompt ? (
        <Text variant="body-lg" className="text-on-surface font-semibold">
          {prompt}
        </Text>
      ) : null}
      {wordLimit != null ? (
        <Text variant="caption" className="text-on-surface-variant">
          {t("wordLimitHint", { count: wordLimit })}
        </Text>
      ) : null}
      {children}
    </div>
  );
}
