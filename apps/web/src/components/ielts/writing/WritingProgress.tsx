"use client";

/**
 * Minimum-length meter for a Writing task: word count vs the recommended
 * minimum (150 / 250). Workbench register — one line of metadata, a thin bar.
 */
import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { writingProgressPercent } from "./writing-part";

export function WritingProgress({
  words,
  minWords,
  className,
}: {
  words: number;
  minWords: number;
  className?: string;
}) {
  const t = useTranslations("ielts.player.writing");
  const met = words >= minWords;
  const percent = writingProgressPercent(words, minWords);
  const valueText = t("minWords", { count: words, min: minWords });

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="type-caption tabular-nums text-on-surface-variant">
          {valueText}
        </span>
        {met ? (
          <span className="inline-flex items-center gap-1 type-caption font-medium text-success">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {t("minWordsMet")}
          </span>
        ) : null}
      </div>
      <Progress
        value={percent}
        tone={met ? "success" : "primary"}
        getAriaValueText={() => valueText}
        aria-label={t("minWords", { count: words, min: minWords })}
      />
    </div>
  );
}
