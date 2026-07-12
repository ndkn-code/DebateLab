/**
 * Zod schemas + parsers for the IELTS objective question contract (WS-1.2).
 *
 * These translate the loosely-typed `Json` columns of `ielts_questions` and
 * `ielts_question_keys` into the strict shapes in {@link ./types}. View parsing
 * is defensive (malformed authored data degrades to an empty render rather than
 * throwing); answer parsing is strict (it guards a server boundary).
 */
import { z } from "zod";
import type { Tables } from "@/types/supabase";
import {
  VisualSchema as AuthoredVisualSchema,
  type IeltsVisual as AuthoredIeltsVisual,
} from "@/lib/api/ielts/visual";
import { getFixedOptions, getQuestionFamily } from "./registry";
import type {
  BlankValue,
  IeltsAnswer,
  IeltsOption,
  IeltsQuestionView,
  IeltsVisual,
  RawAnswerKey,
} from "./types";

const A_CHAR_CODE = 65;

/** Default display marker for the nth option: A, B, C, … then A1, A2, … */
export function defaultOptionLabel(index: number): string {
  if (index < 26) return String.fromCharCode(A_CHAR_CODE + index);
  return `A${index - 25}`;
}

// ── Option / item / visual schemas (non-secret view data) ────────────────────

const OptionObjectSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  text: z.string().default(""),
});

/** Accept either a full option object or a bare string (author shorthand). */
const OptionEntrySchema = z.union([OptionObjectSchema, z.string()]);

function normalizeOptions(raw: unknown): IeltsOption[] {
  const parsed = z.array(OptionEntrySchema).catch([]).parse(raw);
  return parsed.map((entry, index) =>
    typeof entry === "string"
      ? { id: String(index), label: defaultOptionLabel(index), text: entry }
      : { ...entry, label: entry.label ?? defaultOptionLabel(index) },
  );
}

const MatchItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  text: z.string().default(""),
});

const TableCellSchema = z.object({
  text: z.string().optional(),
  gap: z.object({ id: z.string().min(1), label: z.string().optional() }).optional(),
});

const LegacyVisualSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("table"),
    caption: z.string().optional(),
    rows: z.array(z.array(TableCellSchema)).default([]),
  }),
  z.object({
    kind: z.literal("image"),
    url: z.string(),
    alt: z.string().optional(),
    hotspots: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().optional(),
          x: z.number(),
          y: z.number(),
        }),
      )
      .default([]),
  }),
]);

function normalizeAuthoredVisual(visual: AuthoredIeltsVisual): IeltsVisual {
  switch (visual.type) {
    case "image": {
      const { type, ...image } = visual;
      return { ...image, kind: type, hotspots: [] };
    }
    case "table": {
      const { type, rows, ...table } = visual;
      return {
        ...table,
        kind: type,
        rows: rows.map((row) => row.map((text) => ({ text }))),
      };
    }
    case "chart":
    case "described": {
      const { type, ...rest } = visual;
      return { ...rest, kind: type } as IeltsVisual;
    }
  }
}

function parseVisual(raw: unknown): IeltsVisual | null {
  const authored = AuthoredVisualSchema.safeParse(raw);
  if (authored.success) return normalizeAuthoredVisual(authored.data);

  // Preserve the objective-question visual shape already stored by WS-1.2.
  const legacy = LegacyVisualSchema.safeParse(raw);
  if (!legacy.success) return null;
  if (legacy.data.kind === "table") {
    return { ...legacy.data, headers: [] };
  }
  return { ...legacy.data, alt: legacy.data.alt ?? "", hotspots: legacy.data.hotspots };
}

const MetadataSchema = z
  .object({
    items: z.array(MatchItemSchema).optional(),
    selectCount: z.number().int().positive().optional(),
  })
  .catch({});

/**
 * Parse a non-secret `ielts_questions` row into the renderer-facing view.
 * `family` and any fixed options (T/F/NG, Y/N/NG) come from the registry.
 */
export function parseQuestionView(
  row: Pick<
    Tables<"ielts_questions">,
    | "id"
    | "question_type"
    | "skill"
    | "prompt"
    | "group_instructions"
    | "word_limit"
    | "max_points"
    | "options"
    | "visual"
    | "metadata"
  >,
): IeltsQuestionView {
  const fixed = getFixedOptions(row.question_type);
  const options = fixed.length > 0 ? fixed : normalizeOptions(row.options);
  const meta = MetadataSchema.parse(row.metadata ?? {});
  const visual = row.visual == null ? null : parseVisual(row.visual);

  return {
    id: row.id,
    questionType: row.question_type,
    family: getQuestionFamily(row.question_type),
    skill: row.skill,
    prompt: row.prompt,
    groupInstructions: row.group_instructions,
    wordLimit: row.word_limit,
    maxPoints: row.max_points,
    options,
    items: meta.items ?? [],
    visual,
    selectCount: meta.selectCount ?? null,
  };
}

// ── Learner answer schema (strict — guards the grading boundary) ──────────────

const BlankValueSchema: z.ZodType<BlankValue> = z.union([
  z.string(),
  z.array(z.string()),
]);

export const IeltsAnswerSchema: z.ZodType<IeltsAnswer> = z.object({
  values: z.record(z.string(), BlankValueSchema).default({}),
});

// ── Secret key parsing (correct_answer + accept_variants Json columns) ────────

/** Wrap a bare value/array into a single-blank record under id "0". */
function asBlankRecord(raw: unknown): Record<string, BlankValue> {
  const direct = z.record(z.string(), BlankValueSchema).safeParse(raw);
  if (direct.success) return direct.data;
  const single = BlankValueSchema.safeParse(raw);
  return single.success ? { "0": single.data } : {};
}

function asVariantsRecord(raw: unknown): Record<string, string[]> {
  const obj = z.record(z.string(), z.array(z.string())).safeParse(raw);
  if (obj.success) return obj.data;
  const arr = z.array(z.string()).safeParse(raw);
  return arr.success ? { "0": arr.data } : {};
}

/**
 * Parse the two secret key columns into a {@link RawAnswerKey}. Tolerant of the
 * single-blank shorthand (a bare string/array maps to blank "0").
 */
export function parseRawAnswerKey(
  correctAnswer: unknown,
  acceptVariants: unknown,
): RawAnswerKey {
  return {
    correctAnswer: asBlankRecord(correctAnswer),
    acceptVariants: asVariantsRecord(acceptVariants),
  };
}
