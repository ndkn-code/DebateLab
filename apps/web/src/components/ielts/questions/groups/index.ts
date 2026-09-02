/** Group-aware question surfaces for the IELTS mock player — public surface. */
export { QuestionGroupHost, type QuestionGroupHostProps } from "./QuestionGroupHost";
export type { GroupLayout, GroupMode, SlotRef } from "./types";
export { resolveGroupLayout, isSelectGroup, buildSlotRefs } from "./group-answers";
