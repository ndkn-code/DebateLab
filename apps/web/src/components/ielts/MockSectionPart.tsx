"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import { PassageHighlighter } from "./PassageHighlighter";
import { QuestionHost } from "./QuestionHost";
import type { MockPart } from "./mock-parts";
import type { AssessmentMode } from "@/lib/ielts/assessment-mode";

export function SectionStimulus({
  part,
  onOpenNotes,
}: {
  part: MockPart;
  onOpenNotes: (noteId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {part.body !== null ? (
        <PassageHighlighter
          passageKey={part.id}
          title={part.title}
          body={part.body}
          onOpenNotes={onOpenNotes}
        />
      ) : null}
    </div>
  );
}

export function SectionPart({
  part,
  stimulus,
  hasStimulus,
  attemptId,
  assessmentMode,
  numberOffset,
  disabled,
  responses,
  onAnswer,
  onOpenNotes,
}: {
  part: MockPart;
  stimulus: ReactNode;
  hasStimulus: boolean;
  attemptId: string;
  assessmentMode: AssessmentMode;
  numberOffset: number;
  disabled: boolean;
  responses: IeltsResponseMap;
  onAnswer: (questionId: string, value: unknown) => void;
  onOpenNotes: (noteId: string) => void;
}) {
  const t = useTranslations("ielts.player.exam");

  return (
    <div
      className={
        hasStimulus ? "grid gap-5 lg:grid-cols-2" : "flex flex-col gap-3"
      }
    >
      {hasStimulus ? stimulus : null}
      <div className="flex flex-col gap-3">
        {part.questions.map((question, index) => (
          <QuestionHost
            key={question.id}
            question={question}
            number={numberOffset + index + 1}
            value={responses[question.id]}
            disabled={disabled}
            onChange={(value) => onAnswer(question.id, value)}
            context={{ attemptId, assessmentMode }}
            allowFlag
            onOpenNotes={onOpenNotes}
          />
        ))}
        {part.questions.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t("noQuestions")}</p>
        ) : null}
      </div>
    </div>
  );
}
