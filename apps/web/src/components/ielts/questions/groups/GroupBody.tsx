"use client";

/** Dispatch a group block to the surface for its layout. */
import { FlowchartCompletionGroup } from "./FlowchartCompletionGroup";
import { ImageLabelGroup } from "./ImageLabelGroup";
import { MatchingGroup } from "./MatchingGroup";
import { MultiSelectGroup } from "./MultiSelectGroup";
import { TableCompletionGroup } from "./TableCompletionGroup";
import { TextCompletionGroup } from "./TextCompletionGroup";
import { useGroupContext } from "./group-context";
import type { GroupLayout } from "./types";

export function GroupBody({
  layout,
  onAnswer,
}: {
  layout: GroupLayout;
  onAnswer: (questionId: string, value: unknown) => void;
}) {
  const { group } = useGroupContext();
  const stimulus = group.stimulus;

  if (layout === "multi_select") return <MultiSelectGroup onAnswer={onAnswer} />;
  if (stimulus?.kind === "text" && layout === "text") {
    return <TextCompletionGroup stimulus={stimulus} />;
  }
  if (stimulus?.kind === "table" && layout === "table") {
    return <TableCompletionGroup stimulus={stimulus} />;
  }
  if (stimulus?.kind === "flowchart" && layout === "flowchart") {
    return <FlowchartCompletionGroup stimulus={stimulus} />;
  }
  if (stimulus?.kind === "image" && layout === "image") {
    return <ImageLabelGroup stimulus={stimulus} />;
  }
  return <MatchingGroup />;
}
