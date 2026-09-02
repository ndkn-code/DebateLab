"use client";

/**
 * Bank-only group (matching headings / information / features / sentence
 * endings, or a short-answer list): one row per numbered statement with its
 * slot on the right. `question.prompt` is the row label ("Paragraph A", the
 * statement, the sentence stem).
 */
import type { QuestionNumber } from "@/lib/ielts/question-groups";
import { parsePromptSegments } from "@/lib/ielts/question-types/prompt";
import { FlagToggle } from "../FlagToggle";
import { GroupBank } from "./GroupBank";
import { useGroupContext } from "./group-context";
import { NumberBadge, SlotControl } from "./NumberedBlank";

/**
 * A sentence stem authored with an inline `__BLANK_0__` marker renders the
 * control in place ("Early roofs were covered in [____]."); every other row
 * keeps the label-left / slot-right layout.
 */
function InlineStem({
  questionId,
  number,
  prompt,
  wordLimit,
}: {
  questionId: string;
  number: QuestionNumber;
  prompt: string;
  wordLimit: number | null;
}) {
  const segments = parsePromptSegments(prompt);
  return (
    <p className="col-span-full col-start-2 min-w-0 type-body leading-8 text-on-surface sm:col-start-2">
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span key={index} className="mx-1 inline-block align-middle">
            <SlotControl
              questionId={questionId}
              number={number}
              layout="inline"
              wordLimit={wordLimit}
            />
          </span>
        ),
      )}
    </p>
  );
}

export function MatchingGroup() {
  const ctx = useGroupContext();
  return (
    <div className="flex flex-col gap-3">
      {ctx.selectMode ? <GroupBank /> : null}
      <ol className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface">
        {ctx.slotList.map((ref) => (
          <li
            key={ref.questionId}
            id={`mock-q-${ref.questionId}`}
            className="grid scroll-mt-24 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_13rem]"
          >
            <div className="flex items-center gap-1.5">
              <NumberBadge label={ref.number.label} />
              {ctx.mode === "answer" ? (
                <FlagToggle questionId={ref.questionId} size="sm" />
              ) : null}
            </div>
            {ref.prompt.includes("__BLANK_") ? (
              <InlineStem
                questionId={ref.questionId}
                number={ref.number}
                prompt={ref.prompt}
                wordLimit={ref.wordLimit}
              />
            ) : (
              <>
                <p className="min-w-0 type-body text-on-surface">{ref.prompt}</p>
                <div className="col-start-2 min-w-0 sm:col-start-3">
                  <SlotControl
                    questionId={ref.questionId}
                    number={ref.number}
                    layout="block"
                    wordLimit={ref.wordLimit}
                  />
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
