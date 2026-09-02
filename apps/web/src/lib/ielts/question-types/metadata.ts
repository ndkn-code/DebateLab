/**
 * Typed `ielts_questions.metadata` (format-variety pass).
 *
 * The column stays free-form jsonb (adaptive tags, import ids, provenance ride
 * through untouched), but the fields the player, grader, and scorers depend on
 * are now named and validated here instead of being read ad hoc:
 *
 *  - `items` / `selectCount` — matching statements and multi-select size (WS-1.2).
 *  - `slot` — which blank / hotspot of the question's group this row answers
 *    (defaults to the row's 1-based position within its group).
 *  - `numberSpan` — one `mcq_multi` row that occupies N question numbers
 *    ("Questions 21–22: choose TWO letters"); `max_points` equals the span.
 *  - `allowNumber` — "ONE WORD AND/OR A NUMBER": numeric tokens do not count
 *    toward the word limit.
 *  - `cueCard` — Speaking Part 2 card (topic, "You should say" bullets, closing
 *    line, preparation and speaking seconds).
 *  - `letter` — General Training Task 1 brief (recipient, register, bullets).
 *
 * Parsing is tolerant (`parseQuestionMetadata` never throws — malformed fields
 * are dropped one at a time so the 12k existing rows keep rendering); the
 * authoring boundary applies the strict schema.
 */
import { z } from "zod";

export const MatchItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  text: z.string().default(""),
});

export const DEFAULT_CUE_CARD_PREP_SECONDS = 60;
export const DEFAULT_CUE_CARD_SPEAK_SECONDS = 120;

export const CueCardSchema = z.object({
  topic: z.string().min(1).max(500),
  bullets: z.array(z.string().min(1).max(300)).min(1).max(6),
  closing: z.string().max(300).optional(),
  prepSeconds: z.number().int().positive().max(600).default(DEFAULT_CUE_CARD_PREP_SECONDS),
  speakSeconds: z.number().int().positive().max(600).default(DEFAULT_CUE_CARD_SPEAK_SECONDS),
});
export type IeltsCueCard = z.infer<typeof CueCardSchema>;

export const LETTER_REGISTERS = ["formal", "semi_formal", "informal"] as const;
export type IeltsLetterRegister = (typeof LETTER_REGISTERS)[number];

export const LetterSchema = z.object({
  recipient: z.string().min(1).max(200),
  register: z.enum(LETTER_REGISTERS),
  bullets: z.array(z.string().min(1).max(300)).min(1).max(5),
});
export type IeltsLetterBrief = z.infer<typeof LetterSchema>;

const KNOWN_FIELDS = {
  items: z.array(MatchItemSchema).optional(),
  selectCount: z.number().int().positive().max(10).optional(),
  slot: z.string().min(1).max(40).optional(),
  numberSpan: z.number().int().min(1).max(6).optional(),
  allowNumber: z.boolean().optional(),
  cueCard: CueCardSchema.optional(),
  letter: LetterSchema.optional(),
} as const;

/** Known fields are validated; every other key passes through unchanged. */
export const IeltsQuestionMetadataSchema = z.looseObject(KNOWN_FIELDS);
export type IeltsQuestionMetadata = z.infer<typeof IeltsQuestionMetadataSchema>;

export const KNOWN_METADATA_KEYS = Object.keys(KNOWN_FIELDS) as Array<
  keyof typeof KNOWN_FIELDS
>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Tolerant parse for read paths. A malformed known field is dropped (not the
 * whole record), unknown keys are preserved, and a non-object yields `{}`.
 */
export function parseQuestionMetadata(raw: unknown): IeltsQuestionMetadata {
  if (!isPlainRecord(raw)) return {};
  const whole = IeltsQuestionMetadataSchema.safeParse(raw);
  if (whole.success) return whole.data;

  const out: Record<string, unknown> = { ...raw };
  for (const key of KNOWN_METADATA_KEYS) {
    delete out[key];
    if (!(key in raw)) continue;
    const field = KNOWN_FIELDS[key].safeParse(raw[key]);
    if (field.success && field.data !== undefined) out[key] = field.data;
  }
  return out as IeltsQuestionMetadata;
}
