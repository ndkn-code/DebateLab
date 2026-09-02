/**
 * Part-level view model for the IELTS mock player (format-variety pass).
 *
 * A part's flat question list is partitioned into {@link PartBlock}s: a
 * `single` block is one ungrouped question; a `group` block is a run of
 * consecutive questions that share a `groupKey` with a known
 * {@link IeltsQuestionGroupView} (shared bank, summary text, table, diagram).
 *
 * Numbering is official-paper style: sequential across the parts of a
 * section, with an `mcq_multi` row that has `numberSpan: 2` consuming two
 * numbers and labelled "21–22".
 */
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import type { IeltsQuestionGroupView } from "@/lib/ielts/question-types/groups";

/** The player question (view + placement fields) — the default block element. */
export type PartQuestion = IeltsQuestionView;

/** Minimal structural shape partitioning needs; `PartQuestion` satisfies it. */
export interface PartitionQuestionLike {
  id: string;
  groupKey: string | null;
  /** Explicit slot (already parsed) — falls back to `metadata.slot`, then position. */
  slot?: string | null;
  metadata?: unknown;
}

/** Minimal structural shape numbering needs; `PartQuestion` satisfies it. */
export interface NumberingQuestionLike {
  id: string;
  /** Explicit span (already parsed) — falls back to `metadata.numberSpan`, then 1. */
  numberSpan?: number | null;
  metadata?: unknown;
}

export interface QuestionNumber {
  questionId: string;
  /** First question number this row occupies (1-based). */
  start: number;
  /** Last question number this row occupies (`start` when the span is 1). */
  end: number;
  /** "7" or "21–22" (en dash). */
  label: string;
}

export interface SinglePartBlock<Q extends PartitionQuestionLike = PartQuestion> {
  kind: "single";
  question: Q;
  number: QuestionNumber;
}

export interface GroupPartBlock<Q extends PartitionQuestionLike = PartQuestion> {
  kind: "group";
  /**
   * The group view with `questionIds` / `slotByQuestionId` recomputed from the
   * members actually present in this block (frozen snapshots may drop rows).
   */
  group: IeltsQuestionGroupView;
  /** Members in display order. */
  questions: Q[];
  /** Parallel to `questions`. */
  numbers: QuestionNumber[];
  /** questionId → slot id used by the stimulus markers / hotspots. */
  slotByQuestionId: Record<string, string>;
  /** "Questions 1–5", "Questions 21–22", or "Question 7" for a one-number block. */
  rangeLabel: string;
}

export type PartBlock<Q extends PartitionQuestionLike = PartQuestion> =
  | SinglePartBlock<Q>
  | GroupPartBlock<Q>;

/** Stimulus slots vs member slots — renderers draw inert blanks for `missing`. */
export interface StimulusSlotCoverage {
  /** Slots the stimulus references that no member question fills. */
  missing: string[];
  /** Member slots the stimulus never references. */
  extra: string[];
}
