"use client";

import { useTranslations } from "next-intl";
import {
  isObjectiveQuestionType,
  parseQuestionView,
} from "@/lib/ielts/question-types";
import type {
  IeltsAnswer,
  IeltsQuestionFamily,
  IeltsVerdict,
} from "@/lib/ielts/question-types";
import { Text } from "@/components/ui/typography";
import type { Tables } from "@/types/supabase";
import { CompletionRenderer } from "./CompletionRenderer";
import { LabelingRenderer } from "./LabelingRenderer";
import { MatchingRenderer } from "./MatchingRenderer";
import { MultiSelectRenderer } from "./MultiSelectRenderer";
import { SingleSelectRenderer } from "./SingleSelectRenderer";
import type { IeltsRendererProps } from "./types";

/** The one place each renderer family is wired to its player component. */
const RENDERERS: Record<IeltsQuestionFamily, React.ComponentType<IeltsRendererProps>> = {
  single_select: SingleSelectRenderer,
  multi_select: MultiSelectRenderer,
  matching: MatchingRenderer,
  completion: CompletionRenderer,
  labeling: LabelingRenderer,
};

interface Props {
  /** A row from `ielts_questions` (non-secret fields). */
  question: Tables<"ielts_questions">;
  value: IeltsAnswer | null;
  onChange: (next: IeltsAnswer) => void;
  disabled?: boolean;
  /** Present → read-only review mode marking the learner's own answer. */
  verdict?: IeltsVerdict | null;
}

/**
 * Entry point for rendering any objective IELTS question: parses the row into a
 * non-secret view and dispatches to the family renderer. Writing/Speaking
 * prompts (AI-scored, WS-3.x) are not auto-graded here.
 */
export function IeltsQuestionRenderer({
  question,
  value,
  onChange,
  disabled,
  verdict,
}: Props) {
  const t = useTranslations("ielts.player");
  if (!isObjectiveQuestionType(question.question_type)) {
    return (
      <Text variant="caption" className="text-on-surface-variant">
        {t("notAutoGraded")}
      </Text>
    );
  }

  const view = parseQuestionView(question);
  const Renderer = RENDERERS[view.family];
  return (
    <Renderer
      question={view}
      value={value}
      onChange={onChange}
      disabled={disabled}
      verdict={verdict}
    />
  );
}
