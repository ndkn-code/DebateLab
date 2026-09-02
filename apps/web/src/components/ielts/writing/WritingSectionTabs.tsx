"use client";

/**
 * Writing part layout: when a part carries both tasks, present them as
 * "Task 1 / Task 2" tabs with a live word-count badge per task. Both panels
 * stay mounted so the editors keep their draft + scoring-poll state while the
 * learner switches. A single-task part renders the question with no tabs.
 *
 * Plug-in point for `MockSectionPart`: replace the `part.questions.map(...)`
 * with `<WritingPartLayout questions responses renderQuestion />` for the
 * writing skill; `renderQuestion` returns the same `QuestionHost` it renders
 * today (see the diff suggestion in the hand-off notes).
 */
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2 } from "@/components/ui/icons";
import { summarizeWritingTasks, type WritingTaskSummary } from "./writing-part";

export interface WritingPartLayoutProps {
  /** The part's writing questions, in exam order (Task 1 then Task 2). */
  questions: IeltsQuestionView[];
  /** The player's response map — read for live word counts only. */
  responses: Record<string, unknown>;
  /** Renders one question exactly as the part does today (`QuestionHost`). */
  renderQuestion: (question: IeltsQuestionView, index: number) => ReactNode;
  /** Optional controlled tab (question id); defaults to the first task. */
  activeQuestionId?: string;
  onActiveQuestionChange?: (questionId: string) => void;
}

function TaskTabLabel({ summary }: { summary: WritingTaskSummary }) {
  const t = useTranslations("ielts.player.writing");
  return (
    <span className="inline-flex items-center gap-2">
      {t("task", { number: summary.taskNumber })}
      <Badge
        variant={summary.minWordsMet ? "success" : "outline"}
        className="tabular-nums"
        aria-label={t("minWords", {
          count: summary.words,
          min: summary.minWords,
        })}
      >
        {summary.minWordsMet ? (
          <CheckCircle2 aria-hidden="true" />
        ) : null}
        {t("wordCount", { count: summary.words })}
      </Badge>
    </span>
  );
}

export function WritingSectionTabs({
  questions,
  responses,
  renderQuestion,
  activeQuestionId,
  onActiveQuestionChange,
}: WritingPartLayoutProps) {
  const summaries = summarizeWritingTasks(questions, responses);
  return (
    <Tabs
      defaultValue={questions[0]?.id}
      value={activeQuestionId}
      onValueChange={(value) => {
        if (typeof value === "string") onActiveQuestionChange?.(value);
      }}
      className="gap-4"
    >
      <TabsList className="h-9 w-full sm:w-fit">
        {questions.map((question, index) => (
          <TabsTrigger key={question.id} value={question.id} className="px-3">
            <TaskTabLabel summary={summaries[index]} />
          </TabsTrigger>
        ))}
      </TabsList>
      {questions.map((question, index) => (
        <TabsContent key={question.id} value={question.id} keepMounted>
          {renderQuestion(question, index)}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function WritingPartLayout(props: WritingPartLayoutProps) {
  if (props.questions.length <= 1) {
    return (
      <>{props.questions.map((question, index) => props.renderQuestion(question, index))}</>
    );
  }
  return <WritingSectionTabs {...props} />;
}
