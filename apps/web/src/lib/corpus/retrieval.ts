import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDebateCorpusEmbeddingConfig,
  getDebateCorpusRagReviewStatuses,
  hasDebateCorpusEmbeddingConfig,
  isDebateCorpusRagEnabled,
} from "./config";
import { createDebateCorpusEmbedding } from "./embeddings";
import {
  formatRetrievedDebateCorpusContext,
  purposeToCorpusUsableFor,
  type DebateCorpusPurpose,
  type RetrievedDebateCorpusItem,
} from "./model";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import type { PracticeLanguage, PracticeTrack } from "@/types";

export interface DebateCorpusRetrievalResult {
  enabled: boolean;
  contextBlock: string;
  items: RetrievedDebateCorpusItem[];
  logId: string | null;
  latencyMs: number | null;
  skippedReason?: string;
}

interface RetrieveDebateCorpusParams {
  purpose: DebateCorpusPurpose;
  practiceLanguage?: PracticeLanguage;
  practiceTrack?: PracticeTrack;
  topic: string;
  side?: "proposition" | "opposition";
  transcript: string;
  roundsText?: string[];
  userId?: string | null;
  sourceRoute: string;
  supabase?: SupabaseClient;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function previewText(value: string, max = 500) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max - 1)}...`
    : normalized;
}

function buildRetrievalQuery(params: RetrieveDebateCorpusParams) {
  const roundContext = params.roundsText?.filter(Boolean).slice(-4).join("\n\n");
  return [
    `Motion: ${params.topic}`,
    params.side ? `Student side: ${params.side}` : "",
    `Purpose: ${params.purpose}`,
    roundContext ? `Recent round context:\n${roundContext}` : "",
    `Current transcript:\n${params.transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
}

function normalizeRetrievedRows(value: unknown): RetrievedDebateCorpusItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => row as Partial<RetrievedDebateCorpusItem>)
    .filter((row): row is RetrievedDebateCorpusItem =>
      Boolean(
        row.item_id &&
          row.canonical_match_key &&
          row.motion_vi &&
          row.item_type &&
          row.content &&
          typeof row.similarity === "number"
      )
    );
}

async function logRetrieval(params: {
  supabase: SupabaseClient;
  userId?: string | null;
  sourceRoute: string;
  queryText: string;
  items: RetrievedDebateCorpusItem[];
  latencyMs: number;
  filters: Record<string, unknown>;
}) {
  const config = getDebateCorpusEmbeddingConfig();
  const { data, error } = await params.supabase
    .from("debate_corpus_retrieval_logs")
    .insert({
      user_id: params.userId ?? null,
      source_route: params.sourceRoute,
      query_hash: hashText(params.queryText),
      query_text_preview: previewText(params.queryText),
      provider: config.provider,
      model: config.model,
      dimensions: config.dimensions,
      filters: params.filters,
      retrieved_items: params.items.map((item) => ({
        item_id: item.item_id,
        canonical_match_key: item.canonical_match_key,
        item_type: item.item_type,
        similarity: item.similarity,
        evidence_status: item.evidence_status,
      })),
      latency_ms: params.latencyMs,
    })
    .select("id")
    .single();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Corpus retrieval log insert failed:", error.message);
    }
    return null;
  }

  return (data as { id: string }).id;
}

export async function linkDebateCorpusRetrievalLogToAiRun(
  logId: string | null | undefined,
  aiQualityRunId: string | null | undefined,
  supabase?: SupabaseClient
) {
  if (!logId || !aiQualityRunId) return;
  const client = supabase ?? tryCreateAdminClient();
  if (!client) return;
  try {
    await client
      .from("debate_corpus_retrieval_logs")
      .update({ ai_quality_run_id: aiQualityRunId })
      .eq("id", logId);
  } catch {
    // Retrieval logs are observability-only; never fail the AI response path.
  }
}

export async function retrieveDebateCorpusContext(
  params: RetrieveDebateCorpusParams
): Promise<DebateCorpusRetrievalResult> {
  if (!isDebateCorpusRagEnabled()) {
    return {
      enabled: false,
      contextBlock: "",
      items: [],
      logId: null,
      latencyMs: null,
      skippedReason: "flag_disabled",
    };
  }
  if (params.practiceLanguage !== "vi" || params.practiceTrack === "speaking") {
    return {
      enabled: true,
      contextBlock: "",
      items: [],
      logId: null,
      latencyMs: null,
      skippedReason: "not_vi_debate",
    };
  }
  if (!hasDebateCorpusEmbeddingConfig()) {
    return {
      enabled: true,
      contextBlock: "",
      items: [],
      logId: null,
      latencyMs: null,
      skippedReason: "missing_embedding_config",
    };
  }

  const client = params.supabase ?? tryCreateAdminClient();
  if (!client) {
    return {
      enabled: true,
      contextBlock: "",
      items: [],
      logId: null,
      latencyMs: null,
      skippedReason: "missing_supabase_service_role",
    };
  }

  const startedAt = Date.now();
  const queryText = buildRetrievalQuery(params);
  const usableFor = purposeToCorpusUsableFor(params.purpose);

  try {
    const config = getDebateCorpusEmbeddingConfig();
    const reviewStatuses = getDebateCorpusRagReviewStatuses();
    const embedding = await createDebateCorpusEmbedding({
      text: queryText,
      inputType: "query",
      timeoutMs: 12000,
    });
    const { data, error } = await client.rpc("match_debate_corpus_items", {
      query_embedding: embedding.embedding,
      match_count: params.purpose === "judging" ? 8 : 6,
      match_language: "vi",
      match_usable_for: usableFor,
      min_confidence: 0.72,
      match_provider: config.provider,
      match_model: config.model,
      match_dimensions: config.dimensions,
      match_review_statuses: reviewStatuses,
    });

    if (error) {
      throw new Error(error.message);
    }

    const items = normalizeRetrievedRows(data);
    const latencyMs = Date.now() - startedAt;
    const contextBlock = formatRetrievedDebateCorpusContext(
      items,
      params.purpose
    );
    const logId = await logRetrieval({
      supabase: client,
      userId: params.userId,
      sourceRoute: params.sourceRoute,
      queryText,
      items,
      latencyMs,
      filters: {
        purpose: params.purpose,
        usableFor,
        language: "vi",
        minConfidence: 0.72,
        provider: config.provider,
        model: config.model,
        reviewStatuses,
      },
    });

    return {
      enabled: true,
      contextBlock,
      items,
      logId,
      latencyMs,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Corpus retrieval skipped:",
        error instanceof Error ? error.message : error
      );
    }
    return {
      enabled: true,
      contextBlock: "",
      items: [],
      logId: null,
      latencyMs: Date.now() - startedAt,
      skippedReason:
        error instanceof Error ? `retrieval_failed:${error.message}` : "retrieval_failed",
    };
  }
}
