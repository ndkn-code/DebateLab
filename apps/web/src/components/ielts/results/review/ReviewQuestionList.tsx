"use client";

/**
 * Right pane of a review part: the part's questions in sitting order. Runs
 * of consecutive items that share a group with a stimulus or bank render the
 * read-only group widget; everything else is a plain answer row.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type { IeltsQuestionGroupView } from "@/lib/ielts/question-types";
import type {
  ObjectiveReviewItem,
  ObjectiveReviewPart,
} from "@/lib/ielts/results/types";
import { ReviewGroupWidget } from "./ReviewGroupWidget";
import { ReviewRow } from "./ReviewRow";

type ReviewRun =
  | { kind: "rows"; key: string; items: ObjectiveReviewItem[] }
  | {
      kind: "group";
      key: string;
      group: IeltsQuestionGroupView;
      items: ObjectiveReviewItem[];
    };

function widgetGroupFor(
  item: ObjectiveReviewItem,
  groups: ReadonlyMap<string, IeltsQuestionGroupView>,
): IeltsQuestionGroupView | null {
  if (!item.groupKey) return null;
  const group = groups.get(item.groupKey);
  if (!group) return null;
  return group.stimulus || group.bank.length > 0 ? group : null;
}

/** Split items into widget runs (same group, consecutive) and plain-row runs. */
export function buildReviewRuns(
  items: readonly ObjectiveReviewItem[],
  groups: ReadonlyMap<string, IeltsQuestionGroupView>,
): ReviewRun[] {
  const runs: ReviewRun[] = [];
  for (const item of items) {
    const group = widgetGroupFor(item, groups);
    const last = runs[runs.length - 1];
    if (group) {
      if (last?.kind === "group" && last.group.groupKey === group.groupKey) {
        last.items.push(item);
      } else {
        runs.push({ kind: "group", key: `g-${item.questionId}`, group, items: [item] });
      }
    } else if (last?.kind === "rows") {
      last.items.push(item);
    } else {
      runs.push({ kind: "rows", key: `r-${item.questionId}`, items: [item] });
    }
  }
  return runs;
}

/** Show a group rubric once, above the first row of each run that carries it. */
function rowsWithInstructions(
  items: readonly ObjectiveReviewItem[],
): { item: ObjectiveReviewItem; instructions: string | null }[] {
  const rows: { item: ObjectiveReviewItem; instructions: string | null }[] = [];
  let previous: string | null = null;
  for (const item of items) {
    const instructions =
      item.groupInstructions && item.groupInstructions !== previous
        ? item.groupInstructions
        : null;
    previous = item.groupInstructions;
    rows.push({ item, instructions });
  }
  return rows;
}

function RowsRun({ items }: { items: ObjectiveReviewItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rowsWithInstructions(items).map(({ item, instructions }) => (
        <ReviewRow key={item.questionId} item={item} instructions={instructions} />
      ))}
    </ul>
  );
}

export function ReviewQuestionList({
  part,
  groups,
  responses,
}: {
  part: ObjectiveReviewPart;
  groups: ReadonlyMap<string, IeltsQuestionGroupView>;
  responses: IeltsResponseMap;
}) {
  const t = useTranslations("ielts.results.review");
  const runs = useMemo(() => buildReviewRuns(part.items, groups), [part.items, groups]);
  const correct = part.items.filter((item) => item.isCorrect).length;

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="type-caption font-semibold uppercase text-on-surface-variant">
          {t("title")}
        </p>
        <Badge variant="outline" className="tabular-nums">
          {correct}/{part.items.length} · {t("correct")}
        </Badge>
      </div>
      {runs.map((run) =>
        run.kind === "group" ? (
          <ReviewGroupWidget
            key={run.key}
            part={part}
            group={run.group}
            items={run.items}
            responses={responses}
          />
        ) : (
          <RowsRun key={run.key} items={run.items} />
        ),
      )}
    </div>
  );
}
