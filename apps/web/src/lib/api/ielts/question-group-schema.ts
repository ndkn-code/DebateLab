/**
 * Canonical create/update boundary schema for an IELTS question group
 * (format-variety pass). A group is the set-level half of an official question
 * set — the shared heading/feature/ending bank, the summary/notes text with
 * numbered blanks, the table or flow-chart with gap cells, or the diagram/map
 * image with labelled hotspots. Member questions are still their own
 * `ielts_questions` rows linked by `(test_id, group_key)`.
 *
 * Loose authoring input (pipe-separated bank, bare-string bank entries) is
 * normalized here; the stimulus is validated against the shared
 * `GroupStimulusSchema` and its slots must be unique.
 */
import { z } from "zod";
import type { Json, TablesInsert, TablesUpdate } from "@/types/supabase";
import {
  GroupBankOptionSchema,
  GroupStimulusSchema,
  normalizeGroupStimulus,
  stimulusSlots,
} from "@/lib/ielts/question-types/groups";
import { JsonSchema } from "./json";
import { IELTS_SKILLS } from "./schema";
import { dedupeStrings, normalizeWhitespace, splitPipeList } from "./normalize";

/** Mirrors the DB CHECK on `ielts_question_groups.group_key`. */
export const GROUP_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,119}$/;

export const GROUP_ANSWER_MODES = ["select", "text"] as const;
export type IeltsGroupAnswerMode = (typeof GROUP_ANSWER_MODES)[number];

type BankEntry = z.infer<typeof GroupBankOptionSchema>;

/** Pipe-separated string, string list, or option objects → clean bank list. */
function normalizeBank(raw: string | BankEntry[] | undefined): BankEntry[] {
  if (raw == null) return [];
  if (typeof raw === "string") return splitPipeList(raw);
  const out: BankEntry[] = [];
  const strings: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      strings.push(entry);
      continue;
    }
    out.push({
      ...entry,
      id: normalizeWhitespace(entry.id),
      label: entry.label === undefined ? undefined : normalizeWhitespace(entry.label),
      text: normalizeWhitespace(entry.text),
    });
  }
  return [...out, ...dedupeStrings(strings)];
}

function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const BankInput = z.union([z.string(), z.array(GroupBankOptionSchema)]);

const GroupFields = z.object({
  testId: z.string().uuid(),
  skill: z.enum(IELTS_SKILLS),
  passageId: z.string().uuid().nullish(),
  listeningSectionId: z.string().uuid().nullish(),
  groupKey: z
    .string()
    .regex(GROUP_KEY_PATTERN, "groupKey must be lowercase a-z, 0-9, _ or - (max 120)"),
  orderIndex: z.number().int().min(0).max(400).default(0),
  title: z.string().max(300).nullish(),
  instructions: z.string().max(2000).nullish(),
  stimulus: GroupStimulusSchema.nullish(),
  bank: BankInput.optional(),
  bankReuse: z.boolean().default(false),
  answerMode: z.enum(GROUP_ANSWER_MODES).nullish(),
  anyOrder: z.boolean().default(false),
  metadata: z.record(z.string(), JsonSchema).default({}),
});

type GroupFieldsInput = z.infer<typeof GroupFields>;

function validateGroup(v: GroupFieldsInput, ctx: z.RefinementCtx): void {
  const add = (path: string, message: string) =>
    ctx.addIssue({ code: "custom", message, path: [path] });
  if (v.passageId && v.listeningSectionId) {
    add("passageId", "a group cannot link both a passage and a listening section");
  }
  if (v.skill === "reading" && v.listeningSectionId) {
    add("listeningSectionId", "a reading group cannot link a listening section");
  }
  if (v.skill === "listening" && v.passageId) {
    add("passageId", "a listening group cannot link a passage");
  }
  const slots = stimulusSlots(normalizeGroupStimulus(v.stimulus ?? null));
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const slot of slots) {
    if (seen.has(slot)) dupes.add(slot);
    seen.add(slot);
  }
  if (dupes.size > 0) {
    add("stimulus", `stimulus slots must be unique (duplicated: ${[...dupes].join(", ")})`);
  }
}

export interface NormalizedQuestionGroupInput {
  testId: string;
  skill: GroupFieldsInput["skill"];
  passageId: string | null;
  listeningSectionId: string | null;
  groupKey: string;
  orderIndex: number;
  title: string | null;
  instructions: string | null;
  stimulus: z.infer<typeof GroupStimulusSchema> | null;
  bank: BankEntry[];
  bankReuse: boolean;
  answerMode: IeltsGroupAnswerMode | null;
  anyOrder: boolean;
  metadata: Record<string, Json>;
}

export type NormalizedQuestionGroupUpdate = NormalizedQuestionGroupInput & { groupId: string };

function normalizeGroup(v: GroupFieldsInput): NormalizedQuestionGroupInput {
  return {
    testId: v.testId,
    skill: v.skill,
    passageId: v.passageId ?? null,
    listeningSectionId: v.listeningSectionId ?? null,
    groupKey: v.groupKey,
    orderIndex: v.orderIndex,
    title: trimToNull(v.title),
    instructions: trimToNull(v.instructions),
    stimulus: v.stimulus ?? null,
    bank: normalizeBank(v.bank),
    bankReuse: v.bankReuse,
    answerMode: v.answerMode ?? null,
    anyOrder: v.anyOrder,
    metadata: v.metadata,
  };
}

export const CreateQuestionGroupSchema = GroupFields.superRefine(validateGroup).transform(
  normalizeGroup,
);
export type CreateQuestionGroupInput = z.infer<typeof CreateQuestionGroupSchema>;

export const UpdateQuestionGroupSchema = GroupFields.extend({ groupId: z.string().uuid() })
  .superRefine(validateGroup)
  .transform((v): NormalizedQuestionGroupUpdate => ({ ...normalizeGroup(v), groupId: v.groupId }));
export type UpdateQuestionGroupInput = z.infer<typeof UpdateQuestionGroupSchema>;

function sharedColumns(input: NormalizedQuestionGroupInput) {
  return {
    skill: input.skill,
    passage_id: input.passageId,
    listening_section_id: input.listeningSectionId,
    group_key: input.groupKey,
    order_index: input.orderIndex,
    title: input.title,
    instructions: input.instructions,
    stimulus: (input.stimulus ?? null) as Json | null,
    bank: input.bank as Json,
    bank_reuse: input.bankReuse,
    answer_mode: input.answerMode,
    any_order: input.anyOrder,
    metadata: input.metadata as Json,
  };
}

/** Map validated input to the typed `ielts_question_groups` insert row. */
export function toGroupInsert(
  input: NormalizedQuestionGroupInput,
): TablesInsert<"ielts_question_groups"> {
  return { test_id: input.testId, ...sharedColumns(input) };
}

/** Map validated input to a full-replace `ielts_question_groups` update. */
export function toGroupUpdate(
  input: NormalizedQuestionGroupInput,
): TablesUpdate<"ielts_question_groups"> {
  return sharedColumns(input);
}
