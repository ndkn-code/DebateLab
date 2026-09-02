"use client";

import { createContext, useContext } from "react";
import type { GroupContextValue } from "./types";

const GroupContext = createContext<GroupContextValue | null>(null);

export const GroupContextProvider = GroupContext.Provider;

/** The active group's shared state — only valid under `QuestionGroupHost`. */
export function useGroupContext(): GroupContextValue {
  const value = useContext(GroupContext);
  if (!value) {
    throw new Error("useGroupContext must be used inside QuestionGroupHost");
  }
  return value;
}

/** dnd-kit ids: bank chips and blank targets share one namespace. */
export const DRAG_OPTION_PREFIX = "opt:";
export const DROP_SLOT_PREFIX = "slot:";

export function optionDragId(optionId: string): string {
  return `${DRAG_OPTION_PREFIX}${optionId}`;
}
export function slotDropId(questionId: string): string {
  return `${DROP_SLOT_PREFIX}${questionId}`;
}
export function parseDragId(id: string | number): string | null {
  const text = String(id);
  return text.startsWith(DRAG_OPTION_PREFIX) ? text.slice(DRAG_OPTION_PREFIX.length) : null;
}
export function parseDropId(id: string | number): string | null {
  const text = String(id);
  return text.startsWith(DROP_SLOT_PREFIX) ? text.slice(DROP_SLOT_PREFIX.length) : null;
}
