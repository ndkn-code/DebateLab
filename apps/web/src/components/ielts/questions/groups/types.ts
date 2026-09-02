import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type { GroupPartBlock, QuestionNumber } from "@/lib/ielts/question-groups";
import type { IeltsQuestionGroupView, IeltsVerdict } from "@/lib/ielts/question-types";

/** `answer` = live capture; `verdict` = read-only review marking each blank. */
export type GroupMode = "answer" | "verdict";

/** Which group surface a block renders as. */
export type GroupLayout =
  | "multi_select"
  | "matching"
  | "text"
  | "table"
  | "flowchart"
  | "image";

export type SlotLayout = "inline" | "block" | "pin";

/** One numbered blank of a group: the member question plus its slot + number. */
export interface SlotRef {
  questionId: string;
  slot: string;
  number: QuestionNumber;
  prompt: string;
  wordLimit: number | null;
}

/** Everything a group surface needs, shared through `GroupContext`. */
export interface GroupContextValue {
  group: IeltsQuestionGroupView;
  block: GroupPartBlock;
  /** Blank ↔ member lookup, keyed by slot id. */
  slots: ReadonlyMap<string, SlotRef>;
  /** Members in display order. */
  slotList: readonly SlotRef[];
  /** Bank-driven (drag / pick) blanks; false → typed text. */
  selectMode: boolean;
  /** Below `md`: selects replace drag targets, the bank becomes a legend. */
  compact: boolean;
  mode: GroupMode;
  /** True when the learner cannot change answers (disabled or verdict mode). */
  locked: boolean;
  responses: IeltsResponseMap;
  verdicts: Record<string, IeltsVerdict> | undefined;
  /** Bank option ids already placed (meaningful when `!group.bankReuse`). */
  used: ReadonlySet<string>;
  armedQuestionId: string | null;
  arm: (questionId: string | null) => void;
  /** Place a bank option (or `null` to clear) into a member's blank. */
  fill: (questionId: string, optionId: string | null) => void;
  /** Typed-text blanks. */
  setText: (questionId: string, text: string) => void;
}
