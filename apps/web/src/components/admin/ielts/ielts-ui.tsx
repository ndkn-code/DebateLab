"use client";

/**
 * Shared presentation helpers for the IELTS authoring admin (WS-1.1): a labeled
 * field wrapper, a token-styled textarea, status badge mapping, and the grouped
 * question-type catalogue. Design-system tokens only (no raw colors / sizes).
 */
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  IELTS_CONTENT_STATUSES,
  IELTS_QUESTION_TYPES,
} from "@/lib/api/ielts/schema";

export type IeltsContentStatus = (typeof IELTS_CONTENT_STATUSES)[number];
export type IeltsQuestionType = (typeof IELTS_QUESTION_TYPES)[number];

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="type-label text-on-surface">{label}</span>
      {children}
      {hint ? <span className="type-caption text-on-surface-variant">{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  className,
  rows = 4,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full rounded-xl border border-input bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    />
  );
}

const STATUS_BADGE: Record<
  IeltsContentStatus,
  { variant: "secondary" | "info" | "warning" | "success" | "outline"; label: string }
> = {
  draft: { variant: "secondary", label: "Draft" },
  in_qa: { variant: "warning", label: "In QA" },
  approved: { variant: "info", label: "Approved" },
  published: { variant: "success", label: "Published" },
  archived: { variant: "outline", label: "Archived" },
};

export function StatusBadge({ status }: { status: IeltsContentStatus }) {
  const meta = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export const QUESTION_TYPE_LABELS: Record<IeltsQuestionType, string> = {
  mcq_single: "MCQ (single)",
  mcq_multi: "MCQ (multiple)",
  true_false_notgiven: "True / False / Not Given",
  yes_no_notgiven: "Yes / No / Not Given",
  matching_headings: "Matching headings",
  matching_information: "Matching information",
  matching_features: "Matching features",
  sentence_completion: "Sentence completion",
  summary_completion: "Summary completion",
  note_table_form_flowchart_completion: "Note / table / form / flowchart",
  short_answer: "Short answer",
  diagram_label: "Diagram labelling",
  map_plan_label: "Map / plan labelling",
  writing_task1_academic: "Writing Task 1 (Academic)",
  writing_task1_general: "Writing Task 1 (General)",
  writing_task2_essay: "Writing Task 2 (essay)",
  speaking_part1: "Speaking Part 1",
  speaking_part2_cuecard: "Speaking Part 2 (cue card)",
  speaking_part3: "Speaking Part 3",
};

export const QUESTION_TYPE_GROUPS: Array<{ label: string; types: IeltsQuestionType[] }> = [
  {
    label: "Reading / Listening",
    types: [
      "mcq_single",
      "mcq_multi",
      "true_false_notgiven",
      "yes_no_notgiven",
      "matching_headings",
      "matching_information",
      "matching_features",
      "sentence_completion",
      "summary_completion",
      "note_table_form_flowchart_completion",
      "short_answer",
      "diagram_label",
      "map_plan_label",
    ],
  },
  {
    label: "Writing",
    types: ["writing_task1_academic", "writing_task1_general", "writing_task2_essay"],
  },
  {
    label: "Speaking",
    types: ["speaking_part1", "speaking_part2_cuecard", "speaking_part3"],
  },
];

/** Split a textarea value (newline- or pipe-separated) into a clean list. */
export function linesToList(value: string): string[] {
  return value
    .split(/[\n|]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
