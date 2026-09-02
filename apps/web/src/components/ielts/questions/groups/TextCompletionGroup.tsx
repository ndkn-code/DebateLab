"use client";

/**
 * Summary / notes / form completion: the group's text with each
 * `__BLANK_<slot>__` marker replaced by the numbered blank of the member that
 * owns that slot. Unowned slots draw an inert dashed blank.
 */
import { parsePromptSegments } from "@/lib/ielts/question-types";
import type { IeltsGroupStimulus } from "@/lib/ielts/question-types";
import { GroupBank } from "./GroupBank";
import { useGroupContext } from "./group-context";
import { MissingBlank, NumberedBlank } from "./NumberedBlank";
import { renderRichText } from "./rich-text";

export function TextCompletionGroup({
  stimulus,
}: {
  stimulus: Extract<IeltsGroupStimulus, { kind: "text" }>;
}) {
  const ctx = useGroupContext();
  const segments = parsePromptSegments(stimulus.body);

  return (
    <div className="flex flex-col gap-3">
      {ctx.selectMode ? <GroupBank /> : null}
      <div className="rounded-lg border border-outline-variant bg-surface px-4 py-3">
        {stimulus.heading ? (
          <p className="mb-2 type-body font-semibold text-on-surface">{stimulus.heading}</p>
        ) : null}
        <p className="type-body leading-relaxed text-on-surface">
          {segments.map((segment, index) => {
            if (segment.type === "text") {
              return renderRichText(segment.text, `s${index}`);
            }
            const owner = ctx.slots.get(segment.id);
            return owner ? (
              <NumberedBlank key={`b${index}`} questionId={owner.questionId} layout="inline" />
            ) : (
              <MissingBlank key={`b${index}`} />
            );
          })}
        </p>
      </div>
    </div>
  );
}
