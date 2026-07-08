"use client";

import { useTranslations } from "next-intl";
import {
  DEFAULT_BLANK_ID,
  getArrayValue,
  toggleArrayValue,
} from "@/lib/ielts/question-types";
import { Text } from "@/components/ui/typography";
import type { IeltsRendererProps } from "./types";
import { ChoiceTile } from "./ChoiceTile";
import { QuestionShell } from "./QuestionShell";

/**
 * mcq_multi — pick N options. Selection is capped at `selectCount` (further
 * picks are ignored until one is cleared). Review mode shows the points earned
 * for the group without revealing which options were correct.
 */
export function MultiSelectRenderer({
  question,
  value,
  onChange,
  disabled,
  verdict,
}: IeltsRendererProps) {
  const t = useTranslations("ielts.player");
  const selected = getArrayValue(value, DEFAULT_BLANK_ID);
  const max = question.selectCount ?? undefined;
  const blankVerdict = verdict?.blanks[DEFAULT_BLANK_ID];
  const locked = disabled || verdict != null;

  return (
    <QuestionShell instructions={question.groupInstructions} prompt={question.prompt}>
      {max != null ? (
        <Text variant="caption" className="text-on-surface-variant">
          {t("chooseCount", { count: max })}
        </Text>
      ) : null}
      <div role="group" className="flex flex-col gap-3">
        {question.options.map((option) => (
          <ChoiceTile
            key={option.id}
            control="checkbox"
            label={option.label}
            text={option.text}
            selected={selected.includes(option.id)}
            disabled={locked}
            allowElimination={!locked && question.questionType === "mcq_multi"}
            questionId={question.id}
            optionId={option.id}
            onSelect={() =>
              onChange(toggleArrayValue(value, DEFAULT_BLANK_ID, option.id, max))
            }
          />
        ))}
      </div>
      {blankVerdict ? (
        <Text variant="caption" className="text-on-surface-variant">
          {t("pointsAwarded", {
            awarded: blankVerdict.awarded,
            max: blankVerdict.max,
          })}
        </Text>
      ) : null}
    </QuestionShell>
  );
}
