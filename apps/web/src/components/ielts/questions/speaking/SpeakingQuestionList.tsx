"use client";

/**
 * Workbench list for Speaking Part 1 / Part 3: one bordered card, numbered
 * rows separated by hairlines. Each row is rendered by the caller (normally
 * `<QuestionHost variant="row" …/>`) so answer capture stays in the host.
 *
 * Intended `MockSectionPart` usage:
 *   <SpeakingQuestionList
 *     title={part.title}
 *     questions={part.questions}
 *     numberOffset={numberOffset}
 *     renderQuestion={(question, number) => <QuestionHost variant="row" number={number} … />}
 *   />
 */
import type { ReactNode } from "react";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { cn } from "@/lib/utils";

export interface SpeakingQuestionListProps {
  questions: IeltsQuestionView[];
  /** Display number of the first row is `numberOffset + 1`. */
  numberOffset: number;
  /** Renders one row; `number` is the 1-based display number. */
  renderQuestion: (question: IeltsQuestionView, number: number) => ReactNode;
  /** Optional header (e.g. the part title). */
  title?: string;
  className?: string;
}

export function SpeakingQuestionList({
  questions,
  numberOffset,
  renderQuestion,
  title,
  className,
}: SpeakingQuestionListProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest",
        className,
      )}
    >
      {title ? (
        <header className="border-b border-outline-variant bg-surface-container-low px-4 py-2.5">
          <h3 className="type-label text-on-surface">{title}</h3>
        </header>
      ) : null}
      <ol className="divide-y divide-outline-variant">
        {questions.map((question, index) => (
          <li key={question.id}>
            {renderQuestion(question, numberOffset + index + 1)}
          </li>
        ))}
      </ol>
    </section>
  );
}
