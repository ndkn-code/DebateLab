"use client";

/**
 * Bank-only group (matching headings / information / features / sentence
 * endings, or a short-answer list): one row per numbered statement with its
 * slot on the right. `question.prompt` is the row label ("Paragraph A", the
 * statement, the sentence stem).
 */
import { FlagToggle } from "../FlagToggle";
import { GroupBank } from "./GroupBank";
import { useGroupContext } from "./group-context";
import { NumberBadge, SlotControl } from "./NumberedBlank";

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
            <p className="min-w-0 type-body text-on-surface">{ref.prompt}</p>
            <div className="col-start-2 min-w-0 sm:col-start-3">
              <SlotControl
                questionId={ref.questionId}
                number={ref.number}
                layout="block"
                wordLimit={ref.wordLimit}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
