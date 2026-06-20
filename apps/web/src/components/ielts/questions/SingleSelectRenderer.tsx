"use client";

import {
  DEFAULT_BLANK_ID,
  getStringValue,
  setValue,
} from "@/lib/ielts/question-types";
import type { IeltsRendererProps } from "./types";
import { ChoiceTile, type ChoiceState } from "./ChoiceTile";
import { QuestionShell } from "./QuestionShell";

/**
 * mcq_single, true_false_notgiven, yes_no_notgiven — pick exactly one option.
 * T/F/NG and Y/N/NG receive their fixed option sets from the registry (already
 * resolved into `question.options` by the dispatcher).
 */
export function SingleSelectRenderer({
  question,
  value,
  onChange,
  disabled,
  verdict,
}: IeltsRendererProps) {
  const selected = getStringValue(value, DEFAULT_BLANK_ID);
  const blankVerdict = verdict?.blanks[DEFAULT_BLANK_ID];
  const locked = disabled || verdict != null;

  return (
    <QuestionShell instructions={question.groupInstructions} prompt={question.prompt}>
      <div role="radiogroup" className="flex flex-col gap-3">
        {question.options.map((option) => {
          const isSelected = selected === option.id;
          const state: ChoiceState =
            blankVerdict && isSelected
              ? blankVerdict.correct
                ? "correct"
                : "incorrect"
              : "idle";
          return (
            <ChoiceTile
              key={option.id}
              control="radio"
              label={option.label}
              text={option.text}
              selected={isSelected}
              state={state}
              disabled={locked}
              onSelect={() => onChange(setValue(value, DEFAULT_BLANK_ID, option.id))}
            />
          );
        })}
      </div>
    </QuestionShell>
  );
}
