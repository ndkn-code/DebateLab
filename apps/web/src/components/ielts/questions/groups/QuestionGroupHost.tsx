"use client";

/**
 * Renders one grouped question set of a mock part: header (range, rubric,
 * hints), then the surface for its kind — bank matching rows, summary/table/
 * flow-chart completion, diagram labelling, or a multi-select run. Owns the
 * drag-and-drop context and the armed-slot state shared by bank + blanks.
 */
import { useId, useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import { usedOptionIds, type GroupPartBlock } from "@/lib/ielts/question-groups";
import type { IeltsVerdict } from "@/lib/ielts/question-types";
import { useIsCompactViewport } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { GroupBody } from "./GroupBody";
import { GroupHeader } from "./GroupHeader";
import { buildDndAccessibility } from "./dnd-announcements";
import {
  buildSlotRefs,
  canPlaceOption,
  groupSelectCount,
  indexSlotRefs,
  isSelectGroup,
  resolveGroupLayout,
} from "./group-answers";
import { GroupContextProvider, parseDragId, parseDropId } from "./group-context";
import type { GroupContextValue, GroupMode } from "./types";
import { useSlotSelection } from "./useSlotSelection";

export interface QuestionGroupHostProps {
  block: GroupPartBlock;
  responses: IeltsResponseMap;
  onAnswer: (questionId: string, value: unknown) => void;
  disabled?: boolean;
  /** `answer` (default) captures; `verdict` is read-only review marking blanks. */
  mode?: GroupMode;
  /** questionId → verdict, for `mode="verdict"`. */
  verdicts?: Record<string, IeltsVerdict>;
  className?: string;
}

export function QuestionGroupHost({
  block,
  responses,
  onAnswer,
  disabled = false,
  mode = "answer",
  verdicts,
  className,
}: QuestionGroupHostProps) {
  const t = useTranslations("ielts.player.groups");
  const headingId = useId();
  const compact = useIsCompactViewport();
  const { group } = block;
  const selectMode = isSelectGroup(group);
  const locked = disabled || mode === "verdict";
  const layout = resolveGroupLayout(block);
  const slotList = useMemo(() => buildSlotRefs(block), [block]);
  const slots = useMemo(() => indexSlotRefs(slotList), [slotList]);
  const used = useMemo(
    () => usedOptionIds(responses, group.questionIds),
    [responses, group.questionIds],
  );
  const selection = useSlotSelection({ group, slotList, locked, onAnswer });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const ctx: GroupContextValue = {
    group,
    block,
    slots,
    slotList,
    selectMode,
    compact,
    mode,
    locked,
    responses,
    verdicts,
    used,
    armedQuestionId: selection.armedQuestionId,
    arm: selection.arm,
    fill: selection.fill,
    setText: selection.setText,
  };

  const numberLabelFor = (questionId: string | null) =>
    slotList.find((ref) => ref.questionId === questionId)?.number.label ?? "";

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const optionId = parseDragId(active.id);
    const questionId = over ? parseDropId(over.id) : null;
    if (!optionId || !questionId) return;
    if (!canPlaceOption(group, responses, used, questionId, optionId)) return;
    selection.fill(questionId, optionId);
  };

  const body = <GroupBody layout={layout} onAnswer={onAnswer} />;
  const draggable = selectMode && !compact && !locked;

  return (
    <section
      id={`mock-g-${group.id}`}
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container p-4",
        className,
      )}
    >
      <GroupHeader
        block={block}
        selectMode={selectMode}
        compact={compact}
        mode={mode}
        selectCount={layout === "multi_select" ? groupSelectCount(block) : null}
        headingId={headingId}
      />
      <GroupContextProvider value={ctx}>
        {draggable ? (
          <DndContext
            sensors={sensors}
            onDragEnd={handleDragEnd}
            accessibility={buildDndAccessibility(t, group.bank, numberLabelFor)}
          >
            {body}
          </DndContext>
        ) : (
          body
        )}
      </GroupContextProvider>
      <p aria-live="polite" className="sr-only">
        {selection.liveMessage}
      </p>
    </section>
  );
}
