/**
 * Boundary schemas + typed insert/update mappers for the non-question IELTS
 * content entities (WS-1.1): reading passages, listening sections (script only —
 * TTS audio is WS-1.3), and raw→band conversion rows. Question authoring lives in
 * question-schema.ts. Pure module (Zod + type-only imports).
 */
import { z } from "zod";
import type { TablesInsert, TablesUpdate } from "@/types/supabase";
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
