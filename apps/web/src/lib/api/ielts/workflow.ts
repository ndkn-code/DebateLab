/**
 * IELTS content status workflow (WS-1.1): Draft → In QA → Approved → Published
 * (+ Archived). A "Needs fix" review bounces an item back to Draft. Pure module —
 * the single source of truth for which transitions are legal, used by the publish
 * action and surfaced in the authoring UI.
 */
import { IELTS_CONTENT_STATUSES } from "./schema";

export type IeltsContentStatus = (typeof IELTS_CONTENT_STATUSES)[number];

/** Allowed forward/back transitions per status. */
const TRANSITIONS: Record<IeltsContentStatus, readonly IeltsContentStatus[]> = {
  draft: ["in_qa", "archived"],
  in_qa: ["approved", "draft", "archived"], // approve, or bounce back ("Needs fix")
  approved: ["published", "in_qa", "draft", "archived"],
  published: ["archived", "draft"], // unpublish back to draft to begin a new version
  archived: ["draft"],
};

/** Statuses whose content is visible to learners (RLS gates on `published`). */
export const LEARNER_VISIBLE_STATUSES: readonly IeltsContentStatus[] = ["published"];

export function allowedTransitions(from: IeltsContentStatus): readonly IeltsContentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: IeltsContentStatus, to: IeltsContentStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export function assertTransition(from: IeltsContentStatus, to: IeltsContentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid IELTS content status transition: ${from} → ${to}`);
  }
}

/** A transition into `published` should snapshot a content version + stamp publish time. */
export function isPublishTransition(to: IeltsContentStatus): boolean {
  return to === "published";
}
