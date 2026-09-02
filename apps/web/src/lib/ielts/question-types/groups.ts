/**
 * IELTS question groups (format-variety pass).
 *
 * A group is the set-level half of an official IELTS question set: the shared
 * heading/feature/ending/word bank, the summary or notes text with numbered
 * blanks, the table or flow-chart with gap cells, or the diagram/map image with
 * labelled hotspots. Each numbered question in the set is still its own
 * `ielts_questions` row (one answer, one blank `"0"`, one chip in the strip);
 * the row's `metadata.slot` says which blank/hotspot of the group it fills.
 *
 * Rows come from `ielts_question_groups` (live) or from the per-attempt
 * `ielts_attempt_question_group_blueprints` snapshot — both have the same
 * learner-facing columns, so one parser serves both.
 */
import { z } from "zod";
import type { Enums } from "@/types/supabase";
import { promptBlankIds } from "./prompt";
import { parseQuestionMetadata } from "./metadata";
import type {
  IeltsImageHotspot,
  IeltsOption,
  IeltsTableCell,
} from "./types";

export type IeltsQuestionGroupAnswerMode = "select" | "text";

// ── Authored (stored) stimulus ───────────────────────────────────────────────

const GroupBankOptionObjectSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  text: z.string().default(""),
});
/** Full option object or a bare string (author shorthand). */
export const GroupBankOptionSchema = z.union([GroupBankOptionObjectSchema, z.string()]);

const HotspotSchema = z
  .object({
    /** The slot (question) this hotspot belongs to. `id` accepted as an alias. */
    slot: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    label: z.string().optional(),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  })
  .refine((h) => Boolean(h.slot ?? h.id), { message: "hotspot needs a slot" });

const TableCellSchema = z.union([
  z.string(),
  z.object({ gap: z.string().min(1), label: z.string().optional() }),
]);

export const GroupStimulusSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    heading: z.string().max(300).optional(),
    /** Summary / notes / form text with `__BLANK_<slot>__` markers. */
    body: z.string().min(1).max(20000),
  }),
  z.object({
    kind: z.literal("table"),
    caption: z.string().max(500).optional(),
    headers: z.array(z.string().max(200)).max(20).default([]),
    rows: z.array(z.array(TableCellSchema).max(20)).max(60),
  }),
  z.object({
    kind: z.literal("flowchart"),
    title: z.string().max(300).optional(),
    direction: z.enum(["down", "right"]).default("down"),
    /** Each step may carry `__BLANK_<slot>__` markers. */
    steps: z.array(z.object({ text: z.string().min(1).max(2000) })).min(1).max(20),
  }),
  z.object({
    kind: z.literal("image"),
    url: z.string().url(),
    alt: z.string().min(1).max(500),
    caption: z.string().max(500).optional(),
    hotspots: z.array(HotspotSchema).max(40).default([]),
  }),
]);
export type IeltsGroupStimulusInput = z.input<typeof GroupStimulusSchema>;

// ── Normalized (renderer-facing) shapes ──────────────────────────────────────

export type IeltsGroupStimulus =
  | { kind: "text"; heading?: string; body: string }
  | { kind: "table"; caption?: string; headers: string[]; rows: IeltsTableCell[][] }
  | { kind: "flowchart"; title?: string; direction: "down" | "right"; steps: { text: string }[] }
  | { kind: "image"; url: string; alt: string; caption?: string; hotspots: IeltsImageHotspot[] };

export interface IeltsQuestionGroupView {
  /** Group id (live) or blueprint row id (frozen). */
  id: string;
  groupKey: string;
  skill: Enums<"ielts_skill">;
  passageId: string | null;
  listeningSectionId: string | null;
  orderIndex: number;
  title: string | null;
  instructions: string | null;
  stimulus: IeltsGroupStimulus | null;
  /** Shared bank; empty when the group's blanks are typed. */
  bank: IeltsOption[];
  bankReuse: boolean;
  answerMode: IeltsQuestionGroupAnswerMode | null;
  anyOrder: boolean;
  /** Member question ids in display order. */
  questionIds: string[];
  /** questionId → slot id used in the stimulus markers / hotspots. */
  slotByQuestionId: Record<string, string>;
}

/** The columns shared by `ielts_question_groups` and its attempt snapshot. */
export interface IeltsQuestionGroupRowLike {
  id: string;
  group_key: string;
  skill: Enums<"ielts_skill">;
  passage_id: string | null;
  listening_section_id: string | null;
  order_index: number;
  title: string | null;
  instructions: string | null;
  stimulus: unknown;
  bank: unknown;
  bank_reuse: boolean;
  answer_mode: string | null;
  any_order: boolean;
}

export interface GroupMemberQuestionLike {
  id: string;
  metadata: unknown;
}

const A_CHAR_CODE = 65;
function defaultLabel(index: number): string {
  return index < 26 ? String.fromCharCode(A_CHAR_CODE + index) : `A${index - 25}`;
}

export function normalizeGroupBank(raw: unknown): IeltsOption[] {
  const parsed = z.array(GroupBankOptionSchema).catch([]).parse(raw);
  return parsed.map((entry, index) =>
    typeof entry === "string"
      ? { id: String(index), label: defaultLabel(index), text: entry }
      : { ...entry, label: entry.label ?? defaultLabel(index) },
  );
}

export function normalizeGroupStimulus(raw: unknown): IeltsGroupStimulus | null {
  if (raw == null) return null;
  const parsed = GroupStimulusSchema.safeParse(raw);
  if (!parsed.success) return null;
  const s = parsed.data;
  switch (s.kind) {
    case "text":
      return { kind: "text", heading: s.heading, body: s.body };
    case "table":
      return {
        kind: "table",
        caption: s.caption,
        headers: s.headers,
        rows: s.rows.map((row) =>
          row.map((cell) =>
            typeof cell === "string"
              ? { text: cell }
              : { gap: { id: cell.gap, label: cell.label } },
          ),
        ),
      };
    case "flowchart":
      return { kind: "flowchart", title: s.title, direction: s.direction, steps: s.steps };
    case "image":
      return {
        kind: "image",
        url: s.url,
        alt: s.alt,
        caption: s.caption,
        hotspots: s.hotspots.map((h) => ({
          id: (h.slot ?? h.id) as string,
          label: h.label,
          x: h.x,
          y: h.y,
        })),
      };
  }
}

/** Slot ids referenced by a stimulus, in document order. */
export function stimulusSlots(stimulus: IeltsGroupStimulus | null): string[] {
  if (!stimulus) return [];
  switch (stimulus.kind) {
    case "text":
      return promptBlankIds(stimulus.body);
    case "flowchart":
      return stimulus.steps.flatMap((step) => promptBlankIds(step.text));
    case "table":
      return stimulus.rows.flatMap((row) =>
        row.flatMap((cell) => (cell.gap ? [cell.gap.id] : [])),
      );
    case "image":
      return stimulus.hotspots.map((h) => h.id);
  }
}

/** Slot for the nth member when the row has no explicit `metadata.slot`. */
export function defaultSlotForPosition(index: number): string {
  return String(index + 1);
}

export function resolveGroupSlots(
  questions: readonly GroupMemberQuestionLike[],
): Record<string, string> {
  const out: Record<string, string> = {};
  questions.forEach((question, index) => {
    const meta = parseQuestionMetadata(question.metadata);
    out[question.id] = meta.slot ?? defaultSlotForPosition(index);
  });
  return out;
}

function normalizeAnswerMode(raw: string | null): IeltsQuestionGroupAnswerMode | null {
  return raw === "select" || raw === "text" ? raw : null;
}

/**
 * Parse a group row plus its member questions (already in display order) into
 * the renderer-facing view. Defensive: malformed stimulus/bank degrade to
 * `null` / `[]`, never throw.
 */
export function parseQuestionGroupView(
  row: IeltsQuestionGroupRowLike,
  questions: readonly GroupMemberQuestionLike[],
): IeltsQuestionGroupView {
  const bank = normalizeGroupBank(row.bank);
  return {
    id: row.id,
    groupKey: row.group_key,
    skill: row.skill,
    passageId: row.passage_id,
    listeningSectionId: row.listening_section_id,
    orderIndex: row.order_index,
    title: row.title,
    instructions: row.instructions,
    stimulus: normalizeGroupStimulus(row.stimulus),
    bank,
    bankReuse: row.bank_reuse,
    answerMode: normalizeAnswerMode(row.answer_mode) ?? (bank.length > 0 ? "select" : null),
    anyOrder: row.any_order,
    questionIds: questions.map((q) => q.id),
    slotByQuestionId: resolveGroupSlots(questions),
  };
}

/** Index group views by `groupKey` for O(1) lookup while partitioning parts. */
export function indexGroupsByKey(
  groups: readonly IeltsQuestionGroupView[],
): Map<string, IeltsQuestionGroupView> {
  return new Map(groups.map((group) => [group.groupKey, group]));
}
