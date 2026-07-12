"use client";

import { useTranslations } from "next-intl";
import {
  DEFAULT_BLANK_ID,
  type IeltsOption,
  parsePromptSegments,
} from "@/lib/ielts/question-types";
import { Text } from "@/components/ui/typography";
import type { IeltsRendererProps } from "./types";
import { BlankControl } from "./BlankControl";
import type { ChoiceState } from "./ChoiceTile";
import { QuestionVisual } from "./QuestionVisual";
import { QuestionShell } from "./QuestionShell";

type BlankStateFn = (blankId: string) => ChoiceState;

/** Optional word bank shown above the gaps for word-list completion. */
function BankLegend({ options }: { options: IeltsOption[] }) {
  return (
    <ul className="flex flex-wrap gap-2 rounded-2xl bg-surface-container p-4">
      {options.map((option) => (
        <li key={option.id} className="rounded-lg bg-surface px-3 py-1">
          <Text variant="body-sm" className="text-on-surface">
            {option.label ? `${option.label}. ${option.text}` : option.text}
          </Text>
        </li>
      ))}
    </ul>
  );
}

/**
 * sentence/summary/note_table_form_flowchart completion + short_answer. Blanks
 * come from a table visual, from `__BLANK_<id>__` markers in the prompt, or — for
 * a bare short answer — a single input. When the question carries an option bank
 * the blanks become dropdowns (word-list completion), matching the grader.
 */
export function CompletionRenderer({
  question,
  value,
  onChange,
  disabled,
  verdict,
}: IeltsRendererProps) {
  const t = useTranslations("ielts.player");
  const locked = disabled || verdict != null;
  const bank = question.options.length > 0 ? question.options : undefined;

  const blankState: BlankStateFn = (blankId) => {
    const blank = verdict?.blanks[blankId];
    if (!blank) return "idle";
    return blank.correct ? "correct" : "incorrect";
  };

  const renderBlank = (blankId: string, label?: string) => (
    <BlankControl
      blankId={blankId}
      value={value}
      onChange={onChange}
      options={bank}
      disabled={locked}
      state={blankState(blankId)}
      ariaLabel={label ?? t("blankLabel", { id: blankId })}
      placeholder={t("blankPlaceholder")}
      layout="block"
    />
  );

  if (question.visual?.kind === "table") {
    return (
      <QuestionShell
        instructions={question.groupInstructions}
        prompt={question.prompt}
        wordLimit={question.wordLimit}
      >
        {bank ? <BankLegend options={bank} /> : null}
        <QuestionVisual
          visual={question.visual}
          framed={false}
          renderGap={(gap) => renderBlank(gap.id, gap.label)}
        />
      </QuestionShell>
    );
  }

  const segments = parsePromptSegments(question.prompt);
  const hasBlanks = segments.some((segment) => segment.type === "blank");

  return (
    <QuestionShell instructions={question.groupInstructions} wordLimit={question.wordLimit}>
      {bank ? <BankLegend options={bank} /> : null}
      {hasBlanks ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5">
          {segments.map((segment, index) =>
            segment.type === "text" ? (
              <span key={index} className="type-body text-on-surface">
                {segment.text}
              </span>
            ) : (
              <BlankControl
                key={index}
                blankId={segment.id}
                value={value}
                onChange={onChange}
                options={bank}
                disabled={locked}
                state={blankState(segment.id)}
                ariaLabel={t("blankLabel", { id: segment.id })}
                layout="inline"
              />
            ),
          )}
        </p>
      ) : (
        <>
          <Text variant="body-lg" className="font-semibold text-on-surface">
            {question.prompt}
          </Text>
          <BlankControl
            blankId={DEFAULT_BLANK_ID}
            value={value}
            onChange={onChange}
            options={bank}
            disabled={locked}
            state={blankState(DEFAULT_BLANK_ID)}
            ariaLabel={question.prompt}
            placeholder={t("blankPlaceholder")}
            layout="block"
          />
        </>
      )}
    </QuestionShell>
  );
}
