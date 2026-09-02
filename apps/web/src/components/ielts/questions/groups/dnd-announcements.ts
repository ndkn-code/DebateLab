/**
 * Localised dnd-kit screen-reader announcements for the bank → blank drag.
 */
import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";
import type { IeltsOption } from "@/lib/ielts/question-types";
import { bankOptionLabel } from "./group-answers";
import { parseDragId, parseDropId } from "./group-context";

/** Subset of the `ielts.player.groups` translator the announcements use. */
export type GroupsTranslator = (
  key: "dragHint" | "pickForSlot" | "placed",
  values?: Record<string, string | number>,
) => string;

export function buildDndAccessibility(
  t: GroupsTranslator,
  bank: readonly IeltsOption[],
  numberLabelFor: (questionId: string | null) => string,
): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions } {
  const option = (id: string | number) => bankOptionLabel(bank, parseDragId(id));
  const number = (id: string | number) => numberLabelFor(parseDropId(id));
  return {
    screenReaderInstructions: { draggable: t("dragHint") },
    announcements: {
      onDragStart: ({ active }) => option(active.id),
      onDragOver: ({ over }) =>
        over ? t("pickForSlot", { number: number(over.id) }) : t("dragHint"),
      onDragEnd: ({ active, over }) =>
        over
          ? t("placed", { option: option(active.id), number: number(over.id) })
          : t("dragHint"),
      onDragCancel: () => t("dragHint"),
    },
  };
}
