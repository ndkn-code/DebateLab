"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "@/components/ui/icons";
import { Text } from "@/components/ui/typography";
import { getStringValue, setValue } from "@/lib/ielts/question-types";
import { cn } from "@/lib/utils";
import type { IeltsRendererProps } from "./types";
import { QuestionShell } from "./QuestionShell";

/**
 * matching_headings / matching_information / matching_features — match each
 * statement (`question.items`) to one entry in the shared option bank
 * (`question.options`). Each item is its own blank, graded independently.
 */
export function MatchingRenderer({
  question,
  value,
  onChange,
  disabled,
  verdict,
}: IeltsRendererProps) {
  const t = useTranslations("ielts.player");
  const locked = disabled || verdict != null;

  return (
    <QuestionShell instructions={question.groupInstructions} prompt={question.prompt}>
      {/* Shared option bank */}
      <ul className="flex flex-col gap-1.5 rounded-2xl bg-surface-container p-4">
        {question.options.map((option) => (
          <li key={option.id} className="flex gap-2">
            <Text variant="body-sm" className="font-bold text-on-surface">
              {option.label}
            </Text>
            <Text variant="body-sm" className="text-on-surface-variant">
              {option.text}
            </Text>
          </li>
        ))}
      </ul>

      {/* One row per statement to match */}
      <div className="flex flex-col gap-3">
        {question.items.map((item) => {
          const chosen = getStringValue(value, item.id);
          const itemVerdict = verdict?.blanks[item.id];
          return (
            <div
              key={item.id}
              className="grid gap-3 rounded-2xl border border-outline-variant bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center"
            >
              <div className="flex min-w-0 gap-3">
                {item.label ? (
                  <Text
                    variant="body-sm"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container font-bold text-on-surface-variant"
                  >
                    {item.label}
                  </Text>
                ) : null}
                <Text variant="body" className="min-w-0 flex-1 text-on-surface">
                  {item.text}
                </Text>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={item.text}
                  disabled={locked}
                  value={chosen}
                  onChange={(event) => onChange(setValue(value, item.id, event.target.value))}
                  className={cn(
                    "h-11 min-w-0 flex-1 rounded-xl border-2 border-outline-variant bg-surface px-3 text-sm text-on-surface",
                    "focus:border-primary focus:outline-none disabled:cursor-default",
                  )}
                >
                  <option value="">{t("matchSelect")}</option>
                  {question.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {itemVerdict ? (
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      itemVerdict.correct
                        ? "bg-success text-on-success"
                        : "bg-error text-on-error",
                    )}
                  >
                    {itemVerdict.correct ? <Check className="size-4" /> : <X className="size-4" />}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </QuestionShell>
  );
}
