"use client";

/**
 * Table completion: the group's grid rendered through the shared
 * `QuestionVisual` table markup (scrolls inside `overflow-x-auto`), gap cells
 * becoming numbered blanks.
 */
import { useMemo } from "react";
import type { IeltsGroupStimulus, IeltsTableVisual } from "@/lib/ielts/question-types";
import { QuestionVisual } from "../QuestionVisual";
import { GroupBank } from "./GroupBank";
import { useGroupContext } from "./group-context";
import { MissingBlank, NumberedBlank } from "./NumberedBlank";

export function TableCompletionGroup({
  stimulus,
}: {
  stimulus: Extract<IeltsGroupStimulus, { kind: "table" }>;
}) {
  const ctx = useGroupContext();
  const visual = useMemo<IeltsTableVisual>(
    () => ({
      kind: "table",
      caption: stimulus.caption,
      headers: stimulus.headers,
      rows: stimulus.rows,
    }),
    [stimulus],
  );

  return (
    <div className="flex flex-col gap-3">
      {ctx.selectMode ? <GroupBank /> : null}
      <QuestionVisual
        visual={visual}
        framed={false}
        renderGap={(gap) => {
          const owner = ctx.slots.get(gap.id);
          return owner ? (
            <NumberedBlank questionId={owner.questionId} layout="inline" />
          ) : (
            <MissingBlank />
          );
        }}
      />
    </div>
  );
}
