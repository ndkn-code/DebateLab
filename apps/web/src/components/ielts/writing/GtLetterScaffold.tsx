"use client";

/**
 * General Training Task 1 letter brief: the opener the learner should mirror,
 * the required register, and the bullet points as a local tick-list (state
 * never leaves the component — it is a planning aid, not an answer).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { IeltsLetterBrief } from "@/lib/ielts/question-types/metadata";
import { Badge } from "@/components/ui/badge";
import { Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { isChecklistComplete, toggleChecklistIndex } from "./writing-part";

const REGISTER_KEYS = {
  formal: "registerFormal",
  semi_formal: "registerSemiFormal",
  informal: "registerInformal",
} as const;

export function GtLetterScaffold({
  letter,
  className,
}: {
  letter: IeltsLetterBrief;
  className?: string;
}) {
  const t = useTranslations("ielts.player.writing");
  const [checked, setChecked] = useState<number[]>([]);
  const complete = isChecklistComplete(checked, letter.bullets.length);

  return (
    <section
      aria-label={t("letterChecklist")}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-body font-medium text-on-surface">
          {t("letterTo", { recipient: letter.recipient })}
        </p>
        <span className="inline-flex items-center gap-1.5">
          <span className="type-caption text-on-surface-variant">
            {t("registerLabel")}
          </span>
          <Badge variant="outline">{t(REGISTER_KEYS[letter.register])}</Badge>
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
            {t("letterChecklist")}
          </span>
          <span
            className={cn(
              "type-caption tabular-nums",
              complete ? "font-medium text-success" : "text-on-surface-variant",
            )}
          >
            {checked.length}/{letter.bullets.length}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-outline-variant">
          {letter.bullets.map((bullet, index) => {
            const done = checked.includes(index);
            return (
              <li key={index}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  onClick={() =>
                    setChecked((prev) => toggleChecklistIndex(prev, index))
                  }
                  className="flex w-full items-start gap-3 py-2 text-left transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      done
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline bg-surface",
                    )}
                  >
                    {done ? <Check className="size-3" /> : null}
                  </span>
                  <span
                    className={cn(
                      "type-body-sm",
                      done
                        ? "text-on-surface-variant line-through"
                        : "text-on-surface",
                    )}
                  >
                    {bullet}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
