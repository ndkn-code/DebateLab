"use client";

/**
 * Flow-chart completion: each step is a box (with inline numbered blanks),
 * joined by arrows running down or to the right.
 */
import { Fragment } from "react";
import { ArrowRight, ChevronDown } from "@/components/ui/icons";
import { parsePromptSegments } from "@/lib/ielts/question-types";
import type { IeltsGroupStimulus } from "@/lib/ielts/question-types";
import { cn } from "@/lib/utils";
import { GroupBank } from "./GroupBank";
import { useGroupContext } from "./group-context";
import { MissingBlank, NumberedBlank } from "./NumberedBlank";
import { renderRichText } from "./rich-text";

export function FlowchartCompletionGroup({
  stimulus,
}: {
  stimulus: Extract<IeltsGroupStimulus, { kind: "flowchart" }>;
}) {
  const ctx = useGroupContext();
  const down = stimulus.direction === "down";

  return (
    <div className="flex flex-col gap-3">
      {ctx.selectMode ? <GroupBank /> : null}
      {stimulus.title ? (
        <p className="type-body font-semibold text-on-surface">{stimulus.title}</p>
      ) : null}
      <ol
        className={cn(
          "flex",
          down ? "flex-col items-stretch" : "flex-row items-center gap-1 overflow-x-auto pb-2",
        )}
        aria-label={stimulus.title}
      >
        {stimulus.steps.map((step, stepIndex) => (
          <Fragment key={stepIndex}>
            {stepIndex > 0 ? (
              <li
                aria-hidden="true"
                className={cn(
                  "flex shrink-0 items-center justify-center text-on-surface-variant",
                  down ? "py-1" : "px-1",
                )}
              >
                {down ? <ChevronDown className="size-5" /> : <ArrowRight className="size-5" />}
              </li>
            ) : null}
            <li
              className={cn(
                "rounded-lg border border-outline-variant bg-surface px-4 py-3 type-body leading-relaxed text-on-surface",
                !down && "w-64 shrink-0",
              )}
            >
              {parsePromptSegments(step.text).map((segment, index) => {
                if (segment.type === "text") {
                  return renderRichText(segment.text, `f${stepIndex}-${index}`);
                }
                const owner = ctx.slots.get(segment.id);
                return owner ? (
                  <NumberedBlank
                    key={`b${stepIndex}-${index}`}
                    questionId={owner.questionId}
                    layout="inline"
                  />
                ) : (
                  <MissingBlank key={`b${stepIndex}-${index}`} />
                );
              })}
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
