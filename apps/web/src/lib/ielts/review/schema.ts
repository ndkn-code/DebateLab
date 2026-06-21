import { z } from "zod";
import { JsonSchema } from "@/lib/api/ielts/json";
import { IELTS_SKILLS } from "@/lib/api/ielts/schema";
import {
  IELTS_REVIEW_ALGORITHMS,
  IELTS_REVIEW_RATINGS,
  IELTS_REVIEW_STATES,
} from "./scheduler";

export const IELTS_REVIEW_SOURCE_TYPES = [
  "ielts_question",
  "activity",
  "activity_attempt",
  "question_response",
  "writing_response",
  "speaking_response",
  "phoneme_report",
  "manual",
  "synthetic_atom",
] as const;

export const IELTS_REVIEW_DUE_STATES = [
  "new",
  "learning",
  "review",
  "relearning",
] as const;

export const BILINGUAL_REVIEW_COPY_SCHEMA = z.object({
  en: z.string().min(1).max(4_000),
  vi: z.string().min(1).max(4_000),
});

const JsonObjectSchema = z.record(z.string(), JsonSchema).default({});
const OptionalUuidSchema = z.string().uuid().nullish();

export const CreateIeltsReviewItemSchema = z.object({
  userId: z.string().uuid(),
  sourceType: z.enum(IELTS_REVIEW_SOURCE_TYPES),
  sourceId: OptionalUuidSchema,
  sourceKey: z.string().trim().min(1).max(240),
  skill: z.enum(IELTS_SKILLS),
  focusArea: z.string().trim().min(1).max(160),
  reviewKind: z.string().trim().min(1).max(80),
  questionId: OptionalUuidSchema,
  activityId: OptionalUuidSchema,
  activityAttemptId: OptionalUuidSchema,
  questionResponseId: OptionalUuidSchema,
  writingResponseId: OptionalUuidSchema,
  speakingResponseId: OptionalUuidSchema,
  prompt: BILINGUAL_REVIEW_COPY_SCHEMA,
  answer: BILINGUAL_REVIEW_COPY_SCHEMA.nullish(),
  atomPayload: JsonObjectSchema,
  metadata: JsonObjectSchema,
  dueAt: z.coerce.date().optional(),
  algorithm: z.enum(IELTS_REVIEW_ALGORITHMS).default("sm2_v1"),
});

export type CreateIeltsReviewItemInput = z.infer<typeof CreateIeltsReviewItemSchema>;

export const RateIeltsReviewItemSchema = z.object({
  reviewItemId: z.string().uuid(),
  rating: z.enum(IELTS_REVIEW_RATINGS),
  reviewedAt: z.coerce.date().optional(),
  targetTestDate: z.coerce.date().nullish(),
  isCorrect: z.boolean().optional(),
  responseMs: z.number().int().nonnegative().optional(),
  planItemId: OptionalUuidSchema,
  activityAttemptId: OptionalUuidSchema,
  metadata: JsonObjectSchema,
});

export type RateIeltsReviewItemInput = z.infer<typeof RateIeltsReviewItemSchema>;

export const DueIeltsReviewItemsQuerySchema = z.object({
  userId: z.string().uuid(),
  dueAt: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  states: z.array(z.enum(IELTS_REVIEW_STATES)).default([...IELTS_REVIEW_DUE_STATES]),
});

export type DueIeltsReviewItemsQuery = z.infer<typeof DueIeltsReviewItemsQuerySchema>;
