"use client";

import { useTranslations } from "next-intl";
import {
  IeltsAnswerSchema,
  isObjectiveQuestionType,
  parseQuestionView,
} from "@/lib/ielts/question-types";
import type { IeltsAnswer, IeltsVerdict } from "@/lib/ielts/question-types";
import { Text } from "@/components/ui/typography";
import type { Tables } from "@/types/supabase";
import {
  ensureIeltsObjectiveRenderersRegistered,
  getIeltsQuestionRenderer,
} from "../question-renderer-registry";
import type { IeltsRendererContext } from "./types";

interface Props {
  /** A row from `ielts_questions` (non-secret fields). */
  question: Tables<"ielts_questions">;
  value: IeltsAnswer | null;
  onChange: (next: IeltsAnswer) => void;
  disabled?: boolean;
  /** Present → read-only review mode marking the learner's own answer. */
  verdict?: IeltsVerdict | null;
  context?: IeltsRendererContext;
}

/**
 * Convenience entry point for rendering an objective IELTS question straight
 * from its DB row: parses the row into a non-secret view and delegates to the
 * renderer registry (the single family map). Writing/Speaking prompts
 * (AI-scored, WS-3.x) are not auto-graded here.
 */
export function IeltsQuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
  verdict,
  context,
}: Props) {
  const t = useTranslations("ielts.player");
  if (!isObjectiveQuestionType(question.question_type)) {
    return (
      <Text variant="caption" className="text-on-surface-variant">
        {t("notAutoGraded")}
      </Text>
    );
  }

  ensureIeltsObjectiveRenderersRegistered();
  const view = parseQuestionView(question);
  const render = getIeltsQuestionRenderer(view.questionType);
  return render({
    question: { ...view, orderIndex: 0, groupKey: null, passageId: null, listeningSectionId: null },
    value,
    disabled,
    onChange: (next) => {
      const parsed = IeltsAnswerSchema.safeParse(next);
      if (parsed.success) onChange(parsed.data);
    },
    context,
    verdict: verdict ?? null,
  });
}
