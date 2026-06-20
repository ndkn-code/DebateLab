/**
 * Boundary schemas + typed insert/update mappers for the non-question IELTS
 * content entities (WS-1.1): reading passages, listening sections (script only —
 * TTS audio is WS-1.3), and raw→band conversion rows. Question authoring lives in
 * question-schema.ts. Pure module (Zod + type-only imports).
 */
import { z } from "zod";
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase";
import { IELTS_ACCENTS, IELTS_MODULES } from "./schema";
import { JsonSchema } from "./json";

const MetadataSchema = z.record(z.string(), JsonSchema).default({});

// --- Passages -------------------------------------------------------------

export const CreatePassageSchema = z.object({
  testId: z.string().uuid(),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  orderIndex: z.number().int().min(0).max(50).default(0),
  wordCount: z.number().int().min(0).max(5000).nullish(),
  genre: z.string().max(120).nullish(),
  metadata: MetadataSchema,
});
export type CreatePassageInput = z.infer<typeof CreatePassageSchema>;

export function toPassageInsert(input: CreatePassageInput): TablesInsert<"passages"> {
  return {
    test_id: input.testId,
    title: input.title.trim(),
    body: input.body,
    order_index: input.orderIndex,
    word_count: input.wordCount ?? null,
    genre: input.genre?.trim() || null,
    metadata: input.metadata,
  };
}

export const UpdatePassageSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(20000).optional(),
  orderIndex: z.number().int().min(0).max(50).optional(),
  wordCount: z.number().int().min(0).max(5000).nullish(),
  genre: z.string().max(120).nullish(),
  metadata: z.record(z.string(), JsonSchema).optional(),
});
export type UpdatePassageInput = z.infer<typeof UpdatePassageSchema>;

export function toPassageUpdate(input: UpdatePassageInput): TablesUpdate<"passages"> {
  const patch: TablesUpdate<"passages"> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.body !== undefined) patch.body = input.body;
  if (input.orderIndex !== undefined) patch.order_index = input.orderIndex;
  if (input.wordCount !== undefined) patch.word_count = input.wordCount ?? null;
  if (input.genre !== undefined) patch.genre = input.genre?.trim() || null;
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  return patch;
}

// --- Listening sections (script only) -------------------------------------

const SpeakerSchema = z.object({
  name: z.string().min(1).max(120),
  accent: z.enum(IELTS_ACCENTS).default("uk"),
});

export const CreateListeningSectionSchema = z.object({
  testId: z.string().uuid(),
  sectionNumber: z.number().int().min(1).max(4),
  script: z.string().min(1).max(20000),
  orderIndex: z.number().int().min(0).max(50).default(0),
  title: z.string().max(300).nullish(),
  accent: z.enum(IELTS_ACCENTS).default("uk"),
  speakers: z.array(SpeakerSchema).max(8).default([]),
  metadata: MetadataSchema,
});
export type CreateListeningSectionInput = z.infer<typeof CreateListeningSectionSchema>;

export function toListeningSectionInsert(
  input: CreateListeningSectionInput,
): TablesInsert<"listening_sections"> {
  return {
    test_id: input.testId,
    section_number: input.sectionNumber,
    script: input.script,
    order_index: input.orderIndex,
    title: input.title?.trim() || null,
    accent: input.accent,
    speakers: input.speakers,
    metadata: input.metadata,
  };
}

export const UpdateListeningSectionSchema = z.object({
  sectionNumber: z.number().int().min(1).max(4).optional(),
  script: z.string().min(1).max(20000).optional(),
  orderIndex: z.number().int().min(0).max(50).optional(),
  title: z.string().max(300).nullish(),
  accent: z.enum(IELTS_ACCENTS).optional(),
  speakers: z.array(SpeakerSchema).max(8).optional(),
  metadata: z.record(z.string(), JsonSchema).optional(),
});
export type UpdateListeningSectionInput = z.infer<typeof UpdateListeningSectionSchema>;

export function toListeningSectionUpdate(
  input: UpdateListeningSectionInput,
): TablesUpdate<"listening_sections"> {
  const patch: TablesUpdate<"listening_sections"> = {};
  if (input.sectionNumber !== undefined) patch.section_number = input.sectionNumber;
  if (input.script !== undefined) patch.script = input.script;
  if (input.orderIndex !== undefined) patch.order_index = input.orderIndex;
  if (input.title !== undefined) patch.title = input.title?.trim() || null;
  if (input.accent !== undefined) patch.accent = input.accent;
  if (input.speakers !== undefined) patch.speakers = input.speakers;
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  return patch;
}

// --- Band conversions (raw → band) ----------------------------------------

export const CreateBandConversionSchema = z
  .object({
    conversionKey: z.string().min(1).max(120).default("default"),
    skill: z.enum(["listening", "reading"]),
    module: z.enum(IELTS_MODULES).nullish(),
    band: z.number().min(0).max(9),
    rawMin: z.number().int().min(0).max(40),
    rawMax: z.number().int().min(0).max(40),
  })
  .refine((v) => v.rawMax >= v.rawMin, {
    message: "rawMax must be >= rawMin",
    path: ["rawMax"],
  })
  // band has DB precision numeric(2,1) — keep to a single decimal (half bands).
  .refine((v) => Number.isInteger(v.band * 2), {
    message: "band must be a whole or half number (e.g. 6 or 6.5)",
    path: ["band"],
  });
export type CreateBandConversionInput = z.infer<typeof CreateBandConversionSchema>;

export function toBandConversionInsert(
  input: CreateBandConversionInput,
): TablesInsert<"band_conversions"> {
  return {
    conversion_key: input.conversionKey,
    skill: input.skill,
    module: input.module ?? null,
    band: input.band,
    raw_min: input.rawMin,
    raw_max: input.rawMax,
  };
}

// --- Band-conversion TABLE (the WS-2.2 admin "edit a table" path) ----------
// A "table" is the full set of band→raw rows for one (conversion_key, skill,
// module). The admin surface replaces it atomically; the seeded 'default' is the
// fallback the grader uses when a test names no `band_conversion_key`.

export type BandConversionSkill = "listening" | "reading";
export type BandConversionModuleKey = (typeof IELTS_MODULES)[number];

const BandConversionRowSchema = z
  .object({
    band: z
      .number()
      .min(0)
      .max(9)
      .refine((v) => Number.isInteger(v * 2), {
        message: "band must be a whole or half number (e.g. 6 or 6.5)",
      }),
    rawMin: z.number().int().min(0).max(40),
    rawMax: z.number().int().min(0).max(40),
  })
  .refine((v) => v.rawMax >= v.rawMin, {
    message: "rawMax must be >= rawMin",
    path: ["rawMax"],
  });

export const ReplaceBandConversionTableSchema = z
  .object({
    conversionKey: z.string().min(1).max(120),
    skill: z.enum(["listening", "reading"]),
    module: z.enum(IELTS_MODULES).nullish(),
    rows: z.array(BandConversionRowSchema).min(1).max(60),
  })
  .superRefine((v, ctx) => {
    // Listening is module-independent; Reading splits Academic vs GT (DB shape).
    if (v.skill === "listening" && v.module != null) {
      ctx.addIssue({
        code: "custom",
        message: "listening tables are module-independent — leave module empty",
        path: ["module"],
      });
    }
    if (v.skill === "reading" && v.module == null) {
      ctx.addIssue({
        code: "custom",
        message: "reading tables require a module (academic or general_training)",
        path: ["module"],
      });
    }
    const bands = v.rows.map((r) => r.band);
    if (new Set(bands).size !== bands.length) {
      ctx.addIssue({
        code: "custom",
        message: "each band may appear only once in a table",
        path: ["rows"],
      });
    }
  });
export type ReplaceBandConversionTableInput = z.infer<
  typeof ReplaceBandConversionTableSchema
>;

export const DeleteBandConversionTableSchema = z.object({
  conversionKey: z.string().min(1).max(120),
  skill: z.enum(["listening", "reading"]),
  module: z.enum(IELTS_MODULES).nullish(),
});
export type DeleteBandConversionTableInput = z.infer<
  typeof DeleteBandConversionTableSchema
>;

export function toBandConversionRows(
  input: ReplaceBandConversionTableInput,
): TablesInsert<"band_conversions">[] {
  return input.rows.map((row) => ({
    conversion_key: input.conversionKey,
    skill: input.skill,
    module: input.module ?? null,
    band: row.band,
    raw_min: row.rawMin,
    raw_max: row.rawMax,
  }));
}

export interface BandConversionTableGroup {
  conversionKey: string;
  skill: BandConversionSkill;
  module: BandConversionModuleKey | null;
  rows: { band: number; rawMin: number; rawMax: number }[];
}

/** Group flat band_conversions rows into per-(key, skill, module) tables (pure). */
export function groupBandConversionTables(
  rows: Pick<Tables<"band_conversions">, "conversion_key" | "skill" | "module" | "band" | "raw_min" | "raw_max">[],
): BandConversionTableGroup[] {
  const groups = new Map<string, BandConversionTableGroup>();
  for (const row of rows) {
    if (row.skill !== "listening" && row.skill !== "reading") continue;
    const key = `${row.conversion_key}::${row.skill}::${row.module ?? ""}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        conversionKey: row.conversion_key,
        skill: row.skill,
        module: (row.module as BandConversionModuleKey | null) ?? null,
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push({ band: row.band, rawMin: row.raw_min, rawMax: row.raw_max });
  }
  const tables = [...groups.values()];
  for (const group of tables) group.rows.sort((a, b) => b.band - a.band);
  tables.sort(
    (a, b) =>
      a.conversionKey.localeCompare(b.conversionKey) ||
      a.skill.localeCompare(b.skill) ||
      (a.module ?? "").localeCompare(b.module ?? ""),
  );
  return tables;
}
