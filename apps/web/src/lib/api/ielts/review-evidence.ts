import "server-only";

import { parseInput } from "@/lib/api/boundary";
import { IELTS_MODULES } from "@/lib/api/ielts/schema";
import {
  IeltsAdaptiveEvidenceSchema,
  IeltsSubskillKeySchema,
} from "@/lib/ielts/adaptive/evidence";
import type { IeltsReviewRating } from "@/lib/ielts/review";
import type { Json, Tables } from "@/types/supabase";
import {
  insertAssessEvidenceRows,
  makeAssessEvidenceInsert,
} from "./assess-evidence";
import type { IeltsDbClient } from "./client";

type ReviewItemForEvidence = Pick<
  Tables<"ielts_review_items">,
  | "id"
  | "user_id"
  | "skill"
  | "focus_area"
  | "review_kind"
  | "source_key"
  | "state"
  | "metadata"
  | "atom_payload"
>;

type IeltsModule = (typeof IELTS_MODULES)[number];

const FALLBACK_SUBSKILL_BY_SKILL = {
  listening: "listening:mcq_single",
  reading: "reading:mcq_single",
  writing: "writing:task_response_task2",
  speaking: "speaking:fluency_coherence",
} as const;

const RATING_LABEL_EN: Record<IeltsReviewRating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

const RATING_LABEL_VI: Record<IeltsReviewRating, string> = {
  again: "Làm lại",
  hard: "Khó",
  good: "Ổn",
  easy: "Dễ",
};

function isRecord(value: Json): value is { [key: string]: Json } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonString(value: Json, key: string): string | null {
  if (!isRecord(value)) return null;
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : null;
}

function jsonStringArray(value: Json, key: string): string[] {
  if (!isRecord(value)) return [];
  const candidate = value[key];
  if (!Array.isArray(candidate)) return [];
  return candidate.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
}

function safeSubskillKey(value: string | null): string | null {
  if (!value) return null;
  const parsed = IeltsSubskillKeySchema.safeParse(value.trim());
  return parsed.success ? parsed.data : null;
}

function focusAreaCandidate(item: ReviewItemForEvidence): string | null {
  const normalized = item.focus_area
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (normalized.length === 0) return null;
  return safeSubskillKey(
    normalized.includes(":") ? normalized : `${item.skill}:${normalized}`,
  );
}

function uniqueCandidates(item: ReviewItemForEvidence): string[] {
  const raw = [
    jsonString(item.metadata, "subskillKey"),
    jsonString(item.metadata, "subskill_key"),
    jsonString(item.atom_payload, "subskillKey"),
    jsonString(item.atom_payload, "subskill_key"),
    ...jsonStringArray(item.metadata, "subskillKeys"),
    ...jsonStringArray(item.metadata, "subskill_keys"),
    ...jsonStringArray(item.atom_payload, "subskillKeys"),
    ...jsonStringArray(item.atom_payload, "subskill_keys"),
    focusAreaCandidate(item),
    FALLBACK_SUBSKILL_BY_SKILL[item.skill],
  ];
  return [
    ...new Set(
      raw
        .map(safeSubskillKey)
        .filter((key): key is string => Boolean(key))
        .filter((key) => key.startsWith(`${item.skill}:`)),
    ),
  ];
}

async function resolveReviewSubskillKey(
  client: IeltsDbClient,
  item: ReviewItemForEvidence,
): Promise<string> {
  const candidates = uniqueCandidates(item);
  const { data, error } = await client
    .from("ielts_subskills")
    .select("key")
    .eq("skill", item.skill)
    .eq("is_active", true)
    .in("key", candidates);
  if (error) throw new Error(`resolveReviewSubskillKey(candidates): ${error.message}`);

  const available = new Set((data ?? []).map((row) => row.key));
  const matched = candidates.find((candidate) => available.has(candidate));
  if (matched) return matched;

  const fallback = await client
    .from("ielts_subskills")
    .select("key")
    .eq("skill", item.skill)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fallback.error) {
    throw new Error(`resolveReviewSubskillKey(fallback): ${fallback.error.message}`);
  }
  return fallback.data?.key ?? FALLBACK_SUBSKILL_BY_SKILL[item.skill];
}

function moduleForReviewItem(item: ReviewItemForEvidence): IeltsModule {
  const moduleValue =
    jsonString(item.metadata, "module") ?? jsonString(item.atom_payload, "module");
  return IELTS_MODULES.includes(moduleValue as IeltsModule)
    ? (moduleValue as IeltsModule)
    : "academic";
}

export function reviewEvidenceValueFromQualityGrade(qualityGrade: number): number {
  return Math.max(0, Math.min(1, (qualityGrade - 1) / 4));
}

function reviewEvidenceReason(params: {
  item: ReviewItemForEvidence;
  rating: IeltsReviewRating;
  qualityGrade: number;
}): { en: string; vi: string } {
  return {
    en: `Review self-grade ${RATING_LABEL_EN[params.rating]} recorded for ${params.item.focus_area}.`,
    vi: `Đã ghi nhận tự đánh giá ôn tập ${RATING_LABEL_VI[params.rating]} cho ${params.item.focus_area}.`,
  };
}

export async function recordIeltsReviewResultEvidence(params: {
  client: IeltsDbClient;
  item: ReviewItemForEvidence;
  rating: IeltsReviewRating;
  qualityGrade: number;
  reviewedAt: Date;
  responseMs?: number;
  isCorrect?: boolean | null;
}): Promise<void> {
  const subskillKey = await resolveReviewSubskillKey(params.client, params.item);
  const reason = reviewEvidenceReason({
    item: params.item,
    rating: params.rating,
    qualityGrade: params.qualityGrade,
  });
  const parsed = parseInput(IeltsAdaptiveEvidenceSchema, {
    userId: params.item.user_id,
    subskillKey,
    skill: params.item.skill,
    module: moduleForReviewItem(params.item),
    evidenceType: "review_result",
    evidenceValue: reviewEvidenceValueFromQualityGrade(params.qualityGrade),
    rawScore: params.qualityGrade,
    confidence: 0.35,
    sourceTable: "ielts_review_items",
    sourceId: params.item.id,
    reasonEn: reason.en,
    reasonVi: reason.vi,
    createdAt: params.reviewedAt.toISOString(),
  });

  await insertAssessEvidenceRows({
    client: params.client,
    userId: params.item.user_id,
    module: parsed.module,
    rows: [
      makeAssessEvidenceInsert(parsed, {
        review_item_id: params.item.id,
        source_key: params.item.source_key,
        review_kind: params.item.review_kind,
        focus_area: params.item.focus_area,
        state_before: params.item.state,
        rating: params.rating,
        quality_grade: params.qualityGrade,
        is_correct: params.isCorrect ?? null,
        response_ms: params.responseMs ?? null,
      } satisfies Json),
    ],
  });
}
