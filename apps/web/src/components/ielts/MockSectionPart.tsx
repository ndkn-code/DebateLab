"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import {
  assignQuestionNumbers,
  partitionPartQuestions,
  type QuestionNumber,
} from "@/lib/ielts/question-groups";
import {
  indexGroupsByKey,
  type IeltsQuestionGroupView,
  type IeltsVerdict,
} from "@/lib/ielts/question-types";
import type { AssessmentMode } from "@/lib/ielts/assessment-mode";
import { PassageHighlighter } from "./PassageHighlighter";
import { QuestionHost } from "./QuestionHost";
import { WritingPartLayout } from "./writing/WritingSectionTabs";
import { SpeakingQuestionList } from "./questions/speaking/SpeakingQuestionList";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { QuestionGroupHost } from "./questions/groups";
import type { MockPart } from "./mock-parts";

/** `MockPart` plus the part-scoped group views (optional until mock-parts ships them). */
export type MockPartWithGroups = MockPart & { groups?: IeltsQuestionGroupView[] };

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

export interface SectionPartProps {
  part: MockPartWithGroups;
  stimulus: ReactNode;
  hasStimulus: boolean;
  attemptId: string;
  assessmentMode: AssessmentMode;
  /** First number of this part minus one — kept for callers without `numbers`. */
  numberOffset: number;
  /** Section-wide numbering (from `assignQuestionNumbers`); computed locally when absent. */
  numbers?: ReadonlyMap<string, QuestionNumber>;
  disabled: boolean;
  responses: IeltsResponseMap;
  onAnswer: (questionId: string, value: unknown) => void;
  onOpenNotes: (noteId: string) => void;
  /** questionId → verdict; present → grouped blanks render read-only review marks. */
  verdicts?: Record<string, IeltsVerdict>;
}

export function SectionPart({
  part,
  stimulus,
  hasStimulus,
  attemptId,
  assessmentMode,
  numberOffset,
  numbers,
  disabled,
  responses,
  onAnswer,
  onOpenNotes,
  verdicts,
}: SectionPartProps) {
  const t = useTranslations("ielts.player.exam");
  const blocks = useMemo(() => {
    const resolvedNumbers = numbers ?? assignQuestionNumbers([part], numberOffset + 1);
    return partitionPartQuestions(
      part.questions,
      indexGroupsByKey(part.groups ?? []),
      resolvedNumbers,
    );
  }, [numberOffset, numbers, part]);

  const skill = part.questions[0]?.skill;
  const hostFor = (
    question: IeltsQuestionView,
    number: number,
    numberLabel?: string,
    variant?: "card" | "row",
  ) => (
    <QuestionHost
      key={question.id}
      question={question}
      number={number}
      numberLabel={numberLabel}
      value={responses[question.id]}
      disabled={disabled}
      onChange={(value) => onAnswer(question.id, value)}
      context={{ attemptId, assessmentMode }}
      allowFlag
      onOpenNotes={onOpenNotes}
      variant={variant}
    />
  );
  const isSpeakingList =
    skill === "speaking" && part.questions[0]?.questionType !== "speaking_part2_cuecard";

  return (
    <div
      className={
        hasStimulus ? "grid gap-5 lg:grid-cols-2" : "flex flex-col gap-3"
      }
    >
      {hasStimulus ? stimulus : null}
      <div className="flex flex-col gap-3">
        {skill === "writing" ? (
          <WritingPartLayout
            questions={part.questions}
            responses={responses}
            renderQuestion={(question, index) => hostFor(question, numberOffset + index + 1)}
          />
        ) : isSpeakingList ? (
          <SpeakingQuestionList
            title={part.title}
            questions={part.questions}
            numberOffset={numberOffset}
            renderQuestion={(question, number) => hostFor(question, number, undefined, "row")}
          />
        ) : (
          blocks.map((block) =>
          block.kind === "single" ? (
            hostFor(block.question, block.number.start, block.number.label)
          ) : (
            <QuestionGroupHost
              key={`group-${block.group.groupKey}-${block.questions[0]?.id ?? ""}`}
              block={block}
              responses={responses}
              onAnswer={onAnswer}
              disabled={disabled}
              mode={verdicts ? "verdict" : "answer"}
              verdicts={verdicts}
            />
          ),
          )
        )}
        {part.questions.length === 0 ? (
          <p className="text-sm text-on-surface-variant">{t("noQuestions")}</p>
        ) : null}
      </div>
    </div>
  );
}
